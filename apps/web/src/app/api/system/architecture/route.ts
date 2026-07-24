import {
  SERVERLESS_COMPONENTS,
} from "@/lib/serverless/architecture"
import { productRuntime } from "@/lib/runtime/product-runtime"
import { providerBoundaries } from "@/lib/server/provider-contracts"

export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({
    authoredStack: "TypeScript",
    target: "serverless-scale-to-zero",
    components: SERVERLESS_COMPONENTS,
    providerBoundaries: providerBoundaries(),
    runtime: productRuntime(),
    caveat:
      "Idle application compute can reach zero. Persistent storage, domains, and provider minimum charges may remain.",
  })
}
