"use client"

import { useState } from "react"
import {
  Captions,
  CircleStop,
  Headphones,
  Mic2,
  Radio,
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

const channels = [
  { language: "English", listeners: 38, latency: "2.8 s" },
  { language: "Hindi", listeners: 26, latency: "3.1 s" },
  { language: "Telugu", listeners: 20, latency: "3.0 s" },
]

export function LiveConsole() {
  const [live, setLive] = useState(false)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card className={live ? "border-primary/35" : undefined}>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant={live ? "default" : "secondary"}>
                  {live ? "Live" : "Ready"}
                </Badge>
                <span className="text-sm text-muted-foreground">Kannada source</span>
              </div>
              <CardTitle>MicroDegree GenAI Session</CardTitle>
              <CardDescription>
                Demo console. Audio capture and speech providers are not connected.
              </CardDescription>
            </div>
            <Button
              variant={live ? "destructive" : "default"}
              onClick={() => setLive((value) => !value)}
            >
              {live ? (
                <>
                  <CircleStop className="size-4" aria-hidden="true" />
                  Stop demo
                </>
              ) : (
                <>
                  <Radio className="size-4" aria-hidden="true" />
                  Start demo
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Attendees", value: live ? "84" : "0", icon: Users },
                { label: "Reserved", value: "1,155 cr", icon: Headphones },
                { label: "Input", value: live ? "Active" : "Ready", icon: Mic2 },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-muted/60 p-4">
                  <item.icon className="size-4 text-primary" aria-hidden="true" />
                  <p className="mt-4 font-mono text-2xl font-semibold">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Captions className="size-5 text-primary" aria-hidden="true" />
              Live transcript
            </CardTitle>
            <CardDescription>
              Source segments stay visible when a protected term has low confidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {live ? (
              <>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Source
                  </p>
                  <p className="mt-2 text-lg leading-relaxed">
                    ಈಗ ನಾವು vector database ನಲ್ಲಿ embeddings store ಮಾಡೋಣ.
                  </p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/6 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">
                    English
                  </p>
                  <p className="mt-2 text-lg leading-relaxed">
                    Now we will store the embeddings in the vector database.
                  </p>
                </div>
              </>
            ) : (
              <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-border text-center">
                <div className="max-w-sm px-6">
                  <Mic2 className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-4 font-medium">Transcript waiting for audio</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start the demo to preview source and translated captions.
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
            <CardTitle>Language channels</CardTitle>
            <CardDescription>One shared stream per active language.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {channels.map((channel) => (
              <div
                key={channel.language}
                className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"
              >
                <div>
                  <p className="font-medium">{channel.language}</p>
                  <p className="text-sm text-muted-foreground">
                    {live ? channel.listeners : 0} listeners
                  </p>
                </div>
                <span className="font-mono text-sm text-muted-foreground">
                  {live ? channel.latency : "ready"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Alert>
          <Radio className="size-4" aria-hidden="true" />
          <AlertTitle>Credit settlement</AlertTitle>
          <AlertDescription>
            Metered usage settles per language channel. Unused reservation returns to the original credit lots.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
