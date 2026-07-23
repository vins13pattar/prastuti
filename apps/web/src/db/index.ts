import "server-only"

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "@/db/schema"

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL
  const driver = process.env.DATABASE_DRIVER ?? "neon-http"

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required when a route performs a persistent database operation.",
    )
  }

  if (driver === "postgres-js") {
    const client = postgres(databaseUrl, { max: 1 })
    return drizzlePostgres(client, { schema })
  }

  if (driver !== "neon-http") {
    throw new Error(
      "DATABASE_DRIVER must be either neon-http or postgres-js.",
    )
  }

  return drizzle(neon(databaseUrl), { schema })
}

let database: ReturnType<typeof createDatabase> | null = null

export function getDatabase() {
  if (!database) {
    database = createDatabase()
  }

  return database
}
