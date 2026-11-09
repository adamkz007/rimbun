import Link from "next/link";
import {
  ArrowRight,
  ClipboardPenLine,
  FileStack,
  HandHelping,
  HeartHandshake,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { RimbunLogo, RimbunMark } from "@/components/branding/rimbun-logo";
import { EncounterPreview } from "@/components/landing/encounter-preview";
import { cn } from "@/lib/utils";

const DEMO_HREF =
  "mailto:hello@rimbun.app?subject=I%27d%20like%20to%20request%20a%20demo%20for%20Rimbun";

// One CTA voice across nav, hero and closing section.
const ctaBase =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf";
const ctaPrimary = cn(ctaBase, "bg-leaf-ink text-leaf-paper hover:bg-leaf-text active:bg-leaf-text");
const ctaSecondary = cn(
  ctaBase,
  "border border-leaf-rule bg-white text-leaf-ink hover:border-leaf-sage hover:bg-leaf-mist"
);

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#outcomes", label: "Why clinics switch" },
  { href: "/diagnose", label: "Pain checker" },
];

const featureCards: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "One workspace",
    description:
      "Notes, vitals, diagnoses, prescriptions, and sketches stay together in one place.",
    icon: ClipboardPenLine,
  },
  {
    title: "Helpful search",
    description:
      "Find ICD-10 codes and medicines without breaking your train of thought.",
    icon: Sparkles,
  },
  {
    title: "Ready for real clinics",
    description:
      "Roles, patient records, and clinic structure are built in from the start.",
    icon: ShieldCheck,
  },
];

const outcomes: Array<{
  title: string;
  icon: LucideIcon;
}> = [
  { title: "Less clicking during consults", icon: MousePointerClick },
  { title: "Smoother handoff between team members", icon: HandHelping },
  { title: "Clearer records across repeat visits", icon: FileStack },
  { title: "A calmer day for staff and patients", icon: HeartHandshake },
];

function GlassNav() {
  return (
    <header className="fixed inset-x-0 top-3 z-50 px-4 sm:top-5">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-5xl items-center gap-2 rounded-full border border-white/70 bg-white/55 py-1.5 pr-1.5 pl-4 shadow-lg shadow-leaf-ink/8 inset-shadow-xs inset-shadow-white backdrop-blur-xl backdrop-saturate-150 sm:gap-4 sm:pl-5"
      >
        <Link href="/" className="flex shrink-0 items-center gap-2 text-leaf-ink" aria-label="Rimbun home">
          <RimbunMark className="size-8 sm:hidden" />
          <RimbunLogo className="hidden text-[1.375rem] sm:inline-flex" />
        </Link>

        <ul className="mx-auto hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap text-leaf-muted transition-colors duration-150 hover:bg-white/70 hover:text-leaf-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link
            href="/login"
            className="rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-leaf-ink transition-colors duration-150 hover:bg-white/70"
          >
            Sign in
          </Link>
          <Link href={DEMO_HREF} className={cn(ctaPrimary, "h-10 px-4")}>
            Request a demo
          </Link>
        </div>
      </nav>
    </header>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-clip bg-leaf-paper font-sans text-leaf-text">
      <GlassNav />

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden pt-32 pb-20 sm:pt-40 lg:pb-28">
          <RimbunMark
            variant="mono"
            className="pointer-events-none absolute -top-24 -right-40 -z-10 size-[42rem] text-leaf-sage/30 sm:-right-24"
          />
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-4 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-leaf-rule bg-white/70 px-3 py-1 text-xs font-medium text-leaf-muted">
                <span className="size-1.5 rounded-full bg-leaf" aria-hidden="true" />
                Private beta for GP clinics
              </p>
              <h1 className="mt-6 text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.04em] text-balance text-leaf-ink [overflow-wrap:anywhere] sm:text-6xl lg:text-[4.25rem]">
                Clinic software that stays out of the way.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-[1.65] text-leaf-muted">
                Rimbun helps doctors write notes, prescribe, and follow up in one place,
                keeping clinic operations smooth.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href={DEMO_HREF} className={ctaPrimary}>
                  Request a demo
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link href="/login" className={ctaSecondary}>
                  Sign in
                </Link>
              </div>
            </div>

            <EncounterPreview />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-28 border-t border-leaf-rule bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
              <h2 className="text-4xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance text-leaf-ink sm:text-5xl">
                Fits right in your clinic workflow.
              </h2>
              <p className="max-w-lg text-lg leading-[1.65] text-leaf-muted">
                Good clinic software should help quietly. Rimbun keeps the important
                structure in place, without making the consultation feel heavy or rigid.
              </p>
            </div>

            <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {featureCards.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="border-t-2 border-leaf-ink pt-6">
                    <Icon className="size-6 text-leaf" aria-hidden="true" />
                    <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-leaf-ink">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-[0.9375rem] leading-[1.7] text-leaf-muted">
                      {feature.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Outcomes */}
        <section id="outcomes" className="scroll-mt-28 bg-leaf-ink text-leaf-paper">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20 lg:py-28">
            <div className="min-w-0">
              <h2 className="text-4xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
                Less friction for the team. More attention for the patient.
              </h2>
              <p className="mt-6 max-w-md text-lg leading-[1.65] text-leaf-on-ink">
                Rimbun works best in busy clinics where good notes, steady workflow, and
                continuity really matter.
              </p>
            </div>

            <ul className="self-end border-t border-white/15">
              {outcomes.map((outcome) => {
                const Icon = outcome.icon;
                return (
                  <li
                    key={outcome.title}
                    className="flex items-center gap-5 border-b border-white/15 py-6"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/8 text-leaf-sage">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-xl leading-snug font-medium tracking-[-0.015em]">
                      {outcome.title}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center sm:px-8 lg:py-28">
          <RimbunMark className="mx-auto size-14" />
          <h2 className="mx-auto mt-8 max-w-2xl text-4xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance text-leaf-ink sm:text-5xl">
            Give your clinic a simpler, calmer way to work.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-[1.65] text-leaf-muted">
            Start with the part your team uses most: a clerking workspace that feels
            clear, fast, and easy to return to every day.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href={DEMO_HREF} className={ctaPrimary}>
              Request a demo
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/login" className={ctaSecondary}>
              Sign in
            </Link>
          </div>
          <p className="mt-8 text-sm text-leaf-muted">
            Looking for help with pain, not clinic software?{" "}
            <Link
              href="/diagnose"
              className="font-semibold text-leaf underline decoration-leaf-sage underline-offset-4 hover:decoration-leaf"
            >
              Try the AI pain checker
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-leaf-rule">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-leaf-ink" aria-label="Rimbun home">
            <RimbunLogo className="text-xl" />
          </Link>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-leaf-muted">
            <li><Link href="#features" className="whitespace-nowrap hover:text-leaf-ink">Features</Link></li>
            <li><Link href="/diagnose" className="whitespace-nowrap hover:text-leaf-ink">Pain checker</Link></li>
            <li><Link href="/login" className="whitespace-nowrap hover:text-leaf-ink">Sign in</Link></li>
            <li><Link href={DEMO_HREF} className="whitespace-nowrap hover:text-leaf-ink">Contact</Link></li>
          </ul>
          <p className="text-sm text-leaf-muted">© {new Date().getFullYear()} Rimbun</p>
        </div>
      </footer>
    </div>
  );
}
