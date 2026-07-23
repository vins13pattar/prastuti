import {
  SERVERLESS_COMPONENTS,
} from "@/lib/serverless/architecture"
import { productRuntime } from "@/lib/runtime/product-runtime"

export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({
    authoredStack: "TypeScript",
    target: "serverless-scale-to-zero",
    components: SERVERLESS_COMPONENTS,
    runtime: productRuntime(),
    caveat:
      "Idle application compute can reach zero. Persistent storage, domains, and provider minimum charges may remain.",
  })
}
