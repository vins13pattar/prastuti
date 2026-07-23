import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="grid min-h-[75dvh] place-items-center px-4">
      <div className="max-w-lg text-center">
        <p className="font-mono text-sm text-primary">404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          This room does not exist.
        </h1>
        <p className="mt-4 text-muted-foreground">
          The session may have ended, or the link may be incomplete.
        </p>
        <Button asChild className="mt-8">
          <Link href="/dashboard">Return to overview</Link>
        </Button>
      </div>
    </main>
  )
}
