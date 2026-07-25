import "server-only"

import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { put } from "@vercel/blob"
import { unzipSync } from "fflate"
import { extractText, getDocumentProxy } from "unpdf"

import { presentationAssets } from "@/db/schema"
import { getDatabase } from "@/db"
import type { OrganizerIdentity } from "@/lib/product/types"
import { productRuntime } from "@/lib/runtime/product-runtime"
import { usesPostgresRepository } from "@/lib/server/product-repository"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_EXTRACTED_CHARACTERS = 100_000
const ALLOWED_TYPES = new Map([
  ["application/pdf", ".pdf"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".pptx",
  ],
  ["text/plain", ".txt"],
  ["text/csv", ".csv"],
])

function normalizedName(name: string) {
  return name.normalize("NFKC").replaceAll(/[^\p{L}\p{N}._ -]/gu, "_")
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

function isPdf(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
}

function isZip(bytes: Uint8Array) {
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}

function validateFileShape(file: File, bytes: Uint8Array) {
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Presentation files must be between 1 byte and 10 MB.")
  }
  const expectedExtension = ALLOWED_TYPES.get(file.type)
  if (!expectedExtension) {
    throw new Error("Upload a PDF, PPTX, TXT, or CSV presentation file.")
  }
  if (!file.name.toLowerCase().endsWith(expectedExtension)) {
    throw new Error("The filename extension does not match its content type.")
  }
  if (file.type === "application/pdf" && !isPdf(bytes)) {
    throw new Error("The uploaded file is not a valid PDF.")
  }
  if (file.type.includes("presentationml") && !isZip(bytes)) {
    throw new Error("The uploaded file is not a valid PPTX container.")
  }
  if (
    file.type.startsWith("text/") &&
    bytes.slice(0, 4096).some((byte) => byte === 0)
  ) {
    throw new Error("Text context files cannot contain binary data.")
  }
}

async function scanForMalware(file: File, bytes: Uint8Array) {
  if (productRuntime().mode === "mock") {
    const testSignature = new TextDecoder().decode(bytes.slice(0, 4096))
    if (
      testSignature.includes(
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!",
      )
    ) {
      throw new Error("The presentation failed the local malware test.")
    }
    return "clean"
  }

  const apiKey = process.env.CLOUDMERSIVE_VIRUS_API_KEY
  if (!apiKey) {
    throw new Error(
      "Managed presentation uploads are closed until malware scanning is configured.",
    )
  }
  const form = new FormData()
  const fileBuffer = bytes.slice().buffer as ArrayBuffer
  form.set(
    "inputFile",
    new File([fileBuffer], normalizedName(file.name), { type: file.type }),
  )
  const response = await fetch(
    "https://api.cloudmersive.com/virus/scan/file/advanced",
    {
      method: "POST",
      headers: {
        Apikey: apiKey,
        fileName: normalizedName(file.name),
        allowExecutables: "false",
        allowInvalidFiles: "false",
        allowScripts: "false",
        allowPasswordProtectedFiles: "false",
        allowMacros: "false",
        allowXmlExternalEntities: "false",
        allowInsecureDeserialization: "false",
        allowHtml: "false",
        allowUnsafeArchives: "false",
      },
      body: form,
      signal: AbortSignal.timeout(20_000),
    },
  )
  if (!response.ok) {
    throw new Error("The malware scanner could not verify this file.")
  }
  const result = (await response.json()) as {
    CleanResult?: boolean
    ContainsExecutable?: boolean
    ContainsInvalidFile?: boolean
    ContainsScript?: boolean
    ContainsMacros?: boolean
    ContainsUnsafeArchive?: boolean
  }
  if (
    result.CleanResult !== true ||
    result.ContainsExecutable ||
    result.ContainsInvalidFile ||
    result.ContainsScript ||
    result.ContainsMacros ||
    result.ContainsUnsafeArchive
  ) {
    throw new Error("The presentation did not pass the malware policy.")
  }
  return "clean"
}

function decodeXmlText(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
}

async function extractPresentationText(
  contentType: string,
  bytes: Uint8Array,
) {
  if (contentType === "application/pdf") {
    const pdf = await getDocumentProxy(bytes)
    const result = await extractText(pdf, { mergePages: true })
    return result.text.slice(0, MAX_EXTRACTED_CHARACTERS)
  }
  if (contentType.includes("presentationml")) {
    const entries = unzipSync(bytes)
    const slideNames = Object.keys(entries)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      )
    let extracted = ""
    for (const slideName of slideNames) {
      const xml = new TextDecoder().decode(entries[slideName])
      const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
        .map((match) => decodeXmlText(match[1] ?? ""))
        .join(" ")
      extracted += `${text}\n`
      if (extracted.length >= MAX_EXTRACTED_CHARACTERS) break
    }
    return extracted.trim().slice(0, MAX_EXTRACTED_CHARACTERS)
  }
  return new TextDecoder("utf-8", { fatal: true })
    .decode(bytes)
    .slice(0, MAX_EXTRACTED_CHARACTERS)
}

async function storeFile(storageKey: string, file: File, bytes: Uint8Array) {
  if (productRuntime().mode === "managed") {
    const blob = await put(storageKey, Buffer.from(bytes), {
      access: "private",
      addRandomSuffix: false,
      contentType: file.type,
      cacheControlMaxAge: 60,
    })
    return blob.pathname
  }
  const storageDirectory = resolve(process.cwd(), ".prastuti-storage")
  const storagePath = resolve(storageDirectory, storageKey)
  await mkdir(dirname(storagePath), { recursive: true })
  await writeFile(storagePath, bytes, {
    flag: "wx",
  })
  return storageKey
}

export async function ingestPresentationAsset(input: {
  file: File
  identity: OrganizerIdentity
  sessionId: string
}) {
  const bytes = new Uint8Array(await input.file.arrayBuffer())
  validateFileShape(input.file, bytes)
  const scanStatus = await scanForMalware(input.file, bytes)
  const extractedText = await extractPresentationText(input.file.type, bytes)
  const id = crypto.randomUUID()
  const extension = ALLOWED_TYPES.get(input.file.type)
  const storageKey = `${input.identity.organizationId}/${input.sessionId}/${id}${extension}`
  const storedKey = await storeFile(storageKey, input.file, bytes)
  const deleteAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  if (!usesPostgresRepository()) {
    return {
      id,
      originalName: normalizedName(input.file.name).slice(0, 240),
      contentType: input.file.type,
      sizeBytes: input.file.size,
      scanStatus,
      extractionStatus: "completed",
      extractedText,
      deleteAfter: deleteAfter.toISOString(),
    }
  }
  const [asset] = await getDatabase()
    .insert(presentationAssets)
    .values({
      id,
      organizationId: input.identity.organizationId,
      sessionId: input.sessionId,
      storageKey: storedKey,
      originalName: normalizedName(input.file.name).slice(0, 240),
      contentType: input.file.type,
      sizeBytes: input.file.size,
      sha256: sha256(bytes),
      scanStatus,
      extractionStatus: "completed",
      extractedText,
      deleteAfter,
    })
    .returning()
  if (!asset) throw new Error("Unable to store presentation metadata.")
  return {
    id: asset.id,
    originalName: asset.originalName,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    scanStatus: asset.scanStatus,
    extractionStatus: asset.extractionStatus,
    extractedText: asset.extractedText ?? "",
    deleteAfter: asset.deleteAfter.toISOString(),
  }
}
