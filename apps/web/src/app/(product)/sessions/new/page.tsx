import type { Metadata } from "next"

import { SessionBuilder } from "@/components/sessions/session-builder"

export const metadata: Metadata = {
  title: "Create session",
}

export default function NewSessionPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <p className="text-sm font-medium text-primary">New session</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Prepare a multilingual room.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Set the source, choose up to three listener languages, and review the
          estimated credit reservation before you go live.
        </p>
      </div>
      <SessionBuilder />
    </div>
  )
}
