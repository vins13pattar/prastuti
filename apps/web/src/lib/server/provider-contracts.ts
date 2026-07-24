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

  return [
    "identity",
    "persistence",
    "realtime",
    "speech",
    "translation",
    "audio",
    "payments",
  ].map((capability) => ({
    capability: capability as ProviderCapability,
    adapter: "unconfigured" as const,
    execution: "managed-service" as const,
    scaleToZero: true,
  }))
}
