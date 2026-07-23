"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-[70dvh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-primary">Something went wrong</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          This screen could not be prepared.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Your wallet and session data have not been changed. Try loading the
          screen again.
        </p>
        <Button className="mt-7" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  )
}
