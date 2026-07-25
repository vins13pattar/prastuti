import { createHmac, timingSafeEqual } from "node:crypto"

export function verifyHmacSha256(
  payload: string,
  signature: string,
  secret: string,
) {
  const expected = createHmac("sha256", secret).update(payload).digest("hex")
  const expectedBytes = Buffer.from(expected, "utf8")
  const receivedBytes = Buffer.from(signature, "utf8")
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  )
}

