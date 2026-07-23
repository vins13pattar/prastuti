import Link from "next/link"
import { AudioLines } from "lucide-react"

import { cn } from "@/lib/utils"

export function Brand({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2.5 font-semibold tracking-tight",
        className,
      )}
      aria-label="Prastuti home"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_8px_24px_oklch(0.52_0.14_42_/_0.18)]">
        <AudioLines className="size-[18px]" strokeWidth={2} />
      </span>
      {!compact && <span className="text-lg">Prastuti</span>}
    </Link>
  )
}
