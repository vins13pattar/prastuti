export const REDACTED_TELEMETRY_VALUE = "[REDACTED]"

const MAX_ATTRIBUTE_COUNT = 32
const MAX_ATTRIBUTE_LENGTH = 256
const ATTRIBUTE_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
const SENSITIVE_ATTRIBUTE_NAME =
  /(authorization|cookie|credential|password|raw.?body|secret|signature|token|api.?key)/i

export type TelemetryAttribute = string | number | boolean

function cleanString(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, MAX_ATTRIBUTE_LENGTH)
}

export function sanitizeTelemetryAttributes(
  attributes: Record<string, unknown> | undefined,
) {
  if (!attributes) return {}

  const sanitized: Record<string, TelemetryAttribute> = {}
  for (const [name, value] of Object.entries(attributes)) {
    if (Object.keys(sanitized).length >= MAX_ATTRIBUTE_COUNT) break
    if (!ATTRIBUTE_NAME.test(name)) continue

    if (SENSITIVE_ATTRIBUTE_NAME.test(name)) {
      sanitized[name] = REDACTED_TELEMETRY_VALUE
      continue
    }

    if (typeof value === "string") {
      sanitized[name] = cleanString(value)
    } else if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[name] = value
    } else if (typeof value === "boolean") {
      sanitized[name] = value
    }
  }

  return sanitized
}
