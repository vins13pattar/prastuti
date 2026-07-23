import {
  SERVERLESS_COMPONENTS,
  serverlessReadiness,
} from "@/lib/serverless/architecture"

export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({
    authoredStack: "TypeScript",
    target: "serverless-scale-to-zero",
    components: SERVERLESS_COMPONENTS,
    integrations: serverlessReadiness(process.env),
    caveat:
      "Idle application compute can reach zero. Persistent storage, domains, and provider minimum charges may remain.",
  })
}
