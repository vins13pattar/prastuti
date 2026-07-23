import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import * as schema from "@/db/schema"

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required when a route performs a persistent database operation.",
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
