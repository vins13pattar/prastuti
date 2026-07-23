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
