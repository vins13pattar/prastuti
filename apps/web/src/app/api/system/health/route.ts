import { productRuntime } from "@/lib/runtime/product-runtime"

export const dynamic = "force-dynamic"

export function GET() {
  const runtime = productRuntime()

  return Response.json(
    {
      status: runtime.readyForCurrentMode ? "ready" : "not-ready",
      runtime,
    },
    {
      status: runtime.readyForCurrentMode ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}
