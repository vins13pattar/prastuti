import "server-only"

import * as Ably from "ably"
import { put } from "@vercel/blob"
import { z } from "zod"

import type {
  CaptionSegment,
  CaptionTranslations,
  SupportedLanguage,
} from "@/lib/product/types"

const languageCodes: Record<SupportedLanguage, string> = {
  Kannada: "kn",
  English: "en",
  Hindi: "hi",
  Telugu: "te",
}

const speechVoices: Record<
  SupportedLanguage,
  { locale: string; voice: string }
> = {
  Kannada: { locale: "kn-IN", voice: "kn-IN-SapnaNeural" },
  English: { locale: "en-IN", voice: "en-IN-NeerjaNeural" },
  Hindi: { locale: "hi-IN", voice: "hi-IN-SwaraNeural" },
  Telugu: { locale: "te-IN", voice: "te-IN-ShrutiNeural" },
}

const translatorResponseSchema = z.array(
  z.object({
    translations: z.array(
      z.object({
        text: z.string(),
        to: z.string(),
      }),
    ),
  }),
)

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for managed media.`)
  return value
}

function translatorEndpoint() {
  const configured =
    process.env.AZURE_TRANSLATOR_ENDPOINT ??
    "https://api.cognitive.microsofttranslator.com"
  const endpoint = new URL(configured)
  const allowed =
    endpoint.protocol === "https:" &&
    (endpoint.hostname === "api.cognitive.microsofttranslator.com" ||
      endpoint.hostname.endsWith(".cognitiveservices.azure.com"))
  if (!allowed) throw new Error("AZURE_TRANSLATOR_ENDPOINT is not allowlisted.")
  return endpoint
}

export async function translateWithAzure(
  sourceText: string,
  sourceLanguage: SupportedLanguage,
  targets: SupportedLanguage[],
): Promise<CaptionTranslations> {
  const endpoint = translatorEndpoint()
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/translate`
  endpoint.searchParams.set("api-version", "3.0")
  endpoint.searchParams.set("from", languageCodes[sourceLanguage])
  for (const target of targets) {
    endpoint.searchParams.append("to", languageCodes[target])
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Ocp-Apim-Subscription-Key": requiredEnvironment(
        "AZURE_TRANSLATOR_API_KEY",
      ),
      "Ocp-Apim-Subscription-Region": requiredEnvironment(
        "AZURE_TRANSLATOR_REGION",
      ),
      "X-ClientTraceId": crypto.randomUUID(),
    },
    body: JSON.stringify([{ Text: sourceText }]),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) {
    throw new Error(`Azure Translator returned ${response.status}.`)
  }
  const parsed = translatorResponseSchema.parse(await response.json())
  const translations = parsed[0]?.translations ?? []
  return Object.fromEntries(
    targets.map((target) => {
      const code = languageCodes[target]
      return [
        target,
        translations.find((translation) => translation.to === code)?.text ??
          "",
      ]
    }),
  )
}

export async function issueAzureSpeechToken() {
  const region = requiredEnvironment("AZURE_SPEECH_REGION")
  if (!/^[a-z0-9-]{2,40}$/.test(region)) {
    throw new Error("AZURE_SPEECH_REGION is invalid.")
  }
  const response = await fetch(
    `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": requiredEnvironment(
          "AZURE_SPEECH_API_KEY",
        ),
        "Content-Length": "0",
      },
      signal: AbortSignal.timeout(8_000),
    },
  )
  if (!response.ok) {
    throw new Error(`Azure Speech token exchange returned ${response.status}.`)
  }
  return {
    token: await response.text(),
    region,
    expiresAt: new Date(Date.now() + 9 * 60 * 1000).toISOString(),
  }
}

export async function issueAblyToken(input: {
  sessionId: string
  clientId: string
  role: "presenter" | "attendee"
}) {
  const channel = `session:${input.sessionId}`
  const client = new Ably.Rest({ key: requiredEnvironment("ABLY_API_KEY") })
  const tokenRequest = await client.auth.createTokenRequest({
    clientId: `${input.role}:${input.clientId}`,
    ttl: 10 * 60 * 1000,
    capability: JSON.stringify({
      [channel]:
        input.role === "presenter"
          ? ["publish", "subscribe", "presence"]
          : ["subscribe", "presence"],
    }),
  })
  return { channel, tokenRequest }
}

export async function publishCaptionToAbly(
  sessionId: string,
  segment: CaptionSegment,
  eventName = "caption",
) {
  const client = new Ably.Rest({ key: requiredEnvironment("ABLY_API_KEY") })
  await client.channels
    .get(`session:${sessionId}`)
    .publish({ id: `${segment.id}:${eventName}`, name: eventName, data: segment })
}

function escapeSsml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export async function synthesizeSharedAudio(input: {
  organizationId: string
  sessionId: string
  segmentId: string
  translations: CaptionTranslations
}) {
  const region = requiredEnvironment("AZURE_SPEECH_REGION")
  if (!/^[a-z0-9-]{2,40}$/.test(region)) {
    throw new Error("AZURE_SPEECH_REGION is invalid.")
  }
  const entries = await Promise.all(
    Object.entries(input.translations).map(async ([language, text]) => {
      if (!text) return null
      const voice = speechVoices[language as SupportedLanguage]
      const response = await fetch(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": requiredEnvironment(
              "AZURE_SPEECH_API_KEY",
            ),
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat":
              "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "Prastuti",
          },
          body: `<speak version="1.0" xml:lang="${voice.locale}"><voice name="${voice.voice}">${escapeSsml(text)}</voice></speak>`,
          signal: AbortSignal.timeout(10_000),
        },
      )
      if (!response.ok) {
        throw new Error(`Azure Speech synthesis returned ${response.status}.`)
      }
      const pathname = `${input.organizationId}/${input.sessionId}/audio/${input.segmentId}-${language}.mp3`
      const blob = await put(pathname, Buffer.from(await response.arrayBuffer()), {
        access: "private",
        addRandomSuffix: false,
        contentType: "audio/mpeg",
        cacheControlMaxAge: 60,
      })
      return [language, blob.pathname] as const
    }),
  )
  return Object.fromEntries(
    entries.filter((entry): entry is NonNullable<typeof entry> =>
      Boolean(entry),
    ),
  ) as Partial<Record<SupportedLanguage, string>>
}
