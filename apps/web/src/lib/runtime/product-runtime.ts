export const PRODUCT_RUNTIME_MODES = ["mock", "managed"] as const

export type ProductRuntimeMode = (typeof PRODUCT_RUNTIME_MODES)[number]

const managedIntegrations = [
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
    name: "realtime",
    environment: [
      "REALTIME_PROVIDER_URL",
      "REALTIME_PROVIDER_API_KEY",
      "REALTIME_PROVIDER_API_SECRET",
    ],
  },
  {
    name: "speech",
    environment: [
      "SPEECH_PROVIDER_ENDPOINT",
      "SPEECH_PROVIDER_API_KEY",
    ],
  },
  {
    name: "payments",
    environment: ["PAYMENT_WEBHOOK_SECRET"],
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
  } as const
}
