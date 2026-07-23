import Link from "next/link"

import { Brand } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Brand />
        <nav
          className="hidden items-center gap-7 text-sm text-muted-foreground md:flex"
          aria-label="Primary navigation"
        >
          <Link className="transition-colors hover:text-foreground" href="#product">
            Product
          </Link>
          <Link className="transition-colors hover:text-foreground" href="#credits">
            Credits
          </Link>
          <Link className="transition-colors hover:text-foreground" href="#architecture">
            Architecture
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild className="hidden whitespace-nowrap sm:inline-flex">
            <Link href="/dashboard">Open product</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
