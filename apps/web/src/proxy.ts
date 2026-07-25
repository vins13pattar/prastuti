import { clerkMiddleware } from "@clerk/nextjs/server"
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server"

import { productRuntime } from "@/lib/runtime/product-runtime"

function requestResponse(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-prastuti-request-id", requestId)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set("X-Request-ID", requestId)
  return response
}

const managedProxy = clerkMiddleware((_authentication, request) =>
  requestResponse(request),
)

export default function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  return productRuntime().mode === "managed"
    ? managedProxy(request, event)
    : requestResponse(request)
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
}
