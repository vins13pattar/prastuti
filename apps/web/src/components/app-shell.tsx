"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AudioLines,
  CirclePlus,
  Gauge,
  Menu,
  WalletCards,
} from "lucide-react"

import { Brand } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const navigation = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/sessions/new", label: "New session", icon: CirclePlus },
  { href: "/credits", label: "Credits", icon: WalletCards },
]

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="grid gap-1" aria-label="Product navigation">
      {navigation.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              mobile && "py-3",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({
  children,
  workspaceName,
  localMode,
}: {
  children: React.ReactNode
  workspaceName: string
  localMode: boolean
}) {
  return (
    <TooltipProvider>
      <div className="min-h-[100dvh] bg-muted/30">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-background p-5 lg:block">
          <Brand />
          <div className="mt-8">
            <Navigation />
          </div>
          <div className="absolute inset-x-5 bottom-5 rounded-xl border border-border bg-muted/45 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AudioLines className="size-4 text-primary" aria-hidden="true" />
              {localMode ? "Local workspace" : "Managed workspace"}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {localMode
                ? "Infra-free mode uses deterministic speech and payment adapters."
                : "Production adapters are selected from environment configuration."}
            </p>
          </div>
        </aside>
        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 border-b border-border bg-background/92 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      aria-label="Open navigation"
                    >
                      <Menu className="size-5" aria-hidden="true" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72">
                    <SheetHeader className="border-b border-border">
                      <SheetTitle>
                        <Brand />
                      </SheetTitle>
                    </SheetHeader>
                    <div className="p-4">
                      <Navigation mobile />
                    </div>
                  </SheetContent>
                </Sheet>
                <p className="hidden text-sm text-muted-foreground sm:block">
                  {workspaceName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button asChild size="sm">
                  <Link href="/sessions/new">Create session</Link>
                </Button>
              </div>
            </div>
          </header>
          <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  )
}
