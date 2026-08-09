export const PRODUCT_RUNTIME_MODES = ["mock", "managed"] as const

export type ProductRuntimeMode = (typeof PRODUCT_RUNTIME_MODES)[number]

const managedIntegrations = [
  {
    name: "identity",
    environment: [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
    ],
  },
  {
    name: "database",
    environment: ["DATABASE_URL"],
  },
  {
    name: "coordination",
    environment: [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ],
  },
  {
    name: "object-storage",
    environment: ["BLOB_READ_WRITE_TOKEN"],
  },
  {
    name: "malware-scanning",
    environment: ["CLOUDMERSIVE_VIRUS_API_KEY"],
  },
  {
    name: "realtime",
    environment: ["ABLY_API_KEY"],
  },
  {
    name: "speech",
    environment: [
      "AZURE_SPEECH_REGION",
      "AZURE_SPEECH_API_KEY",
      "AZURE_TRANSLATOR_ENDPOINT",
      "AZURE_TRANSLATOR_REGION",
      "AZURE_TRANSLATOR_API_KEY",
    ],
  },
  {
    name: "payments",
    environment: [
      "NEXT_PUBLIC_RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "PAYMENT_WEBHOOK_SECRET",
      "CREDIT_PRICE_PAISE",
    ],
  },
] as const

type Environment = Record<string, string | undefined>

function resolveMode(environment: Environment): ProductRuntimeMode {
  const configured = environment.PRASTUTI_RUNTIME_MODE

  if (configured) {
    if (!PRODUCT_RUNTIME_MODES.includes(configured as ProductRuntimeMode)) {
      throw new Error(
        `PRASTUTI_RUNTIME_MODE must be one of: ${PRODUCT_RUNTIME_MODES.join(", ")}.`,
      )
    }

    return configured as ProductRuntimeMode
  }

  return environment.NODE_ENV === "production" ? "managed" : "mock"
}

export function productRuntime(environment: Environment = process.env) {
  const mode = resolveMode(environment)
  const telemetryExporter = environment.VERCEL
    ? "vercel-collector"
    : environment.OTEL_EXPORTER_OTLP_ENDPOINT
      ? "otlp"
      : "console-only"
  const missingForManagedDeployment = managedIntegrations.flatMap(
    (integration) =>
      integration.environment.filter((key) => !environment[key]),
  )

  const integrations = managedIntegrations.map((integration) => ({
    name: integration.name,
    adapter:
      mode === "mock"
        ? "deterministic-mock"
        : integration.environment.every((key) => environment[key])
          ? "managed"
          : "unconfigured",
  }))

  return {
    mode,
    infrastructureFree: mode === "mock",
    readyForCurrentMode:
      mode === "mock" || missingForManagedDeployment.length === 0,
    readyForManagedDeployment: missingForManagedDeployment.length === 0,
    missingForManagedDeployment,
    integrations,
    telemetry: {
      instrumentation: "opentelemetry",
      exporter: telemetryExporter,
      externallyExported: telemetryExporter !== "console-only",
    },
  } as const
}
