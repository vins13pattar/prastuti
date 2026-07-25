import {
  deleteExpiredPresentationAssets,
  persistSessionArtifacts,
} from "@/lib/server/post-session"

async function persistArtifactsStep(sessionId: string) {
  "use step"
  return persistSessionArtifacts(sessionId)
}

async function enforceRetentionStep() {
  "use step"
  return deleteExpiredPresentationAssets()
}

export async function finalizeSessionWorkflow(sessionId: string) {
  "use workflow"
  const artifacts = await persistArtifactsStep(sessionId)
  const retention = await enforceRetentionStep()
  return { sessionId, artifacts, retention }
}

