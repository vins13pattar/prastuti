"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, CheckCircle2, LoaderCircle, WalletCards } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCredits } from "@/lib/credits"
import { organizerApi } from "@/lib/client/api"

type TopUpReceipt = {
  id: string
  credits: number
  loadedAt: string
  expiresAt: string
  status: "simulated"
}

export function TopUpDialog() {
  const router = useRouter()
  const [credits, setCredits] = useState("5000")
  const [receipt, setReceipt] = useState<TopUpReceipt | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setReceipt(null)

    try {
      const body = await organizerApi<{ receipt: TopUpReceipt }>(
        "/api/credits/top-up",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: Number(credits) }),
        },
      )

      setReceipt(body.receipt)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The credit load could not be created.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <WalletCards className="size-4" aria-hidden="true" />
          Load credits
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Load prepaid credits</DialogTitle>
          <DialogDescription>
            Every credit lot expires 365 days after it is loaded. This demo does not process payment.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="top-up-credits">Credits to load</Label>
            <Input
              id="top-up-credits"
              type="number"
              min={500}
              max={100000}
              step={100}
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minimum load: 500 credits. Taxes and the payment receipt are handled at checkout.
            </p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Credit load unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {receipt && (
            <Alert className="border-primary/30 bg-primary/6">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              <AlertTitle>{formatCredits(receipt.credits)} credits prepared</AlertTitle>
              <AlertDescription className="space-y-1">
                <span className="flex items-center gap-2">
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  Expires {new Date(receipt.expiresAt).toLocaleString("en-IN")}
                </span>
                <span className="block">Demo receipt: {receipt.id.slice(0, 8)}</span>
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  Preparing
                </>
              ) : (
                "Continue to payment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
