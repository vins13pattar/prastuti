"use client"

import { FormEvent, useState } from "react"
import { Calculator, LoaderCircle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCredits, type CreditQuote } from "@/lib/credits"

export function CreditEstimator() {
  const [minutes, setMinutes] = useState("60")
  const [targetLanguages, setTargetLanguages] = useState("3")
  const [translatedAudio, setTranslatedAudio] = useState("yes")
  const [quote, setQuote] = useState<CreditQuote | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/credits/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: Number(minutes),
          targetLanguages: Number(targetLanguages),
          translatedAudio: translatedAudio === "yes",
          presentationContext: true,
          postSessionSummary: true,
        }),
      })

      const body = (await response.json()) as {
        quote?: CreditQuote
        error?: string
      }

      if (!response.ok || !body.quote) {
        throw new Error(body.error ?? "The quote could not be calculated.")
      }

      setQuote(body.quote)
    } catch (caught) {
      setQuote(null)
      setError(
        caught instanceof Error
          ? caught.message
          : "The quote could not be calculated.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-5 text-primary" aria-hidden="true" />
          Estimate session credits
        </CardTitle>
        <CardDescription>
          Sample rates are transparent and configurable. Final usage settles from actual metered minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="minutes">Expected duration in minutes</Label>
            <Input
              id="minutes"
              name="minutes"
              type="number"
              min={1}
              max={480}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="target-languages">Target languages</Label>
            <Select value={targetLanguages} onValueChange={setTargetLanguages}>
              <SelectTrigger id="target-languages">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 language</SelectItem>
                <SelectItem value="2">2 languages</SelectItem>
                <SelectItem value="3">3 languages</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="translated-audio">Translated audio</Label>
            <Select value={translatedAudio} onValueChange={setTranslatedAudio}>
              <SelectTrigger id="translated-audio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Audio and captions</SelectItem>
                <SelectItem value="no">Captions only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Calculating
              </>
            ) : (
              "Calculate quote"
            )}
          </Button>
        </form>

        {error && (
          <Alert variant="destructive" className="mt-5">
            <AlertTitle>Quote unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {quote && (
          <div className="mt-6 rounded-xl border border-primary/25 bg-primary/6 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Estimated reservation</p>
                <p className="mt-1 font-mono text-3xl font-semibold tracking-tight">
                  {formatCredits(quote.total)}
                </p>
                <p className="text-sm text-muted-foreground">credits</p>
              </div>
              <p className="max-w-48 text-right text-xs leading-relaxed text-muted-foreground">
                Unused reserved credits return to the same credit lots after settlement.
              </p>
            </div>
            <dl className="mt-5 grid gap-2 border-t border-primary/15 pt-4 text-sm">
              {[
                ["Source captions", quote.sourceCaptions],
                ["Translation", quote.translation],
                ["Translated audio", quote.translatedAudio],
                ["Context and summary", quote.presentationContext + quote.postSessionSummary],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-mono">{formatCredits(Number(value))}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
