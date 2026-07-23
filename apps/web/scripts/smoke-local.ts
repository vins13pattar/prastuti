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

  await expectStatus("/")
  await expectStatus("/dashboard")
  await expectStatus("/credits")

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

  const topUp = await fetch(`${origin}/api/credits/top-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credits: 1000 }),
  })
  if (
    topUp.status !== 201 ||
    (await topUp.json()).receipt?.status !== "simulated"
  ) {
    throw new Error("Mock top-up smoke test failed.")
  }

  console.log(
    "Local smoke test passed: product pages, health, quote, and mock top-up.",
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
