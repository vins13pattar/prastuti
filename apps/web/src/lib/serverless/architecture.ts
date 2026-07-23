export const SERVERLESS_COMPONENTS = [
  {
    concern: "Web and control plane",
    technology: "Next.js 16 on Vercel",
    idleBehavior: "Static delivery and on-demand functions",
  },
  {
    concern: "Relational data",
    technology: "Neon Postgres with Drizzle",
    idleBehavior: "Database compute can suspend when inactive",
  },
  {
    concern: "Ephemeral coordination",
    technology: "Upstash Redis",
    idleBehavior: "Request-based serverless service",
  },
  {
    concern: "Live transport",
    technology: "Managed WebRTC and realtime pub-sub",
    idleBehavior: "No Prastuti-owned connection server",
  },
  {
    concern: "Post-session processing",
    technology: "Durable TypeScript workflow",
    idleBehavior: "Steps execute only when work exists",
  },
] as const

const requiredEnvironment = [
  "DATABASE_URL",
  "REALTIME_PROVIDER_URL",
  "REALTIME_PROVIDER_API_KEY",
  "REALTIME_PROVIDER_API_SECRET",
  "SPEECH_PROVIDER_ENDPOINT",
  "SPEECH_PROVIDER_API_KEY",
  "PAYMENT_WEBHOOK_SECRET",
] as const

export function serverlessReadiness(
  environment: Record<string, string | undefined>,
) {
  const missing = requiredEnvironment.filter((key) => !environment[key])

  return {
    ready: missing.length === 0,
    configured: requiredEnvironment.length - missing.length,
    required: requiredEnvironment.length,
    missing,
  }
}
