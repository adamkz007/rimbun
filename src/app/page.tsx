import Link from "next/link";
import {
  ArrowRight,
  ClipboardPenLine,
  FileStack,
  HandHelping,
  HeartHandshake,
  Layers3,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { RimbunMark } from "@/components/branding/rimbun-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const proofPoints = [
  { value: "2s", label: "Quiet autosave in the background." },
  { value: "1", label: "Workspace for the full consultation." },
  { value: "24/7", label: "Cloud access for the whole clinic team." },
];

const outcomes: Array<{
  title: string;
  icon: LucideIcon;
}> = [
  {
    title: "Less clicking during consults",
    icon: MousePointerClick,
  },
  {
    title: "Smoother handoff between team members",
    icon: HandHelping,
  },
  {
    title: "Clearer records across repeat visits",
    icon: FileStack,
  },
  {
    title: "A calmer day for staff and patients",
    icon: HeartHandshake,
  },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6875rem] font-medium tracking-[0.28em] text-[#0f5a53]/65 uppercase">
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f0e8] text-[#143632] font-sans">
      <section className="relative overflow-hidden bg-[#083a39] text-[#f6f0e8]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(82,205,181,0.18),_transparent_34%),radial-gradient(circle_at_70%_30%,_rgba(149,114,255,0.22),_transparent_28%),linear-gradient(180deg,_rgba(6,38,37,0.2),_rgba(6,38,37,0.72))]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#5ed3c8]/60 to-transparent" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
          <header className="flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-3 text-inherit">
              <RimbunMark variant="reversed" className="size-10" />
              <span>
                <span className="block font-brand text-2xl font-extrabold leading-none tracking-[-0.035em]">
                  rimbun
                </span>
                <span className="block text-xs text-[#d5e8e3]/72">
                  Clinic Operations Software
                </span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-10 rounded-full border-white/16 bg-white/7 px-4 text-[#f6f0e8] hover:bg-white/14 hover:text-white"
                )}
              >
                Sign in
              </Link>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-20 py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:py-28">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/7 px-3 py-1 text-xs text-[#d9efe9]/80">
                <span className="inline-block size-2 rounded-full bg-[#66e2cf]" />
                Private beta
              </div>
              <h1 className="mt-8 max-w-3xl text-5xl leading-[0.94] font-semibold tracking-[-0.04em] text-balance sm:text-6xl lg:text-[4.5rem]">
                The next-generation clinic software is here.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-[1.7] text-[#d4e6e1]/80 sm:text-[1.25rem]">
                Rimbun helps doctors write notes, prescribe, and follow up in one place, keeping clinic operations smooth.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-12 rounded-full bg-[#f4efe8] px-5 text-[#103735] hover:bg-[#e9e1d6]"
                  )}
                >
                  Open workspace
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/diagnose"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "lg" }),
                    "h-12 rounded-full border border-white/14 bg-white/6 px-5 text-[#f6f0e8] hover:bg-white/12 hover:text-white"
                  )}
                >
                  Check your pain (AI)
                </Link>
                <Link
                  href="#features"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "lg" }),
                    "h-12 rounded-full border border-white/14 bg-white/6 px-5 text-[#f6f0e8] hover:bg-white/12 hover:text-white"
                  )}
                >
                  See how it works
                </Link>
              </div>
              <div className="mt-14 grid gap-4 sm:grid-cols-3">
                {proofPoints.map((point) => (
                  <div
                    key={point.label}
                    className="rounded-3xl border border-white/10 bg-white/6 px-5 py-5 backdrop-blur"
                  >
                    <p className="text-2xl font-semibold tracking-[-0.04em] text-white">
                      {point.value}
                    </p>
                    <p className="mt-2.5 text-[0.8125rem] leading-[1.6] text-[#d5e8e3]/72">
                      {point.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] p-4 shadow-[0_40px_120px_rgba(1,12,12,0.45)] backdrop-blur-xl">
                <div className="rounded-[1.6rem] border border-[#e8e0d6] bg-white p-5">
                  <div className="flex items-center justify-between rounded-2xl border border-[#ece4db] bg-[#fcfaf7] px-4 py-3">
                    <div>
                      <p className="text-sm text-[#6f8783]">Current encounter</p>
                      <p className="mt-1 text-lg font-semibold text-[#163936]">Aina Rahman</p>
                    </div>
                    <div className="rounded-full bg-[#daf6f1] px-3 py-1 text-xs text-[#0f5a53]">
                      In progress
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[1.4rem] border border-[#ece4db] bg-white p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#6f8783]">
                        <Stethoscope className="size-4" />
                        Clerking notes
                      </div>
                      <div className="mt-4 space-y-3 text-sm leading-6 text-[#395652]">
                        <div className="rounded-2xl bg-[#f8f4ee] p-3">
                          Chief complaint: dry cough, worse at night for 5 days.
                        </div>
                        <div className="rounded-2xl bg-[#f8f4ee] p-3">
                          Diagnosis: uncomplicated URTI. No red flags on examination.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#efe8ff] px-3 py-1 text-xs text-[#6a52f2]">
                            ICD-10 assisted
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.4rem] border border-[#ece4db] bg-[#F5EFE7] p-4 text-[#163936]">
                        <p className="text-xs uppercase tracking-[0.22em] text-[#5b7773]">
                          Vitals snapshot
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-2xl bg-white px-3 py-4 shadow-sm">
                            <p className="text-[#708683]">Temp</p>
                            <p className="mt-1 text-lg font-semibold">37.1 C</p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-4 shadow-sm">
                            <p className="text-[#708683]">Pulse</p>
                            <p className="mt-1 text-lg font-semibold">82 bpm</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[1.4rem] border border-[#ece4db] bg-white p-4">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#6f8783]">
                          <Layers3 className="size-4" />
                          Prescription
                        </div>
                        <div className="mt-3 rounded-2xl bg-[#f8f4ee] p-4 text-sm leading-6 text-[#395652]">
                          Paracetamol 1 g PRN
                          <br />
                          Chlorpheniramine at night
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)] lg:items-end">
          <div className="max-w-3xl">
            <SectionEyebrow>Why Rimbun</SectionEyebrow>
            <h2 className="mt-5 text-4xl leading-[1.1] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
              Fits right in your clinic workflow.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-[1.7] text-[#486460]">
              Good clinic software should help quietly. Rimbun keeps the important
              structure in place, without making the consultation feel heavy or rigid.
            </p>
          </div>
        </div>

        <div
          id="features"
          className="mt-16 grid gap-6 lg:grid-cols-3"
        >
          {featureCards.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className="rounded-[2rem] border border-[#ded6cd] bg-white/82 px-7 py-8 shadow-[0_22px_60px_rgba(20,54,50,0.06)]"
              >
                <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-[#0f5a53]/8 text-[#0f5a53]">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-6 text-[1.5rem] font-semibold tracking-[-0.03em]">
                  {feature.title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-[1.7] text-[#4b6662]">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(320px,1.15fr)]">
          <div className="rounded-[2rem] bg-[#0f5a53] px-8 py-10 text-[#f6f0e8]">
            <SectionEyebrow>What Clinics Feel</SectionEyebrow>
            <h2 className="mt-5 text-4xl leading-[1.1] font-semibold tracking-[-0.04em] text-balance sm:text-[2.9rem]">
              Less friction for the team. More attention for the patient.
            </h2>
            <p className="mt-6 text-[0.9375rem] leading-[1.75] text-[#d4e7e1]/80">
              Rimbun works best in busy clinics where good notes, steady workflow, and
              continuity really matter.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {outcomes.map((outcome, index) => {
              const Icon = outcome.icon;

              return (
                <div
                  key={outcome.title}
                  className={cn(
                    "group rounded-[2rem] border px-6 py-7 transition-shadow duration-300 hover:shadow-[0_20px_50px_rgba(20,54,50,0.08)]",
                    index % 2 === 0
                      ? "border-[#ddd4ca] bg-white/86"
                      : "border-transparent bg-[#efe8ff]"
                  )}
                >
                  <div className="mb-5 flex h-32 w-full items-center justify-center overflow-hidden rounded-[1.4rem] border border-[#e7ddd2]/60 bg-white/50 transition-transform duration-300 group-hover:scale-[1.02]">
                    <div className="flex size-20 items-center justify-center rounded-[1.6rem] bg-[#0f5a53] text-white shadow-[0_16px_40px_rgba(15,90,83,0.18)] transition-transform duration-300 group-hover:-translate-y-1">
                      <Icon className="size-9" />
                    </div>
                  </div>
                  <p className="text-[0.6875rem] uppercase tracking-[0.28em] text-[#6a8380]">
                    Outcome {index + 1}
                  </p>
                  <p className="mt-4 text-[1.375rem] leading-[1.3] font-semibold tracking-[-0.03em] text-[#163936]">
                    {outcome.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#083a39] text-[#f6f0e8]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-20 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-24">
          <div className="max-w-2xl">
            <SectionEyebrow>Ready To See It Live</SectionEyebrow>
            <h2 className="mt-5 text-4xl leading-[1.1] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
              Give your clinic a simpler, calmer way to work.
            </h2>
            <p className="mt-6 text-lg leading-[1.7] text-[#d4e7e1]/78">
              Start with the part your team uses most: a clerking workspace that feels
              clear, fast, and easy to return to every day.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 rounded-full bg-[#f4efe8] px-5 text-[#103735] hover:bg-white"
              )}
            >
              Sign in to Rimbun
            </Link>
            <Link
              href="mailto:hello@rimbun.app?subject=I%27d%20like%20to%20request%20a%20demo%20for%20Rimbun"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 rounded-full border-white/14 bg-white/6 px-5 text-[#f6f0e8] hover:bg-white/12 hover:text-white"
              )}
            >
              Request a demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
