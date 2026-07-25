"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Realtime } from "ably"
import {
  Captions,
  Headphones,
  Languages,
  Radio,
  Volume2,
  VolumeX,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  CaptionSegment,
  SessionStatus,
  SupportedLanguage,
} from "@/lib/product/types"
import { cn } from "@/lib/utils"

type PublicSession = {
  name: string
  joinCode: string
  sourceLanguage: SupportedLanguage
  targetLanguages: SupportedLanguage[]
  status: SessionStatus
}

type RoomSnapshot = {
  name: string
  status: SessionStatus
  sourceLanguage: SupportedLanguage
  targetLanguages: SupportedLanguage[]
  segments: CaptionSegment[]
  endedAt?: string
  artifacts: null | {
    transcript: string
    summary: string
    keyPoints: string[]
  }
}

const speechLocales: Record<SupportedLanguage, string> = {
  Kannada: "kn-IN",
  English: "en-IN",
  Hindi: "hi-IN",
  Telugu: "te-IN",
}

function isCaptionSegment(value: unknown): value is CaptionSegment {
  if (!value || typeof value !== "object") return false
  const segment = value as Partial<CaptionSegment>
  return (
    typeof segment.id === "string" &&
    typeof segment.sequence === "number" &&
    typeof segment.sourceText === "string" &&
    Boolean(segment.translations) &&
    typeof segment.translations === "object"
  )
}

export function AttendeeRoom({
  joinCode,
  managedProviders,
}: {
  joinCode: string
  managedProviders: boolean
}) {
  const [session, setSession] = useState<PublicSession | null>(null)
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [joined, setJoined] = useState(false)
  const [attendeeCsrfToken, setAttendeeCsrfToken] = useState("")
  const [providerSessionId, setProviderSessionId] = useState("")
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedLanguage | null>(null)
  const [showSource, setShowSource] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xl">("large")
  const [error, setError] = useState("")
  const spokenSequence = useRef(0)
  const managedAudio = useRef<HTMLAudioElement | null>(null)
  const realtimeClient = useRef<Realtime | null>(null)

  useEffect(() => {
    void fetch(`/api/join/${joinCode}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as {
          session?: PublicSession
          error?: string
        }
        if (!response.ok || !body.session) {
          throw new Error(body.error ?? "Session not found.")
        }
        setSession(body.session)
        setSelectedLanguage(body.session.targetLanguages[0] ?? null)
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Session not found.",
        ),
      )
  }, [joinCode])

  const loadSnapshot = useCallback(async () => {
    const response = await fetch(`/api/join/${joinCode}/snapshot`, {
      cache: "no-store",
    })
    const body = (await response.json()) as {
      session?: RoomSnapshot
      error?: string
    }
    if (!response.ok || !body.session) {
      throw new Error(body.error ?? "Captions are unavailable.")
    }
    setSnapshot(body.session)
  }, [joinCode])

  useEffect(() => {
    if (!joined || snapshot?.status === "completed") return
    const initialLoad = window.setTimeout(() => {
      void loadSnapshot().catch((loadError: unknown) =>
        setError(
          loadError instanceof Error ? loadError.message : "Disconnected.",
        ),
      )
    }, 0)
    const interval = window.setInterval(() => {
      void loadSnapshot().catch(() => {
        setError("Reconnecting to the caption stream…")
      })
    }, realtimeConnected ? 15_000 : 1_200)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [joined, loadSnapshot, realtimeConnected, snapshot?.status])

  useEffect(() => {
    if (
      !managedProviders ||
      !joined ||
      !attendeeCsrfToken ||
      !providerSessionId ||
      snapshot?.status === "completed"
    ) {
      return
    }
    let disposed = false
    let client: Realtime | null = null
    const channelName = `session:${providerSessionId}`

    void (async () => {
      await loadSnapshot().catch(() => undefined)
      const Ably = await import("ably")
      if (disposed) return
      client = new Ably.Realtime({
        authCallback: (_tokenParams, callback) => {
          void fetch(`/api/providers/sessions/${providerSessionId}/token`, {
            method: "POST",
            headers: {
              "x-csrf-token": attendeeCsrfToken,
            },
            cache: "no-store",
          })
            .then(async (response) => {
              const body = (await response.json().catch(() => null)) as {
                realtime?: { tokenRequest?: Parameters<typeof callback>[1] }
                error?: string
              } | null
              if (!response.ok || !body?.realtime?.tokenRequest) {
                throw new Error(
                  body?.error ?? "Realtime authorization failed.",
                )
              }
              callback(null, body.realtime.tokenRequest)
            })
            .catch((authError: unknown) => {
              callback(
                authError instanceof Error
                  ? authError.message
                  : "Realtime authorization failed.",
                null,
              )
            })
        },
      })
      realtimeClient.current = client
      client.connection.on("connected", () => {
        setRealtimeConnected(true)
        setError("")
      })
      client.connection.on("disconnected", () => {
        setRealtimeConnected(false)
        setError("Reconnecting to the caption stream…")
      })
      client.connection.on("suspended", () => {
        setRealtimeConnected(false)
        setError("Realtime captions are delayed; polling is still active.")
      })
      client.connection.on("failed", () => {
        setRealtimeConnected(false)
        setError("Realtime captions are unavailable; polling is still active.")
      })
      const channel = client.channels.get(channelName)
      await channel.subscribe((message) => {
        if (!isCaptionSegment(message.data)) return
        const incoming = message.data
        setSnapshot((current) => {
          if (!current) return current
          const existingIndex = current.segments.findIndex(
            (segment) => segment.id === incoming.id,
          )
          const segments =
            existingIndex === -1
              ? [...current.segments, incoming]
              : current.segments.map((segment, index) =>
                  index === existingIndex ? incoming : segment,
                )
          return {
            ...current,
            segments: segments.sort(
              (left, right) => left.sequence - right.sequence,
            ),
          }
        })
      })
    })().catch(() => {
      setRealtimeConnected(false)
      setError("Realtime captions are unavailable; polling is still active.")
    })

    return () => {
      disposed = true
      setRealtimeConnected(false)
      client?.channels.get(channelName).unsubscribe()
      client?.close()
      if (realtimeClient.current === client) realtimeClient.current = null
    }
  }, [
    attendeeCsrfToken,
    joined,
    loadSnapshot,
    managedProviders,
    providerSessionId,
    snapshot?.status,
  ])

  useEffect(() => {
    if (!audioEnabled || !selectedLanguage || !snapshot) return
    const latest = snapshot.segments.at(-1)
    if (!latest || latest.sequence <= spokenSequence.current) return
    const text = latest.translations[selectedLanguage]
    if (!text) return
    const audioReference = latest.audioReferences?.[selectedLanguage]
    if (audioReference) {
      managedAudio.current?.pause()
      const audio = new Audio(audioReference)
      managedAudio.current = audio
      void audio.play().catch(() => {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = speechLocales[selectedLanguage]
        window.speechSynthesis.speak(utterance)
      })
      spokenSequence.current = latest.sequence
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = speechLocales[selectedLanguage]
    window.speechSynthesis.speak(utterance)
    spokenSequence.current = latest.sequence
  }, [audioEnabled, selectedLanguage, snapshot])

  async function joinSession() {
    setError("")
    const response = await fetch(`/api/join/${joinCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    const body = (await response.json().catch(() => null)) as {
      error?: string
      csrfToken?: string
      sessionId?: string
    } | null
    if (!response.ok) {
      setError(body?.error ?? "The room is not accepting attendees.")
      return
    }
    if (!body?.csrfToken || !body.sessionId) {
      setError("The attendee session was created without its security scope.")
      return
    }
    setAttendeeCsrfToken(body.csrfToken)
    setProviderSessionId(body.sessionId)
    setJoined(true)
  }

  function toggleAudio() {
    if (audioEnabled) {
      managedAudio.current?.pause()
      window.speechSynthesis.cancel()
      setAudioEnabled(false)
      return
    }
    setAudioEnabled(true)
    spokenSequence.current = Math.max(
      0,
      (snapshot?.segments.at(-1)?.sequence ?? 1) - 1,
    )
  }

  const latest = snapshot?.segments.at(-1)
  const translatedText =
    selectedLanguage && latest
      ? latest.translations[selectedLanguage]
      : undefined

  if (error && !session) {
    return (
      <Alert variant="destructive" className="max-w-xl">
        <AlertTitle>Room unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!session) {
    return <p className="text-sm text-muted-foreground">Finding the room…</p>
  }

  if (!joined) {
    return (
      <Card className="w-full max-w-xl border-primary/20 shadow-xl shadow-primary/5">
        <CardHeader>
          <Badge variant="secondary" className="mb-3 w-fit">
            {session.status}
          </Badge>
          <CardTitle>{session.name}</CardTitle>
          <CardDescription>
            Live captions from {session.sourceLanguage} into{" "}
            {session.targetLanguages.join(", ")}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert>
            <Captions className="size-4" aria-hidden="true" />
            <AlertTitle>Privacy notice</AlertTitle>
            <AlertDescription>
              Joining shares an anonymous attendee count with the organizer.
              Prastuti does not ask for your name or email to join this room.
            </AlertDescription>
          </Alert>
          <Button className="w-full" onClick={() => void joinSession()}>
            <Radio className="size-4" aria-hidden="true" />
            Join live captions
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-5xl space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant={snapshot?.status === "live" ? "default" : "secondary"}
            >
              {snapshot?.status ?? "connecting"}
            </Badge>
            {managedProviders && (
              <Badge variant={realtimeConnected ? "outline" : "secondary"}>
                {realtimeConnected ? "Realtime" : "Reconnecting"}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              Code {session.joinCode}
            </span>
          </div>
          <h1 className="mt-2 text-xl font-semibold">{session.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={selectedLanguage ?? undefined}
            onValueChange={(value) =>
              setSelectedLanguage(value as SupportedLanguage)
            }
          >
            <SelectTrigger className="w-40" aria-label="Caption language">
              <Languages className="size-4" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {session.targetLanguages.map((language) => (
                <SelectItem key={language} value={language}>
                  {language}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={audioEnabled ? "default" : "outline"}
            onClick={toggleAudio}
          >
            {audioEnabled ? (
              <Volume2 className="size-4" aria-hidden="true" />
            ) : (
              <VolumeX className="size-4" aria-hidden="true" />
            )}
            {audioEnabled ? "Audio on" : "Enable audio"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert>
          <Radio className="size-4" aria-hidden="true" />
          <AlertTitle>Connection update</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="grid min-h-[52vh] content-center gap-8 p-6 sm:p-10">
          {latest ? (
            <>
              {showSource && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {snapshot?.sourceLanguage}
                  </p>
                  <p
                    className={cn(
                      "mt-3 leading-relaxed text-muted-foreground",
                      fontSize === "normal" && "text-lg",
                      fontSize === "large" && "text-xl sm:text-2xl",
                      fontSize === "xl" && "text-2xl sm:text-3xl",
                    )}
                  >
                    {latest.sourceText}
                  </p>
                </div>
              )}
              <div className="rounded-2xl bg-primary/7 p-6 sm:p-8">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
                  {selectedLanguage}
                </p>
                <p
                  className={cn(
                    "mt-3 font-medium leading-relaxed",
                    fontSize === "normal" && "text-2xl",
                    fontSize === "large" && "text-3xl sm:text-4xl",
                    fontSize === "xl" && "text-4xl sm:text-5xl",
                  )}
                >
                  {translatedText}
                </p>
              </div>
            </>
          ) : (
            <div className="text-center">
              <Headphones
                className="mx-auto size-9 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="mt-4 text-xl font-medium">Waiting for the presenter</p>
              <p className="mt-2 text-muted-foreground">
                Captions will appear here automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSource((current) => !current)}
        >
          <Captions className="size-4" aria-hidden="true" />
          {showSource ? "Hide source" : "Show source"}
        </Button>
        {(["normal", "large", "xl"] as const).map((size) => (
          <Button
            key={size}
            variant={fontSize === size ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFontSize(size)}
          >
            {size === "xl" ? "Extra large" : size}
          </Button>
        ))}
      </div>

      {snapshot?.artifacts && (
        <Card>
          <CardHeader>
            <CardTitle>Session complete</CardTitle>
            <CardDescription>{snapshot.artifacts.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {snapshot.artifacts.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
