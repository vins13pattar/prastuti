import type { Metadata } from "next"

import { AttendeeRoom } from "@/components/attendee/attendee-room"
import { Brand } from "@/components/brand"

export const metadata: Metadata = {
  title: "Join live captions",
}

type PageProps = {
  params: Promise<{ joinCode: string }>
}

export default async function JoinPage({ params }: PageProps) {
  const { joinCode } = await params
  return (
    <main className="min-h-[100dvh] bg-muted/35 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto mb-8 flex max-w-5xl items-center justify-between">
        <div>
          <Brand />
        </div>
        <p className="text-xs text-muted-foreground">Attendee view</p>
      </div>
      <div className="mx-auto flex max-w-5xl justify-center">
        <AttendeeRoom joinCode={joinCode.toUpperCase()} />
      </div>
    </main>
  )
}
