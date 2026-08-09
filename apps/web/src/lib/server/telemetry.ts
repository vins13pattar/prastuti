import "server-only"

import {
  isSpanContextValid,
  SpanStatusCode,
  trace,
  type Attributes,
} from "@opentelemetry/api"

import { sanitizeTelemetryAttributes } from "@/lib/telemetry"

type OperationalLevel = "info" | "warn" | "error"
type OperationalOutcome = "succeeded" | "denied" | "failed"

type OperationalEventInput = {
  event: string
  level?: OperationalLevel
  outcome?: OperationalOutcome
  request?: Request
  attributes?: Record<string, unknown>
  error?: unknown
}

const tracer = trace.getTracer("prastuti-web")

function eventName(value: string) {
  return /^[a-z][a-z0-9_.-]{0,95}$/.test(value)
    ? value
    : "operational.event"
}

function deploymentEnvironment() {
  const value = process.env.VERCEL_ENV ?? process.env.NODE_ENV
  return ["development", "preview", "production", "test"].includes(
    value ?? "",
  )
    ? value
    : "unknown"
}

function spanAttributes(attributes: Record<string, string | number | boolean>) {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [`app.${key}`, value]),
  ) as Attributes
}

function safeErrorType(error: unknown) {
  if (!(error instanceof Error)) return undefined
  return /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(error.name)
    ? error.name
    : "Error"
}

function requestCorrelationId(request: Request | undefined) {
  const value = request?.headers.get("x-prastuti-request-id")
  return value && /^[a-f0-9-]{16,64}$/i.test(value) ? value : undefined
}

export function recordOperationalEvent(input: OperationalEventInput) {
  const event = eventName(input.event)
  const level = input.level ?? "info"
  const sanitized = sanitizeTelemetryAttributes({
    ...input.attributes,
    ...(safeErrorType(input.error)
      ? { errorType: safeErrorType(input.error) }
      : {}),
  })
  const activeSpan = trace.getActiveSpan()
  const activeSpanContext = activeSpan?.spanContext()
  const validSpanContext =
    activeSpanContext && isSpanContextValid(activeSpanContext)
      ? activeSpanContext
      : undefined

  activeSpan?.addEvent(event, {
    ...spanAttributes(sanitized),
    ...(input.outcome ? { "app.outcome": input.outcome } : {}),
  })
  if (level === "error" || input.error) {
    activeSpan?.setStatus({ code: SpanStatusCode.ERROR })
  }

  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    service: "prastuti-web",
    environment: deploymentEnvironment(),
    requestId: requestCorrelationId(input.request),
    traceId: validSpanContext?.traceId,
    spanId: validSpanContext?.spanId,
    outcome: input.outcome,
    attributes: sanitized,
  })

  if (level === "error") console.error(record)
  else if (level === "warn") console.warn(record)
  else console.info(record)
}

export function withOperationalSpan<T>(
  name: string,
  attributes: Record<string, unknown>,
  operation: () => Promise<T>,
) {
  const sanitized = sanitizeTelemetryAttributes(attributes)
  return tracer.startActiveSpan(
    eventName(name),
    { attributes: spanAttributes(sanitized) },
    async (span) => {
      try {
        return await operation()
      } catch (error) {
        span.recordException({
          name: safeErrorType(error) ?? "Error",
          message: "Operational failure",
        })
        span.setStatus({ code: SpanStatusCode.ERROR })
        throw error
      } finally {
        span.end()
      }
    },
  )
}
