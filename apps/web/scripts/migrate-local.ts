import { resolve } from "node:path"

import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

config({ path: resolve(process.cwd(), ".env.local"), quiet: true })

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://prastuti:prastuti-local@127.0.0.1:54329/prastuti"

async function main() {
  const client = postgres(databaseUrl, { max: 1 })

  try {
    await migrate(drizzle(client), {
      migrationsFolder: resolve(process.cwd(), "drizzle"),
    })
    console.log("Local Prastuti database migrations are current.")
  } finally {
    await client.end()
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
