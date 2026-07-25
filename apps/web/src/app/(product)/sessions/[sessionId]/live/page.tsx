import type { Metadata } from "next"

import { LiveConsole } from "@/components/sessions/live-console"
import { productRuntime } from "@/lib/runtime/product-runtime"

export const metadata: Metadata = {
  title: "Live console",
}

type PageProps = {
  params: Promise<{ sessionId: string }>
}

export default async function LiveSessionPage({ params }: PageProps) {
  const { sessionId } = await params
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <p className="text-sm font-medium text-primary">Control room</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Present, monitor, and settle.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Run microphone preflight, deliver captions, share the attendee room,
          correct the transcript, and generate session outputs.
        </p>
      </div>
      <LiveConsole
        sessionId={sessionId}
        managedProviders={productRuntime().mode === "managed"}
      />
    </div>
  )
}
