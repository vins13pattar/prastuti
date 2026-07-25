import "server-only"

import { unlink } from "node:fs/promises"
import { resolve } from "node:path"

import { del } from "@vercel/blob"
import { and, eq, isNull, lt } from "drizzle-orm"

import {
  presentationAssets,
  sessionArtifacts,
} from "@/db/schema"
import { getDatabase } from "@/db"
import { productRuntime } from "@/lib/runtime/product-runtime"
import {
  buildSessionArtifacts,
  sessionById,
  usesPostgresRepository,
} from "@/lib/server/product-repository"

export async function persistSessionArtifacts(sessionId: string) {
  const session = await sessionById(sessionId)
  if (!session || session.status !== "completed") {
    throw new Error("A completed session is required for finalization.")
  }
  const artifacts = buildSessionArtifacts(session)
  if (!usesPostgresRepository()) {
    return { persisted: false, kinds: ["summary", "transcript"] }
  }
  const db = getDatabase()
  const values = [
    {
      sessionId,
      kind: "summary",
      content: JSON.stringify({
        summary: artifacts.summary,
        keyPoints: artifacts.keyPoints,
      }),
    },
    {
      sessionId,
      kind: "transcript",
      content: artifacts.transcript,
    },
  ]
  for (const value of values) {
    await db
      .insert(sessionArtifacts)
      .values(value)
      .onConflictDoUpdate({
        target: [sessionArtifacts.sessionId, sessionArtifacts.kind],
        set: { content: value.content, status: "ready" },
      })
  }
  return { persisted: true, kinds: values.map((value) => value.kind) }
}

export async function queueSessionFinalization(sessionId: string) {
  if (!usesPostgresRepository()) return { queued: false }
  const db = getDatabase()
  for (const kind of ["summary", "transcript"]) {
    await db
      .insert(sessionArtifacts)
      .values({ sessionId, kind, status: "pending" })
      .onConflictDoNothing()
  }
  return { queued: true }
}

export async function markSessionFinalizationStarted(
  sessionId: string,
  workflowRunId: string,
) {
  if (!usesPostgresRepository()) return
  await getDatabase()
    .update(sessionArtifacts)
    .set({ status: "processing", workflowRunId })
    .where(eq(sessionArtifacts.sessionId, sessionId))
}

function safeLocalAssetPath(storageKey: string) {
  if (!/^[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f-]+\.[a-z]+$/i.test(storageKey)) {
    throw new Error("Stored asset key is invalid.")
  }
  const directory = resolve(process.cwd(), ".prastuti-storage")
  const path = resolve(directory, storageKey)
  if (!path.startsWith(`${directory}/`)) {
    throw new Error("Stored asset key escaped the storage directory.")
  }
  return path
}

export async function deleteExpiredPresentationAssets() {
  if (!usesPostgresRepository()) return { deleted: 0 }
  const db = getDatabase()
  const expired = await db
    .select()
    .from(presentationAssets)
    .where(
      and(
        lt(presentationAssets.deleteAfter, new Date()),
        isNull(presentationAssets.deletedAt),
      ),
    )
    .limit(100)
  let deleted = 0
  for (const asset of expired) {
    if (productRuntime().mode === "managed") {
      await del(asset.storageKey)
    } else {
      await unlink(safeLocalAssetPath(asset.storageKey)).catch((error) => {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "ENOENT"
        ) {
          throw error
        }
      })
    }
    await db
      .update(presentationAssets)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(presentationAssets.id, asset.id),
          isNull(presentationAssets.deletedAt),
        ),
      )
    deleted += 1
  }
  return { deleted }
}
