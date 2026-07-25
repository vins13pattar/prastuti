"use client"

let organizerCsrfToken: string | null = null

export async function organizerApi<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase()
  const headers = new Headers(init.headers)

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    if (!organizerCsrfToken) {
      const identityResponse = await fetch("/api/auth/session", {
        cache: "no-store",
      })
      if (!identityResponse.ok) {
        throw new Error("Your local organizer session has expired.")
      }
      const identity = (await identityResponse.json()) as { csrfToken: string }
      organizerCsrfToken = identity.csrfToken
    }
    headers.set("x-csrf-token", organizerCsrfToken)
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  })
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null
  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed with ${response.status}.`)
  }
  return data as T
}
