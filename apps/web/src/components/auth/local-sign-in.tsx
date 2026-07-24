"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, FlaskConical } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LocalSignIn() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function enterWorkspace() {
    setPending(true)
    setError("")
    try {
      const response = await fetch("/api/auth/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      if (!response.ok) {
        throw new Error(body?.error ?? "Local sign-in failed.")
      }
      router.replace("/dashboard")
      router.refresh()
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Local sign-in failed.",
      )
      setPending(false)
    }
  }

  return (
    <Card className="w-full max-w-lg border-primary/20 shadow-xl shadow-primary/5">
      <CardHeader>
        <span className="mb-3 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <FlaskConical className="size-5" aria-hidden="true" />
        </span>
        <CardTitle>Enter the local workspace</CardTitle>
        <CardDescription>
          Mock mode creates an eight-hour organizer session using an HttpOnly
          cookie. It has no password, external identity provider, or cloud
          dependency.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not enter the workspace</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button className="w-full" onClick={enterWorkspace} disabled={pending}>
          {pending ? "Opening workspace…" : "Continue locally"}
          {!pending && <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Local data is held in the Next.js process and resets when the
          development server restarts. Managed mode will use a production
          identity provider and persistent adapters.
        </p>
      </CardContent>
    </Card>
  )
}
