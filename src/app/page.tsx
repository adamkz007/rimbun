import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardPenLine,
  Layers3,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import { RimbunMark } from "@/components/branding/rimbun-logo";
import { OutcomeLottie } from "@/components/landing/outcome-lottie";
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

const workflowSteps = [
  "Open the patient, not a blank page.",
  "Capture the consult in one steady flow.",
  "Let autosave take care of the background work.",
];

const proofPoints = [
  { value: "2s", label: "Quiet autosave in the background." },
  { value: "1", label: "Workspace for the full consultation." },
  { value: "24/7", label: "Cloud access for the whole clinic team." },
];

const outcomes = [
  {
    title: "Less clicking during consults",
    animation: "focus" as const,
  },
  {
    title: "Smoother handoff between team members",
    animation: "handoff" as const,
  },
  {
    title: "Clearer records across repeat visits",
    animation: "records" as const,
  },
  {
    title: "A calmer day for staff and patients",
    animation: "calm" as const,
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
              <span className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/6 text-[#dff7f1] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur">
                <RimbunMark className="size-7" />
              </span>
              <span>
                <span className="block text-lg font-semibold tracking-[0.08em] uppercase">
                  Rimbun
                </span>
                <span className="block text-xs text-[#d5e8e3]/72">
                  Clinic Operations Software
                </span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href="#features"
                className="hidden text-sm text-[#d5e8e3]/78 transition hover:text-white sm:inline"
              >
                Why it works
              </Link>
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
                  href="#product"
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
                          Assessment suggests uncomplicated URTI. No red flags on exam.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-[#efe8ff] px-3 py-1 text-xs text-[#6a52f2]">
                            ICD-10 assisted
                          </span>
                          <span className="rounded-full bg-[#daf6f1] px-3 py-1 text-xs text-[#0f5a53]">
                            Autosaving
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

      <section
        id="product"
        className="border-y border-[#ddd4ca] bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.54))]"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-24 sm:px-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)] lg:px-12 lg:py-32">
          <div className="max-w-xl">
            <SectionEyebrow>Inside The Flow</SectionEyebrow>
            <h2 className="mt-5 text-4xl leading-[1.1] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
              From patient to plan, in one flow.
            </h2>
            <div className="mt-10 space-y-4">
              {workflowSteps.map((step) => (
                <div
                  key={step}
                  className="flex items-start gap-3 rounded-2xl border border-[#ddd4ca] bg-white/85 px-4 py-4"
                >
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0f5a53] text-white">
                    <Check className="size-3.5" />
                  </span>
                  <p className="text-base leading-7 text-[#395652]">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 rounded-[2rem] bg-[#7b68ff] px-7 py-8 text-white shadow-[0_24px_70px_rgba(123,104,255,0.26)]">
              <p className="text-[0.6875rem] uppercase tracking-[0.28em] text-white/68">
                Made to keep up
              </p>
              <p className="mt-4 text-[1.5rem] leading-[1.25] font-semibold tracking-[-0.03em]">
                Clear enough for records, light enough for real conversations.
              </p>
              <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-1.5 text-sm">
                <TimerReset className="size-4" />
                The chart keeps up while care is happening
              </div>
            </div>
          </div>

          <div className="rounded-[2.2rem] border border-[#ddd4ca] bg-white/88 p-4 shadow-[0_30px_80px_rgba(20,54,50,0.08)]">
            <div className="rounded-[1.8rem] bg-[#f7f2eb] p-4">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.4rem] bg-[#0f5a53] p-4 text-[#f5efe7]">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/64">
                    Active queue
                  </p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-white/8 px-4 py-3">
                      <p className="font-medium">Nur Imani</p>
                      <p className="text-sm text-white/70">Review BP medication</p>
                    </div>
                    <div className="rounded-2xl bg-white/8 px-4 py-3">
                      <p className="font-medium">Faris Daniel</p>
                      <p className="text-sm text-white/70">Fever and sore throat</p>
                    </div>
                    <div className="rounded-2xl bg-[#60d9c6]/16 px-4 py-3">
                      <p className="font-medium">Zulaikha Aziz</p>
                      <p className="text-sm text-[#d9fcf5]">Seen by Dr. Nadia now</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.4rem] bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#6a8380]">
                      Consultation canvas
                    </p>
                    <div className="mt-4 rounded-[1.2rem] border border-[#ece4da] bg-[#fbf8f3] p-4">
                      <div className="flex gap-2">
                        <span className="rounded-full bg-[#efe8ff] px-3 py-1 text-xs text-[#6a52f2]">
                          Notes
                        </span>
                        <span className="rounded-full bg-[#daf6f1] px-3 py-1 text-xs text-[#0f5a53]">
                          Diagram
                        </span>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-[#45615d]">
                        <div className="h-2.5 w-3/4 rounded-full bg-[#dcd4ca]" />
                        <div className="h-2.5 w-full rounded-full bg-[#e6dfd5]" />
                        <div className="h-2.5 w-5/6 rounded-full bg-[#dcd4ca]" />
                      </div>
                      <div className="mt-6 rounded-[1rem] border border-dashed border-[#cebfae] px-4 py-6 text-center text-sm text-[#6d817d]">
                        Freehand sketch area for symptoms, exam notes, or patient education
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[1.4rem] bg-[#f1ebff] p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-[#765ff0]">
                        Diagnosis assist
                      </p>
                      <p className="mt-3 text-base leading-7 text-[#4c4380]">
                        Useful coding suggestions appear right when they are needed.
                      </p>
                    </div>
                    <div className="rounded-[1.4rem] bg-[#daf6f1] p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-[#0f5a53]">
                        Medication support
                      </p>
                      <p className="mt-3 text-base leading-7 text-[#27514c]">
                        Common medicines and dosing details stay close to prescribing.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
            {outcomes.map((outcome, index) => (
              <div
                key={outcome.title}
                className={cn(
                  "group rounded-[2rem] border px-6 py-7 transition-shadow duration-300 hover:shadow-[0_20px_50px_rgba(20,54,50,0.08)]",
                  index % 2 === 0
                    ? "border-[#ddd4ca] bg-white/86"
                    : "border-transparent bg-[#efe8ff]"
                )}
              >
                <OutcomeLottie
                  animation={outcome.animation}
                  className="mb-5 h-32 w-full overflow-hidden rounded-[1.4rem] border border-[#e7ddd2]/60 bg-white/50 transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <p className="text-[0.6875rem] uppercase tracking-[0.28em] text-[#6a8380]">
                  Outcome {index + 1}
                </p>
                <p className="mt-4 text-[1.375rem] leading-[1.3] font-semibold tracking-[-0.03em] text-[#163936]">
                  {outcome.title}
                </p>
              </div>
            ))}
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
              href="mailto:hello@rimbun.app"
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
