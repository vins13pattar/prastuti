import { spawn } from "node:child_process"

const host = "127.0.0.1"
const port = 3107
const origin = `http://${host}:${port}`
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const output: string[] = []

const server = spawn(
  pnpm,
  ["exec", "next", "dev", "-H", host, "-p", String(port)],
  {
    env: {
      ...process.env,
      PRASTUTI_RUNTIME_MODE: "mock",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
)

server.stdout.on("data", (chunk: Buffer) => output.push(chunk.toString()))
server.stderr.on("data", (chunk: Buffer) => output.push(chunk.toString()))

const pause = (milliseconds: number) =>
  new Promise((resolvePause) => setTimeout(resolvePause, milliseconds))

async function waitUntilReady() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js exited before it became ready.\n${output.join("")}`)
    }

    try {
      const response = await fetch(`${origin}/api/system/health`)
      if (response.ok) return
    } catch {
      // The development server has not opened its socket yet.
    }

    await pause(250)
  }

  throw new Error(`Timed out waiting for Next.js.\n${output.join("")}`)
}

async function expectStatus(path: string, expectedStatus = 200) {
  const response = await fetch(`${origin}${path}`)
  if (response.status !== expectedStatus) {
    throw new Error(
      `${path} returned ${response.status}; expected ${expectedStatus}.`,
    )
  }
  return response
}

async function run() {
  await waitUntilReady()

  const homepage = await expectStatus("/")
  if (
    !homepage.headers
      .get("content-security-policy")
      ?.includes("default-src 'self'") ||
    !homepage.headers.get("x-request-id")
  ) {
    throw new Error("Security headers or request correlation ID are missing.")
  }
  const protectedPage = await fetch(`${origin}/dashboard`, {
    redirect: "manual",
  })
  const protectedBody = await protectedPage.text()
  if (
    !protectedPage.headers.get("location")?.includes("/local-sign-in") &&
    !protectedBody.includes("/local-sign-in")
  ) {
    throw new Error(
      `Protected product pages did not require local sign-in (${protectedPage.status}, ${protectedPage.headers.get("location")}).`,
    )
  }

  const health = await (await expectStatus("/api/system/health")).json()
  if (
    health.status !== "ready" ||
    health.runtime?.mode !== "mock" ||
    health.runtime?.infrastructureFree !== true
  ) {
    throw new Error("Local health response did not report ready mock mode.")
  }

  const quote = await fetch(`${origin}/api/credits/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      minutes: 60,
      targetLanguages: 2,
      translatedAudio: true,
      presentationContext: true,
      postSessionSummary: true,
    }),
  })
  if (!quote.ok || !(await quote.json()).quote?.total) {
    throw new Error("Credit quote smoke test failed.")
  }

  const signIn = await fetch(`${origin}/api/auth/local`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
  })
  const organizerCookie = signIn.headers.get("set-cookie")?.split(";")[0]
  if (signIn.status !== 201 || !organizerCookie) {
    throw new Error(
      `Local organizer sign-in smoke test failed (${signIn.status}, ${await signIn.text()}).`,
    )
  }
  const identityResponse = await fetch(`${origin}/api/auth/session`, {
    headers: { Cookie: organizerCookie },
  })
  const identity = (await identityResponse.json()) as {
    csrfToken?: string
  }
  if (!identityResponse.ok || !identity.csrfToken) {
    throw new Error("Organizer session did not return a CSRF token.")
  }
  const organizerHeaders = {
    "Content-Type": "application/json",
    Cookie: organizerCookie,
    Origin: origin,
    "x-csrf-token": identity.csrfToken,
  }

  const topUp = await fetch(`${origin}/api/credits/top-up`, {
    method: "POST",
    headers: organizerHeaders,
    body: JSON.stringify({ credits: 1000 }),
  })
  if (
    topUp.status !== 201 ||
    (await topUp.json()).receipt?.status !== "simulated"
  ) {
    throw new Error("Mock top-up smoke test failed.")
  }

  const createSession = await fetch(`${origin}/api/sessions`, {
    method: "POST",
    headers: organizerHeaders,
    body: JSON.stringify({
      name: "Local acceptance session",
      sourceLanguage: "Kannada",
      targetLanguages: ["English", "Hindi"],
      expectedMinutes: 30,
      translatedAudio: true,
    }),
  })
  const created = (await createSession.json()) as {
    session?: { id: string; joinCode: string }
  }
  if (createSession.status !== 201 || !created.session) {
    throw new Error("Session creation smoke test failed.")
  }

  const presentationForm = new FormData()
  presentationForm.set(
    "file",
    new File(
      ["Retrieval augmented generation\nPreserve vector database terminology."],
      "acceptance-context.txt",
      { type: "text/plain" },
    ),
  )
  const presentationResponse = await fetch(
    `${origin}/api/sessions/${created.session.id}/assets`,
    {
      method: "POST",
      headers: {
        Cookie: organizerCookie,
        Origin: origin,
        "x-csrf-token": identity.csrfToken,
      },
      body: presentationForm,
    },
  )
  const presentation = (await presentationResponse.json()) as {
    asset?: { scanStatus?: string; extractedText?: string }
  }
  if (
    presentationResponse.status !== 201 ||
    presentation.asset?.scanStatus !== "clean" ||
    !presentation.asset.extractedText?.includes("vector database")
  ) {
    throw new Error(
      `Presentation validation and extraction failed (${presentationResponse.status}, ${JSON.stringify(presentation)}).`,
    )
  }

  const malwareForm = new FormData()
  malwareForm.set(
    "file",
    new File(
      [
        "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!",
      ],
      "blocked-context.txt",
      { type: "text/plain" },
    ),
  )
  const malwareResponse = await fetch(
    `${origin}/api/sessions/${created.session.id}/assets`,
    {
      method: "POST",
      headers: {
        Cookie: organizerCookie,
        Origin: origin,
        "x-csrf-token": identity.csrfToken,
      },
      body: malwareForm,
    },
  )
  const malwareBody = (await malwareResponse.json()) as { error?: string }
  if (
    malwareResponse.status !== 422 ||
    !malwareBody.error?.includes("malware")
  ) {
    throw new Error(
      `Malware rejection smoke test failed (${malwareResponse.status}, ${JSON.stringify(malwareBody)}).`,
    )
  }

  const contextResponse = await fetch(
    `${origin}/api/sessions/${created.session.id}`,
    {
      method: "PATCH",
      headers: organizerHeaders,
      body: JSON.stringify({
        operation: "context",
        glossary: [{ source: "embedding", preferred: "embedding" }],
        notes: "Local acceptance context",
      }),
    },
  )
  if (!contextResponse.ok) {
    throw new Error("Session context smoke test failed.")
  }

  const startResponse = await fetch(
    `${origin}/api/sessions/${created.session.id}`,
    {
      method: "PATCH",
      headers: organizerHeaders,
      body: JSON.stringify({ operation: "transition", action: "start" }),
    },
  )
  if (!startResponse.ok) {
    throw new Error("Session start and credit reservation failed.")
  }

  const joinResponse = await fetch(
    `${origin}/api/join/${created.session.joinCode}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
    },
  )
  const attendeeCookie = joinResponse.headers.get("set-cookie")?.split(";")[0]
  if (joinResponse.status !== 201 || !attendeeCookie) {
    throw new Error("Attendee join smoke test failed.")
  }

  const captionResponse = await fetch(
    `${origin}/api/sessions/${created.session.id}/segments`,
    {
      method: "POST",
      headers: organizerHeaders,
      body: JSON.stringify({}),
    },
  )
  const caption = (await captionResponse.json()) as {
    segment?: { id: string; translations: { English?: string } }
  }
  if (
    captionResponse.status !== 201 ||
    !caption.segment?.translations.English
  ) {
    throw new Error("Live caption delivery smoke test failed.")
  }

  const attendeeSnapshot = await fetch(
    `${origin}/api/join/${created.session.joinCode}/snapshot`,
    { headers: { Cookie: attendeeCookie } },
  )
  const attendeeBody = (await attendeeSnapshot.json()) as {
    session?: { segments?: unknown[] }
  }
  if (
    !attendeeSnapshot.ok ||
    attendeeBody.session?.segments?.length !== 1
  ) {
    throw new Error("Attendee caption polling smoke test failed.")
  }

  const correctionResponse = await fetch(
    `${origin}/api/sessions/${created.session.id}/segments/${caption.segment.id}`,
    {
      method: "PATCH",
      headers: organizerHeaders,
      body: JSON.stringify({ sourceText: "Corrected local caption." }),
    },
  )
  if (!correctionResponse.ok) {
    throw new Error("Caption correction smoke test failed.")
  }

  const stopResponse = await fetch(
    `${origin}/api/sessions/${created.session.id}`,
    {
      method: "PATCH",
      headers: organizerHeaders,
      body: JSON.stringify({ operation: "transition", action: "stop" }),
    },
  )
  const stopped = (await stopResponse.json()) as {
    session?: { status: string; consumedCredits: number }
  }
  if (
    !stopResponse.ok ||
    stopped.session?.status !== "completed" ||
    !stopped.session.consumedCredits
  ) {
    throw new Error("Credit settlement smoke test failed.")
  }

  const artifactResponse = await fetch(
    `${origin}/api/sessions/${created.session.id}/artifacts?format=vtt`,
    { headers: { Cookie: organizerCookie } },
  )
  if (
    !artifactResponse.ok ||
    !(await artifactResponse.text()).startsWith("WEBVTT")
  ) {
    throw new Error("Post-session artifact smoke test failed.")
  }

  console.log(
    "Local smoke test passed: auth, presentation scan/extraction and malware rejection, session creation, reservation, attendee join, captions, correction, settlement, and artifacts.",
  )
}

async function main() {
  try {
    await run()
  } finally {
    server.kill("SIGTERM")
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
