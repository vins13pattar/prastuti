"use client"

import { FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BookOpenText,
  Headphones,
  Languages,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { estimateCredits, formatCredits } from "@/lib/credits"
import { organizerApi } from "@/lib/client/api"
import type { ProductSession } from "@/lib/product/types"

const availableLanguages = ["Kannada", "English", "Hindi", "Telugu"]

export function SessionBuilder() {
  const router = useRouter()
  const [name, setName] = useState("MicroDegree GenAI Session")
  const [source, setSource] = useState("Kannada")
  const [targets, setTargets] = useState(["English", "Hindi", "Telugu"])
  const [minutes, setMinutes] = useState("60")
  const [glossary, setGlossary] = useState(
    "embeddings, embeddings\nvector database, vector database",
  )
  const [notes, setNotes] = useState(
    "Technical GenAI training. Preserve English technical terms when clearer.",
  )
  const [contextFileName, setContextFileName] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const quote = useMemo(
    () =>
      estimateCredits({
        minutes: Math.max(1, Number(minutes) || 1),
        targetLanguages: targets.length,
        translatedAudio: true,
        presentationContext: true,
        postSessionSummary: true,
      }),
    [minutes, targets.length],
  )

  function toggleTarget(language: string) {
    setTargets((current) => {
      if (current.includes(language)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== language)
      }
      return current.length >= 3 ? current : [...current, language]
    })
  }

  async function importContextFile(file: File | undefined) {
    if (!file) return
    setError("")
    if (file.size > 256 * 1024) {
      setError("Context files must be 256 KB or smaller.")
      return
    }
    const allowedTypes = ["text/plain", "text/csv"]
    if (
      !allowedTypes.includes(file.type) &&
      !file.name.toLowerCase().match(/\.(txt|csv)$/)
    ) {
      setError("Import a plain-text or CSV context file.")
      return
    }
    const text = await file.text()
    if (file.name.toLowerCase().endsWith(".csv")) {
      setGlossary(text.slice(0, 20_000))
    } else {
      setNotes(text.slice(0, 5_000))
    }
    setContextFileName(file.name)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!name.trim()) {
      setError("Give the session a name.")
      return
    }

    setError("")
    setPending(true)
    try {
      const created = await organizerApi<{ session: ProductSession }>(
        "/api/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            sourceLanguage: source,
            targetLanguages: targets,
            expectedMinutes: Number(minutes),
            translatedAudio: true,
          }),
        },
      )
      const glossaryItems = glossary
        .split("\n")
        .map((line) => line.split(",").map((part) => part.trim()))
        .filter(
          (parts): parts is [string, string] =>
            Boolean(parts[0]) && Boolean(parts[1]),
        )
        .map(([sourceTerm, preferred]) => ({
          source: sourceTerm,
          preferred,
        }))
      await organizerApi(`/api/sessions/${created.session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "context",
          glossary: glossaryItems,
          notes,
        }),
      })
      router.push(`/sessions/${created.session.id}/live`)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The session could not be created.",
      )
      setPending(false)
    }
  }

  return (
    <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Session setup</CardTitle>
          <CardDescription>
            Configure the languages and expected duration. Actual usage settles after the session.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="session-name">Session name</Label>
            <Input
              id="session-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="source-language">Presenter language</Label>
            <Select
              value={source}
              onValueChange={(value) => {
                setSource(value)
                setTargets((current) => {
                  const next = current.filter((language) => language !== value)
                  if (next.length > 0) return next
                  const fallback = availableLanguages.find(
                    (language) => language !== value,
                  )
                  return fallback ? [fallback] : current
                })
              }}
            >
              <SelectTrigger id="source-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages.map((language) => (
                  <SelectItem key={language} value={language}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Target languages</legend>
            <div className="flex flex-wrap gap-2">
              {availableLanguages
                .filter((language) => language !== source)
                .map((language) => {
                  const selected = targets.includes(language)
                  return (
                    <Button
                      key={language}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => toggleTarget(language)}
                      aria-pressed={selected}
                    >
                      {language}
                    </Button>
                  )
                })}
            </div>
            <p className="text-xs text-muted-foreground">
              Select one to three output languages.
            </p>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor="expected-minutes">Expected duration</Label>
            <Input
              id="expected-minutes"
              type="number"
              min={1}
              max={480}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </div>
          <div className="grid gap-4 rounded-xl border border-dashed border-border p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
                <BookOpenText
                  className="size-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </span>
              <div>
                <p className="font-medium">Presentation context</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Add terminology and session notes. These are applied to the
                  deterministic local translator and included in the reserved
                  context meter.
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="context-file">
                Import local context (TXT or CSV)
              </Label>
              <Input
                id="context-file"
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                onChange={(event) =>
                  void importContextFile(event.target.files?.[0])
                }
              />
              <p className="text-xs text-muted-foreground">
                Processed in this browser, limited to 256 KB, and never served
                back as active content.
                {contextFileName ? ` Imported ${contextFileName}.` : ""}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="glossary">Glossary, one pair per line</Label>
              <textarea
                id="glossary"
                className="min-h-24 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={glossary}
                onChange={(event) => setGlossary(event.target.value)}
                placeholder="source term, preferred translation"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="session-notes">Context notes</Label>
              <textarea
                id="session-notes"
                className="min-h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={5000}
              />
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Session needs attention</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-primary/25">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Estimated reservation
            </Badge>
            <CardTitle className="font-mono text-4xl">
              {formatCredits(quote.total)}
            </CardTitle>
            <CardDescription>credits for the configured session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Languages className="size-4" aria-hidden="true" />
                  Languages
                </span>
                <span>{targets.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Headphones className="size-4" aria-hidden="true" />
                  Delivery
                </span>
                <span>Audio + captions</span>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating session…" : "Create session"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The wallet reserves this estimate at start and returns unused credits after settlement.
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
