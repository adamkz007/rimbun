import type { Metadata } from "next";
import Link from "next/link";
import { RimbunMark } from "@/components/branding/rimbun-logo";
import { DiagnoseWizard } from "@/components/diagnose/diagnose-wizard";

export const metadata: Metadata = {
  title: "Pain checker (AI) — Rimbun",
  description:
    "Answer a few questions about your pain and get an AI-generated, high-level summary with an interactive 3D anatomy explainer. Not a medical diagnosis.",
};

export default function DiagnosePage() {
  return (
    <main className="min-h-screen bg-[#f6f0e8] font-sans text-[#143632]">
      <div className="bg-[#7d1010] px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
        AI tool, not a doctor. In an emergency call <a href="tel:999" className="underline">999</a>.
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-12 sm:px-8 lg:px-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2.5 text-inherit">
            <RimbunMark className="size-9" />
            <span>
              <span className="block font-brand text-xl font-extrabold leading-none tracking-[-0.035em] text-[#12382A]">
                rimbun
              </span>
              <span className="block text-xs text-[#5f7a76]">Pain checker · AI-assisted</span>
            </span>
          </Link>
          <p className="max-w-md text-xs leading-relaxed text-[#5f7a76]">
            Your answers are sent to an AI model to generate questions and a summary. Nothing is saved to your
            medical record. Don&apos;t enter your name or contact details.
          </p>
        </header>
        <DiagnoseWizard />
      </div>
    </main>
  );
}
