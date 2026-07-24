import { CalendarClock, Layers3, ShieldCheck, WalletCards } from "lucide-react"

import { CreditEstimator } from "@/components/credits/credit-estimator"
import { TopUpDialog } from "@/components/credits/top-up-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCredits } from "@/lib/credits"
import { workspaceSnapshot } from "@/lib/server/product-store"
import { currentOrganizerSession } from "@/lib/server/request-security"

export const dynamic = "force-dynamic"

export default async function CreditsPage() {
  const organizer = await currentOrganizerSession()
  if (!organizer) return null
  const wallet = workspaceSnapshot(organizer.identity).wallet

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Credits</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Pay only for what runs.
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Load prepaid credits, reserve an estimate, then settle actual usage
            after each session.
          </p>
        </div>
        <TopUpDialog />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-primary/25">
          <CardContent className="flex min-h-48 flex-col justify-between p-7">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm text-muted-foreground">
                  Available balance
                </p>
                <p className="mt-3 font-mono text-5xl font-semibold tracking-tight">
                  {formatCredits(wallet.availableCredits)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  credits · {formatCredits(wallet.reservedCredits)} reserved
                </p>
              </div>
              <WalletCards className="size-7 text-primary" aria-hidden="true" />
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              Earliest-expiring credits are reserved and consumed first.
            </p>
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {[
            {
              icon: CalendarClock,
              title: "365 day validity",
              copy: "Each load has its own expiry date.",
            },
            {
              icon: ShieldCheck,
              title: "No negative balance",
              copy: "A sufficient reservation is required to start.",
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardContent className="flex gap-4 p-5">
                <item.icon
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.copy}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Active credit lots</CardTitle>
              <CardDescription>
                Every load keeps a separate validity window.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              <Layers3 className="size-3.5" aria-hidden="true" />
              {wallet.lots.length} {wallet.lots.length === 1 ? "lot" : "lots"}
            </Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loaded</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallet.lots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell>
                      {new Date(lot.loadedAt).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>
                      {new Date(lot.expiresAt).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCredits(lot.reservedCredits)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCredits(lot.remainingCredits)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <CreditEstimator />
      </div>
    </div>
  )
}
