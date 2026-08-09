import "server-only"

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

import { productRuntime } from "@/lib/runtime/product-runtime"
import { recordOperationalEvent } from "@/lib/server/telemetry"

type LocalBucket = {
  count: number
  resetsAt: number
}

const localBuckets = new Map<string, LocalBucket>()
const managedLimiters = new Map<string, Ratelimit>()

function requestAddress(request: Request) {
  const vercelAddress = request.headers.get("x-vercel-forwarded-for")
  if (vercelAddress) return vercelAddress.split(",")[0]?.trim() ?? "unknown"
  if (productRuntime().mode === "mock") {
    return (
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "local"
    )
  }
  return "unknown"
}

function getManagedLimiter(limit: number, windowSeconds: number) {
  const configurationKey = `${limit}:${windowSeconds}`
  const existing = managedLimiters.get(configurationKey)
  if (existing) return existing
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    prefix: "prastuti:ratelimit",
    analytics: true,
  })
  managedLimiters.set(configurationKey, limiter)
  return limiter
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  options: {
    identifier?: string
    limit?: number
    windowSeconds?: number
  } = {},
) {
  const limit = options.limit ?? 60
  const windowSeconds = options.windowSeconds ?? 60
  const identifier =
    options.identifier ?? `${scope}:${requestAddress(request)}`

  if (productRuntime().mode === "managed") {
    const limiter = getManagedLimiter(limit, windowSeconds)
    if (!limiter) {
      recordOperationalEvent({
        event: "rate_limit.unavailable",
        level: "error",
        outcome: "failed",
        request,
        attributes: { scope },
      })
      return {
        allowed: false,
        status: 503,
        headers: { "Retry-After": "60" },
        reason: "Managed rate limiting is not configured.",
      } as const
    }
    const result = await limiter.limit(identifier)
    if (!result.success) {
      recordOperationalEvent({
        event: "rate_limit.denied",
        level: "warn",
        outcome: "denied",
        request,
        attributes: { scope, statusCode: 429 },
      })
    }
    return {
      allowed: result.success,
      status: result.success ? 200 : 429,
      headers: {
        "RateLimit-Limit": String(result.limit),
        "RateLimit-Remaining": String(result.remaining),
        "RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
        ...(result.success
          ? {}
          : {
              "Retry-After": String(
                Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
              ),
            }),
      },
      reason: result.success ? null : "Too many requests.",
    } as const
  }

  const now = Date.now()
  const key = `local:${identifier}`
  const bucket = localBuckets.get(key)
  const current =
    !bucket || bucket.resetsAt <= now
      ? { count: 0, resetsAt: now + windowSeconds * 1000 }
      : bucket
  current.count += 1
  localBuckets.set(key, current)
  const allowed = current.count <= limit
  if (!allowed) {
    recordOperationalEvent({
      event: "rate_limit.denied",
      level: "warn",
      outcome: "denied",
      request,
      attributes: { scope, statusCode: 429 },
    })
  }
  return {
    allowed,
    status: allowed ? 200 : 429,
    headers: {
      "RateLimit-Limit": String(limit),
      "RateLimit-Remaining": String(Math.max(0, limit - current.count)),
      "RateLimit-Reset": String(Math.ceil(current.resetsAt / 1000)),
      ...(allowed
        ? {}
        : {
            "Retry-After": String(
              Math.max(1, Math.ceil((current.resetsAt - now) / 1000)),
            ),
          }),
    },
    reason: allowed ? null : "Too many requests.",
  } as const
}

export function rateLimitResponse(result: {
  status: number
  headers: Record<string, string>
  reason: string | null
}) {
  return Response.json(
    { error: result.reason ?? "Request is temporarily unavailable." },
    { status: result.status, headers: result.headers },
  )
}
