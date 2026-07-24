"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import QRCode from "qrcode"
import {
  Captions,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  CircleStop,
  Download,
  Headphones,
  Mic2,
  QrCode,
  Radio,
  Sparkles,
  Users,
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
import { organizerApi } from "@/lib/client/api"
import type { ProductSession } from "@/lib/product/types"

type SpeechResult = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<SpeechResult>
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function speechRecognitionConstructor() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return (
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  )
}

const languageLocales = {
  Kannada: "kn-IN",
  English: "en-IN",
  Hindi: "hi-IN",
  Telugu: "te-IN",
} as const

export function LiveConsole({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<ProductSession | null>(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [manualCaption, setManualCaption] = useState("")
  const [correction, setCorrection] = useState("")
  const [joinLink, setJoinLink] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [microphoneState, setMicrophoneState] = useState<
    "unchecked" | "checking" | "ready" | "blocked"
  >("unchecked")
  const [microphoneLevel, setMicrophoneLevel] = useState(0)
  const [browserSpeechActive, setBrowserSpeechActive] = useState(false)
  const mediaStream = useRef<MediaStream | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const animationFrame = useRef<number | null>(null)
  const recognition = useRef<SpeechRecognitionLike | null>(null)

  const loadSession = useCallback(async () => {
    try {
      const response = await organizerApi<{ session: ProductSession }>(
        `/api/sessions/${sessionId}`,
      )
      setSession(response.session)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "The session could not be loaded.",
      )
    }
  }, [sessionId])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadSession(), 0)
    const interval = window.setInterval(() => void loadSession(), 1500)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [loadSession])

  useEffect(() => {
    if (!session?.joinCode) return
    const link = `${window.location.origin}/join/${session.joinCode}`
    void QRCode.toDataURL(link, {
      width: 220,
      margin: 1,
      color: { dark: "#111827", light: "#ffffff" },
    }).then((dataUrl) => {
      setJoinLink(link)
      setQrDataUrl(dataUrl)
    })
  }, [session?.joinCode])

  useEffect(
    () => () => {
      recognition.current?.stop()
      mediaStream.current?.getTracks().forEach((track) => track.stop())
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
      void audioContext.current?.close()
    },
    [],
  )

  async function checkMicrophone() {
    setMicrophoneState("checking")
    setError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStream.current?.getTracks().forEach((track) => track.stop())
      mediaStream.current = stream
      const context = new AudioContext()
      audioContext.current = context
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const samples = new Uint8Array(analyser.frequencyBinCount)
      const measure = () => {
        analyser.getByteFrequencyData(samples)
        const average =
          samples.reduce((total, sample) => total + sample, 0) / samples.length
        setMicrophoneLevel(Math.min(100, Math.round(average * 1.7)))
        animationFrame.current = requestAnimationFrame(measure)
      }
      measure()
      setMicrophoneState("ready")
    } catch {
      setMicrophoneState("blocked")
      setError(
        "Microphone access was blocked or unavailable. You can still run the deterministic local caption demo.",
      )
    }
  }

  async function transition(action: "start" | "pause" | "resume" | "stop") {
    setPending(true)
    setError("")
    try {
      const response = await organizerApi<{ session: ProductSession }>(
        `/api/sessions/${sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "transition", action }),
        },
      )
      setSession(response.session)
      if (action === "stop") {
        recognition.current?.stop()
        setBrowserSpeechActive(false)
      }
    } catch (transitionError) {
      setError(
        transitionError instanceof Error
          ? transitionError.message
          : "The session state could not be changed.",
      )
    } finally {
      setPending(false)
    }
  }

  async function publishCaption(sourceText?: string) {
    setPending(true)
    setError("")
    try {
      const response = await organizerApi<{ session: ProductSession }>(
        `/api/sessions/${sessionId}/segments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sourceText ? { sourceText } : {}),
        },
      )
      setSession(response.session)
      setManualCaption("")
    } catch (captionError) {
      setError(
        captionError instanceof Error
          ? captionError.message
          : "The caption could not be published.",
      )
    } finally {
      setPending(false)
    }
  }

  async function submitManualCaption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (manualCaption.trim()) await publishCaption(manualCaption.trim())
  }

  async function correctLatest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const latest = session?.segments.at(-1)
    if (!latest || !correction.trim()) return
    setPending(true)
    setError("")
    try {
      const response = await organizerApi<{ session: ProductSession }>(
        `/api/sessions/${sessionId}/segments/${latest.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceText: correction.trim() }),
        },
      )
      setSession(response.session)
      setCorrection("")
    } catch (correctionError) {
      setError(
        correctionError instanceof Error
          ? correctionError.message
          : "The correction could not be saved.",
      )
    } finally {
      setPending(false)
    }
  }

  function startBrowserSpeech() {
    const Recognition = speechRecognitionConstructor()
    if (!Recognition || !session) {
      setError(
        "This browser does not expose the Web Speech recognition API. Use deterministic or manual captions instead.",
      )
      return
    }
    const browserRecognition = new Recognition()
    browserRecognition.continuous = true
    browserRecognition.interimResults = false
    browserRecognition.lang = languageLocales[session.sourceLanguage]
    browserRecognition.onresult = (event) => {
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result?.isFinal && result[0]?.transcript.trim()) {
          void publishCaption(result[0].transcript.trim())
        }
      }
    }
    browserRecognition.onerror = () => {
      setBrowserSpeechActive(false)
      setError("Browser speech recognition stopped after an input error.")
    }
    browserRecognition.onend = () => setBrowserSpeechActive(false)
    recognition.current = browserRecognition
    browserRecognition.start()
    setBrowserSpeechActive(true)
  }

  function stopBrowserSpeech() {
    recognition.current?.stop()
    recognition.current = null
    setBrowserSpeechActive(false)
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="grid min-h-72 place-items-center p-8 text-sm text-muted-foreground">
          {error || "Loading the session control room…"}
        </CardContent>
      </Card>
    )
  }

  const latest = session.segments.at(-1)
  const active = ["live", "paused"].includes(session.status)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card
          className={session.status === "live" ? "border-primary/35" : undefined}
        >
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    session.status === "live" ? "default" : "secondary"
                  }
                >
                  {session.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {session.sourceLanguage} source
                </span>
              </div>
              <CardTitle>{session.name}</CardTitle>
              <CardDescription>
                Local mode sends captions through authenticated serverless-style
                HTTP APIs. No always-on socket server is required.
              </CardDescription>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {session.status === "draft" && (
                <Button
                  onClick={() => void transition("start")}
                  disabled={pending}
                >
                  <CirclePlay className="size-4" aria-hidden="true" />
                  Start
                </Button>
              )}
              {session.status === "live" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => void transition("pause")}
                    disabled={pending}
                  >
                    <CirclePause className="size-4" aria-hidden="true" />
                    Pause
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void transition("stop")}
                    disabled={pending}
                  >
                    <CircleStop className="size-4" aria-hidden="true" />
                    Stop
                  </Button>
                </>
              )}
              {session.status === "paused" && (
                <>
                  <Button
                    onClick={() => void transition("resume")}
                    disabled={pending}
                  >
                    <CirclePlay className="size-4" aria-hidden="true" />
                    Resume
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void transition("stop")}
                    disabled={pending}
                  >
                    <CircleStop className="size-4" aria-hidden="true" />
                    Stop
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Attendees",
                  value: String(session.attendeeCount),
                  icon: Users,
                },
                {
                  label: "Reserved",
                  value: `${session.reservedCredits.toLocaleString("en-IN")} cr`,
                  icon: Headphones,
                },
                {
                  label: "Input",
                  value:
                    microphoneState === "ready"
                      ? `${microphoneLevel}%`
                      : microphoneState,
                  icon: Mic2,
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-muted/60 p-4">
                  <item.icon className="size-4 text-primary" aria-hidden="true" />
                  <p className="mt-4 font-mono text-2xl font-semibold capitalize">
                    {item.value}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Control room needs attention</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic2 className="size-5 text-primary" aria-hidden="true" />
              Presenter input
            </CardTitle>
            <CardDescription>
              Check the microphone, then use browser recognition, manual text,
              or deterministic segments for local acceptance testing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void checkMicrophone()}
                disabled={microphoneState === "checking"}
              >
                {microphoneState === "ready" ? (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                ) : (
                  <Mic2 className="size-4" aria-hidden="true" />
                )}
                {microphoneState === "checking"
                  ? "Checking…"
                  : microphoneState === "ready"
                    ? "Microphone ready"
                    : "Check microphone"}
              </Button>
              {session.status === "live" &&
                (browserSpeechActive ? (
                  <Button variant="outline" onClick={stopBrowserSpeech}>
                    Stop browser captions
                  </Button>
                ) : (
                  <Button variant="outline" onClick={startBrowserSpeech}>
                    <Captions className="size-4" aria-hidden="true" />
                    Use browser captions
                  </Button>
                ))}
              <Button
                onClick={() => void publishCaption()}
                disabled={session.status !== "live" || pending}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Add deterministic segment
              </Button>
            </div>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={submitManualCaption}
            >
              <Input
                value={manualCaption}
                onChange={(event) => setManualCaption(event.target.value)}
                placeholder="Type a source caption for deterministic translation"
                maxLength={2000}
                disabled={session.status !== "live"}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={
                  session.status !== "live" || !manualCaption.trim() || pending
                }
              >
                Publish
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Captions className="size-5 text-primary" aria-hidden="true" />
              Live transcript
            </CardTitle>
            <CardDescription>
              Attendee views poll this same canonical transcript.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {latest ? (
              <>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {session.sourceLanguage}
                  </p>
                  <p className="mt-2 text-lg leading-relaxed">
                    {latest.sourceText}
                  </p>
                </div>
                {session.targetLanguages.map((language) => (
                  <div
                    key={language}
                    className="rounded-xl border border-primary/20 bg-primary/6 p-5"
                  >
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
                      {language}
                    </p>
                    <p className="mt-2 text-lg leading-relaxed">
                      {latest.translations[language]}
                    </p>
                  </div>
                ))}
                {active && (
                  <form
                    className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row"
                    onSubmit={correctLatest}
                  >
                    <Input
                      value={correction}
                      onChange={(event) => setCorrection(event.target.value)}
                      placeholder="Correct the latest source caption"
                      maxLength={2000}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={!correction.trim() || pending}
                    >
                      Save correction
                    </Button>
                  </form>
                )}
              </>
            ) : (
              <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-border text-center">
                <div className="max-w-sm px-6">
                  <Radio
                    className="mx-auto size-7 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="mt-4 font-medium">No captions yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start the session and publish the first source segment.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="size-5" aria-hidden="true" />
              Attendee join
            </CardTitle>
            <CardDescription>
              Code <span className="font-mono">{session.joinCode}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrDataUrl && (
              <div className="mx-auto w-fit rounded-xl border bg-white p-3">
                <Image
                  src={qrDataUrl}
                  alt={`QR code for attendee join code ${session.joinCode}`}
                  width={180}
                  height={180}
                  unoptimized
                />
              </div>
            )}
            {joinLink && (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/join/${session.joinCode}`} target="_blank">
                  Open attendee view
                </Link>
              </Button>
            )}
            <p className="break-all text-xs text-muted-foreground">{joinLink}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Language channels</CardTitle>
            <CardDescription>
              Captions are shared; audio is synthesized in each attendee browser
              after a user gesture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {session.targetLanguages.map((language) => (
              <div
                key={language}
                className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"
              >
                <div>
                  <p className="font-medium">{language}</p>
                  <p className="text-sm text-muted-foreground">
                    caption + local audio
                  </p>
                </div>
                <span className="font-mono text-sm text-muted-foreground">
                  {session.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {session.status === "completed" && (
          <Card className="border-primary/25">
            <CardHeader>
              <CardTitle>Session outputs</CardTitle>
              <CardDescription>
                Usage settled at {session.consumedCredits.toLocaleString("en-IN")}{" "}
                credits.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild variant="outline">
                <a
                  href={`/api/sessions/${session.id}/artifacts?format=txt`}
                  download
                >
                  <Download className="size-4" aria-hidden="true" />
                  Transcript and summary
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={`/api/sessions/${session.id}/artifacts?format=vtt`}
                  download
                >
                  <Download className="size-4" aria-hidden="true" />
                  WebVTT captions
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
