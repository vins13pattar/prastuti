import { SignUp } from "@clerk/nextjs"
import { redirect } from "next/navigation"

import { productRuntime } from "@/lib/runtime/product-runtime"

export const dynamic = "force-dynamic"

export default function ManagedSignUpPage() {
  if (productRuntime().mode === "mock") redirect("/local-sign-in")
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    redirect("/sign-in")
  }
  return (
    <main className="grid min-h-[100dvh] place-items-center p-6">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
      />
    </main>
  )
}
