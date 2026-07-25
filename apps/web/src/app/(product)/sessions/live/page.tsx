import type { Metadata } from "next"

import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Live console",
}

export default function LiveSessionPage() {
  redirect("/dashboard")
}
