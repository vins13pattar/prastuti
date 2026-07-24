import { type NextRequest, NextResponse } from "next/server"

export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-prastuti-request-id", requestId)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set("X-Request-ID", requestId)
  return response
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
}
