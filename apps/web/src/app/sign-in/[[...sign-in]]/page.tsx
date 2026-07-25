import { SignIn } from "@clerk/nextjs"
import { redirect } from "next/navigation"

import { productRuntime } from "@/lib/runtime/product-runtime"

export const dynamic = "force-dynamic"

export default function ManagedSignInPage() {
  if (productRuntime().mode === "mock") redirect("/local-sign-in")
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="grid min-h-[100dvh] place-items-center p-6">
        <div className="max-w-md rounded-2xl border bg-card p-7 text-center">
          <h1 className="text-2xl font-semibold">Identity is not configured</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This managed deployment is intentionally closed until its Clerk
            publishable and secret keys are configured.
          </p>
        </div>
      </main>
    )
  }
  return (
    <main className="grid min-h-[100dvh] place-items-center p-6">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
      />
    </main>
  )
}
