import type { Metadata } from "next"

import { LocalSignIn } from "@/components/auth/local-sign-in"
import { Brand } from "@/components/brand"

export const metadata: Metadata = {
  title: "Local workspace",
}

export default function LocalSignInPage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-muted/35 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <Brand />
        </div>
        <LocalSignIn />
      </div>
    </main>
  )
}
