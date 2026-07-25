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
  status: "simulated" | "pending"
}

type RazorpayCheckout = {
  provider: "razorpay"
  key: string
  orderId: string
  amount: number
  currency: string
  credits: number
}

type RazorpayResult = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string
      amount: number
      currency: string
      name: string
      description: string
      order_id: string
      handler: (result: RazorpayResult) => void
      modal: { ondismiss: () => void }
      theme: { color: string }
    }) => { open: () => void }
  }
}

function loadRazorpayCheckoutScript() {
  if (window.Razorpay) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    )
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener(
        "error",
        () => reject(new Error("Razorpay Checkout could not be loaded.")),
        { once: true },
      )
      return
    }
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    script.referrerPolicy = "strict-origin"
    script.addEventListener("load", () => resolve(), { once: true })
    script.addEventListener(
      "error",
      () => reject(new Error("Razorpay Checkout could not be loaded.")),
      { once: true },
    )
    document.head.append(script)
  })
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
      const body = await organizerApi<{
        receipt?: TopUpReceipt
        checkout?: RazorpayCheckout
      }>(
        "/api/credits/top-up",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: Number(credits) }),
        },
      )

      if (body.receipt) {
        setReceipt(body.receipt)
        router.refresh()
        return
      }
      if (!body.checkout) {
        throw new Error("The payment checkout response was incomplete.")
      }
      await loadRazorpayCheckoutScript()
      if (!window.Razorpay) {
        throw new Error("Razorpay Checkout is unavailable.")
      }
      const checkout = body.checkout
      const modal = new window.Razorpay({
        key: checkout.key,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "Prastuti",
        description: `${formatCredits(checkout.credits)} prepaid credits`,
        order_id: checkout.orderId,
        handler: (result) => {
          void organizerApi<{ status: string }>(
            "/api/payments/razorpay/verify",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            },
          )
            .then(() => {
              const loadedAt = new Date()
              const expiresAt = new Date(loadedAt)
              expiresAt.setUTCDate(expiresAt.getUTCDate() + 365)
              setReceipt({
                id: checkout.orderId,
                credits: checkout.credits,
                loadedAt: loadedAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
                status: "pending",
              })
              router.refresh()
            })
            .catch((verificationError: unknown) => {
              setError(
                verificationError instanceof Error
                  ? verificationError.message
                  : "Payment verification failed.",
              )
            })
            .finally(() => setLoading(false))
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
        theme: { color: "#4f46e5" },
      })
      modal.open()
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
            Every confirmed payment creates its own credit lot, expiring 365
            days after reconciliation. Local mock mode simulates confirmation.
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
                  {receipt.status === "pending"
                    ? "Payment verified; credits appear after signed webhook reconciliation."
                    : `Expires ${new Date(receipt.expiresAt).toLocaleString("en-IN")}`}
                </span>
                <span className="block">
                  {receipt.status === "simulated" ? "Demo" : "Order"} receipt:{" "}
                  {receipt.id.slice(0, 16)}
                </span>
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
