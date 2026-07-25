import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { productRuntime } from "@/lib/runtime/product-runtime"
import { currentOrganizerSession } from "@/lib/server/request-security"

export default async function ProductLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await currentOrganizerSession()
  if (!session) {
    redirect(
      productRuntime().mode === "mock" ? "/local-sign-in" : "/sign-in",
    )
  }

  return (
    <AppShell
      workspaceName={session.identity.workspaceName}
      localMode={productRuntime().mode === "mock"}
    >
      {children}
    </AppShell>
  )
}
