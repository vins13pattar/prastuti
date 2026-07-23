import type { Metadata } from "next"

import { LiveConsole } from "@/components/sessions/live-console"

export const metadata: Metadata = {
  title: "Live console",
}

export default function LiveSessionPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <p className="text-sm font-medium text-primary">Live console</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Session control room.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Preview presenter input, translated captions, language channels, and
          the reserved wallet balance.
        </p>
      </div>
      <LiveConsole />
    </div>
  )
}
