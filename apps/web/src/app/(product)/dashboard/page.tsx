import Link from "next/link"
import {
  ArrowRight,
  CalendarClock,
  Radio,
  WalletCards,
} from "lucide-react"

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
import { workspaceSnapshot } from "@/lib/server/product-store"
import { currentOrganizerSession } from "@/lib/server/request-security"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const organizer = await currentOrganizerSession()
  if (!organizer) return null
  const workspace = workspaceSnapshot(organizer.identity)
  const used = workspace.sessions.reduce(
    (total, session) => total + session.consumedCredits,
    0,
  )
  const expiry = workspace.wallet.expiresAt
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
        new Date(workspace.wallet.expiresAt),
      )
    : "No active credits"

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {workspace.identity.workspaceName}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Sessions, live delivery, and wallet settlement now use the local
            product APIs.
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
            value: formatCredits(workspace.wallet.availableCredits),
            detail: `${formatCredits(workspace.wallet.reservedCredits)} credits reserved`,
            icon: WalletCards,
          },
          {
            label: "Settled usage",
            value: formatCredits(used),
            detail: `${workspace.sessions.filter((session) => session.status === "completed").length} completed sessions`,
            icon: Radio,
          },
          {
            label: "Next expiry",
            value: expiry,
            detail: "Credits expire 365 days after loading",
            icon: CalendarClock,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-3 font-mono text-2xl font-semibold tracking-tight">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.detail}
                  </p>
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <stat.icon className="size-5" aria-hidden="true" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>
              Draft, active, and completed rooms in this local process.
            </CardDescription>
          </div>
          <Badge variant="secondary">Local adapter</Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {workspace.sessions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attendees</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:text-primary"
                        href={`/sessions/${session.id}/live`}
                      >
                        {session.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("en-IN", {
                          dateStyle: "medium",
                        }).format(new Date(session.createdAt))}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {session.sourceLanguage} to{" "}
                      {session.targetLanguages.join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          session.status === "live" ? "default" : "secondary"
                        }
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{session.attendeeCount}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCredits(
                        session.consumedCredits || session.reservedCredits,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid min-h-48 place-items-center rounded-xl border border-dashed text-center">
              <div>
                <p className="font-medium">No sessions yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a room to exercise the local end-to-end flow.
                </p>
                <Button asChild className="mt-4" size="sm">
                  <Link href="/sessions/new">Create first session</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
