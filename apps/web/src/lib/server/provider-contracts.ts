import "server-only"

import type {
  CaptionTranslations,
  SupportedLanguage,
} from "@/lib/product/types"
import { productRuntime } from "@/lib/runtime/product-runtime"

export type ProviderCapability =
  | "identity"
  | "persistence"
  | "realtime"
  | "speech"
  | "translation"
  | "audio"
  | "payments"

export type ProviderBoundary = {
  capability: ProviderCapability
  adapter: "deterministic-local" | "managed" | "unconfigured"
  execution: "browser" | "serverless-function" | "managed-service"
  scaleToZero: boolean
}

export type TranslationProvider = {
  translate(
    sourceText: string,
    targets: SupportedLanguage[],
  ): Promise<CaptionTranslations>
}

export function providerBoundaries(): ProviderBoundary[] {
  const runtime = productRuntime()
  if (runtime.mode === "mock") {
    return [
      {
        capability: "identity",
        adapter: "deterministic-local",
        execution: "serverless-function",
        scaleToZero: true,
      },
      {
        capability: "persistence",
        adapter: "deterministic-local",
        execution: "serverless-function",
        scaleToZero: true,
      },
      {
        capability: "realtime",
        adapter: "deterministic-local",
        execution: "serverless-function",
        scaleToZero: true,
      },
      {
        capability: "speech",
        adapter: "deterministic-local",
        execution: "browser",
        scaleToZero: true,
      },
      {
        capability: "translation",
        adapter: "deterministic-local",
        execution: "serverless-function",
        scaleToZero: true,
      },
      {
        capability: "audio",
        adapter: "deterministic-local",
        execution: "browser",
        scaleToZero: true,
      },
      {
        capability: "payments",
        adapter: "deterministic-local",
        execution: "serverless-function",
        scaleToZero: true,
      },
    ]
  }

  const managedCapabilities = [
    "identity",
    "persistence",
    "realtime",
    "speech",
    "translation",
    "audio",
    "payments",
  ] as const
  const integrationName: Record<ProviderCapability, string> = {
    identity: "identity",
    persistence: "database",
    realtime: "realtime",
    speech: "speech",
    translation: "speech",
    audio: "speech",
    payments: "payments",
  }
  return managedCapabilities.map((capability) => ({
    capability,
    adapter:
      runtime.integrations.find(
        (integration) =>
          integration.name === integrationName[capability],
      )?.adapter === "managed"
        ? ("managed" as const)
        : ("unconfigured" as const),
    execution: "managed-service" as const,
    scaleToZero: true,
  }))
}
