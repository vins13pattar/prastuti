"use client"

import { useState } from "react"
import { Captions, Headphones, Languages, Volume2 } from "lucide-react"

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

const captions = {
  English:
    "Retrieval augmented generation brings trusted knowledge into the model response.",
  Hindi:
    "रिट्रीवल ऑगमेंटेड जनरेशन विश्वसनीय जानकारी को मॉडल के उत्तर में जोड़ता है।",
  Telugu:
    "రిట్రీవల్ ఆగ్మెంటెడ్ జనరేషన్ విశ్వసనీయ సమాచారాన్ని మోడల్ సమాధానంలోకి తీసుకొస్తుంది.",
} as const

type PreviewLanguage = keyof typeof captions

export function ListenerPreview() {
  const [language, setLanguage] = useState<PreviewLanguage>("English")
  const [listening, setListening] = useState(false)

  return (
    <Card className="relative overflow-hidden border-border/80 bg-card/96 shadow-[0_24px_80px_oklch(0.28_0.04_30_/_0.12)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      <CardHeader className="gap-4 border-b border-border/70 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="secondary" className="mb-3">
              Live listener
            </Badge>
            <CardTitle className="text-xl">GenAI Foundations</CardTitle>
            <CardDescription>Presenter language: Kannada</CardDescription>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Languages className="size-5" aria-hidden="true" />
          </span>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="preview-language">
            Listen in
          </label>
          <Select
            value={language}
            onValueChange={(value) => setLanguage(value as PreviewLanguage)}
          >
            <SelectTrigger id="preview-language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(captions).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="w-full"
          variant={listening ? "secondary" : "default"}
          onClick={() => setListening((value) => !value)}
        >
          {listening ? (
            <>
              <Volume2 className="size-4" aria-hidden="true" />
              Listening now
            </>
          ) : (
            <>
              <Headphones className="size-4" aria-hidden="true" />
              Start listening
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Captions className="size-4 text-primary" aria-hidden="true" />
          Live captions
        </div>
        <p
          className="min-h-24 text-lg leading-relaxed text-foreground"
          aria-live="polite"
          lang={language === "Hindi" ? "hi" : language === "Telugu" ? "te" : "en"}
        >
          {captions[language]}
        </p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>Original</span>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">Translation</span>
          <span aria-hidden="true">/</span>
          <span>Both</span>
        </div>
      </CardContent>
    </Card>
  )
}
