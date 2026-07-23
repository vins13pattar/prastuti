import Link from "next/link"
import {
  ArrowRight,
  AudioLines,
  Check,
  CircleGauge,
  Code2,
  Languages,
  RadioTower,
  ReceiptText,
  ShieldCheck,
  TimerReset,
  WalletCards,
} from "lucide-react"

import { ListenerPreview } from "@/components/marketing/listener-preview"
import { SiteHeader } from "@/components/marketing/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const creditSteps = [
  {
    number: "01",
    title: "Load credits",
    description:
      "Fund one or more credit lots before your session. Every lot receives its own 365 day validity window.",
  },
  {
    number: "02",
    title: "Reserve an estimate",
    description:
      "Prastuti shows the expected cost and reserves enough balance to protect the live experience.",
  },
  {
    number: "03",
    title: "Settle actual usage",
    description:
      "You pay for metered minutes and enabled outputs. Any unused reservation returns to the original lots.",
  },
]

export default function Home() {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden">
      <SiteHeader />

      <main>
        <section className="relative border-b border-border">
          <div
            className="marketing-grid pointer-events-none absolute inset-0 opacity-70"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.72fr)] lg:items-center lg:px-8 lg:py-32">
            <div>
              <Badge variant="secondary" className="mb-7 gap-2">
                <span className="size-1.5 rounded-full bg-primary" />
                Built for multilingual India
              </Badge>
              <h1 className="max-w-4xl text-balance text-5xl font-semibold tracking-[-0.045em] sm:text-6xl lg:text-[5.25rem] lg:leading-[0.98]">
                One presentation.
                <span className="block text-primary">Every listener included.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
                Prastuti turns a live presenter&apos;s voice into translated
                captions and audio for every attendee, while keeping technical
                terms, names, and intent intact.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-6">
                  <Link href="/dashboard">
                    Explore the product
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-6">
                  <Link href="#credits">See how credits work</Link>
                </Button>
              </div>
              <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted-foreground">
                {["No subscriptions", "Pay for actual usage", "Credits valid for 365 days"].map(
                  (item) => (
                    <span key={item} className="flex items-center gap-2">
                      <Check className="size-4 text-primary" aria-hidden="true" />
                      {item}
                    </span>
                  ),
                )}
              </div>
            </div>
            <div className="relative lg:translate-y-8">
              <div
                className="absolute -inset-8 -z-10 rounded-full bg-primary/10 blur-3xl"
                aria-hidden="true"
              />
              <ListenerPreview />
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-background/90 p-4 backdrop-blur">
                  <p className="font-mono text-2xl font-semibold">3.1 sec</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Demo translation latency
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/90 p-4 backdrop-blur">
                  <p className="font-mono text-2xl font-semibold">3</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Shared language streams
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
            <div>
              <p className="text-sm font-semibold text-primary">THE PRODUCT</p>
              <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                Language access that stays out of the presenter&apos;s way.
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                Present naturally. Prastuti handles shared language channels,
                attendee choice, terminology context, and post-session outputs.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
              {[
                {
                  icon: RadioTower,
                  title: "Live language channels",
                  copy: "One translation stream serves everyone listening in the same language.",
                },
                {
                  icon: Languages,
                  title: "Listener choice",
                  copy: "Attendees switch between original audio, translated audio, captions, or both.",
                },
                {
                  icon: ShieldCheck,
                  title: "Protected terminology",
                  copy: "Slide context and glossaries keep product names and technical terms precise.",
                },
                {
                  icon: ReceiptText,
                  title: "Metered settlement",
                  copy: "Each session produces an auditable usage breakdown and wallet ledger.",
                },
              ].map((item) => (
                <article key={item.title} className="bg-card p-7 sm:p-8">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <item.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-7 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 leading-7 text-muted-foreground">{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="credits" className="border-y border-border bg-foreground text-background">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div>
                <WalletCards className="size-9 text-primary" aria-hidden="true" />
                <h2 className="mt-7 text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                  No plan to outgrow. No seat to count.
                </h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-background/68 lg:justify-self-end">
                Prepay only what you need. Credits are consumed by transparent
                meters such as source minutes, target language minutes, translated
                audio, and session processing.
              </p>
            </div>
            <Separator className="my-14 bg-background/16" />
            <div className="grid gap-10 lg:grid-cols-3">
              {creditSteps.map((step) => (
                <article key={step.number} className="relative">
                  <p className="font-mono text-sm text-primary">{step.number}</p>
                  <h3 className="mt-5 text-2xl font-semibold">{step.title}</h3>
                  <p className="mt-4 max-w-sm leading-7 text-background/65">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-16 flex flex-col gap-5 rounded-2xl border border-background/16 bg-background/6 p-7 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">A simple working rate card</p>
                <p className="mt-1 text-sm text-background/60">
                  Source captions from 2 credits per minute. Translation from
                  1.5 credits per language minute.
                </p>
              </div>
              <Button asChild variant="secondary" className="shrink-0">
                <Link href="/credits">Open credit estimator</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="architecture" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="grid gap-16 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div className="relative min-h-[430px] overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-9">
              <div className="absolute inset-0 marketing-grid opacity-45" aria-hidden="true" />
              <div className="relative grid h-full content-between gap-8">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">TypeScript application stack</Badge>
                  <Code2 className="size-5 text-primary" aria-hidden="true" />
                </div>
                <div className="space-y-3">
                  {[
                    ["Experience", "Next.js + React + shadcn"],
                    ["Application compute", "On-demand TypeScript functions"],
                    ["Data and jobs", "Neon + durable workflows"],
                    ["Speech and media", "Typed provider adapters"],
                  ].map(([label, value], index) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/92 p-4 shadow-sm"
                      style={{ marginLeft: `${index * 14}px` }}
                    >
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-right text-sm font-medium">{value}</span>
                    </div>
                  ))}
                </div>
                <p className="max-w-md text-sm leading-6 text-muted-foreground">
                  All product code can stay in TypeScript. Managed speech,
                  realtime, and media systems carry persistent connections
                  behind typed interfaces.
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">ONE LANGUAGE FOR THE TEAM</p>
              <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                Yes, the authored stack can be fully JavaScript and TypeScript.
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                A single language keeps the startup fast. Browsers connect
                directly to managed realtime and speech providers, while
                short-lived functions handle tokens, wallet operations,
                translation segments, and webhooks.
              </p>
              <div className="mt-9 grid gap-5 sm:grid-cols-2">
                {[
                  {
                    icon: CircleGauge,
                    label: "Fast iteration",
                    copy: "Shared types from wallet ledger to attendee UI.",
                  },
                  {
                    icon: TimerReset,
                    label: "Scale-to-zero compute",
                    copy: "No Prastuti server or queue worker stays resident between sessions.",
                  },
                ].map((item) => (
                  <div key={item.label} className="flex gap-4">
                    <item.icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl bg-primary px-6 py-16 text-primary-foreground sm:px-10 lg:flex lg:items-end lg:justify-between lg:px-16 lg:py-20">
            <div>
              <AudioLines className="size-9" aria-hidden="true" />
              <h2 className="mt-8 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                Make the next room understandable to everyone.
              </h2>
            </div>
            <Button asChild size="lg" variant="secondary" className="mt-9 lg:mt-0">
              <Link href="/sessions/new">
                Create a demo session
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>Prastuti product concept, 2026.</p>
        <p>Designed for inclusion, clarity, and accountable usage.</p>
      </footer>
    </div>
  )
}
