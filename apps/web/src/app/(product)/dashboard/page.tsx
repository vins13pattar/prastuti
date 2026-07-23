import Link from "next/link"
import { ArrowRight, CalendarClock, Radio, WalletCards } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { demoCreditLots, recentSessions, usageByMeter } from "@/lib/sample-data"

export default function DashboardPage() {
  const balance = demoCreditLots.reduce(
    (total, lot) => total + lot.remainingCredits,
    0,
  )
  const used = usageByMeter.reduce((total, meter) => total + meter.credits, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Good afternoon, Vinod.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your demo workspace is ready for the next multilingual session.
          </p>
        </div>
        <Button asChild>
          <Link href="/sessions/new">
            Create session
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Available balance",
            value: formatCredits(balance),
            detail: "credits across 2 active lots",
            icon: WalletCards,
          },
          {
            label: "Usage this month",
            value: formatCredits(used),
            detail: "credits from 3 completed sessions",
            icon: Radio,
          },
          {
            label: "Next expiry",
            value: "12 Apr 2027",
            detail: "15,000 credits in the earliest lot",
            icon: CalendarClock,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-3 font-mono text-3xl font-semibold tracking-tight">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <stat.icon className="size-5" aria-hidden="true" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Recent sessions</CardTitle>
              <CardDescription>Settled usage from the demo workspace.</CardDescription>
            </div>
            <Badge variant="secondary">Sample data</Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Attendees</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <p className="font-medium">{session.name}</p>
                      <p className="text-xs text-muted-foreground">{session.date}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {session.source} to {session.targets}
                    </TableCell>
                    <TableCell>{session.attendees}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCredits(session.credits)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage by meter</CardTitle>
            <CardDescription>July 2026 demo consumption.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {usageByMeter.map((item) => (
              <div key={item.meter}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{item.meter}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm">{formatCredits(item.credits)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(12, (item.credits / used) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
