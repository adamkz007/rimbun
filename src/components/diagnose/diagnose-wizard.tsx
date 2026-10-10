"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useLocalDraft } from "@/lib/hooks/use-local-draft";
import { getRegion, sidePoint, type RegionId, type Side, type StructureKey } from "@/lib/diagnose/anatomy";
import {
  EMPTY_ANSWERS,
  isStepComplete,
  needsSide,
  STEPS,
  withRegion,
  type DiagnoseAnswers,
} from "@/lib/diagnose/questions";
import { evaluateRedFlags } from "@/lib/diagnose/red-flags";
import type { AssessResponse, Assessment, FollowUpResponse, FollowUps } from "@/lib/diagnose/schema";
import {
  highlightForAnswers,
  OVERVIEW,
  originForAnswers,
  spinalLevelForAnswers,
  viewForAnswers,
  viewForStage,
  type ExplainStage,
} from "@/lib/diagnose/view";
import { cn } from "@/lib/utils";
import { QuestionStep } from "./question-steps";
import { EmergencyPanel, Results } from "./results";

const AnatomyViewer = dynamic(() => import("./anatomy-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-white/60">
      <Loader2 className="mr-2 size-4 animate-spin" /> Loading 3D anatomy…
    </div>
  ),
});

type Draft = { answers: DiagnoseAnswers; step: number };
const INITIAL_DRAFT: Draft = { answers: EMPTY_ANSWERS, step: 0 };
const FOLLOW_UP_INDEX = STEPS.findIndex((s) => s.id === "follow_up");
const RESULTS_INDEX = STEPS.findIndex((s) => s.id === "results");

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((data && typeof data.error === "string" && data.error) || `Request failed (${response.status}).`);
  }
  return data as T;
}

export function DiagnoseWizard() {
  const { value: draft, setValue: setDraft, resetToServer } = useLocalDraft<Draft>("rimbun:diagnose", INITIAL_DRAFT);
  const { answers, step: stepIndex } = draft;
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)];

  const [followUps, setFollowUps] = useState<FollowUps | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [serverRedFlags, setServerRedFlags] = useState<{ id: string; reason: string }[]>([]);
  const [acknowledgedEmergency, setAcknowledgedEmergency] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [loading, setLoading] = useState<null | "follow_up" | "assess">(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ExplainStage>(3);

  const setAnswers = useCallback((next: DiagnoseAnswers) => setDraft({ ...draft, answers: next }), [draft, setDraft]);
  const update = useCallback((patch: Partial<DiagnoseAnswers>) => setAnswers({ ...answers, ...patch }), [answers, setAnswers]);
  const goTo = useCallback((index: number) => setDraft({ ...draft, step: index }), [draft, setDraft]);

  const redFlags = useMemo(() => evaluateRedFlags(answers), [answers]);

  const fetchFollowUps = useCallback(
    async (acknowledged: boolean) => {
      setLoading("follow_up");
      setError(null);
      try {
        const result = await postJson<FollowUpResponse>("/api/diagnose/follow-up", {
          answers,
          acknowledgedEmergency: acknowledged,
        });
        if (result.kind === "emergency") {
          setServerRedFlags(result.redFlags);
          setShowEmergency(true);
          return;
        }
        setFollowUps(result.followUps);
        setDraft({ answers: { ...answers, followUps: [] }, step: FOLLOW_UP_INDEX });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(null);
      }
    },
    [answers, setDraft]
  );

  const fetchAssessment = useCallback(async () => {
    setLoading("assess");
    setError(null);
    try {
      const result = await postJson<AssessResponse>("/api/diagnose/assess", { answers, acknowledgedEmergency });
      if (result.kind === "emergency") {
        setServerRedFlags(result.redFlags);
        setShowEmergency(true);
        return;
      }
      setAssessment(result.assessment);
      setServerRedFlags(result.redFlags);
      setStage(0);
      goTo(RESULTS_INDEX);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }, [answers, acknowledgedEmergency, goTo]);

  function next() {
    setError(null);
    if (step.id === "red_flags") {
      if (redFlags.length && !acknowledgedEmergency) {
        setShowEmergency(true);
        return;
      }
      void fetchFollowUps(acknowledgedEmergency);
      return;
    }
    if (step.id === "follow_up") {
      void fetchAssessment();
      return;
    }
    goTo(stepIndex + 1);
  }

  function back() {
    setError(null);
    setShowEmergency(false);
    goTo(Math.max(0, stepIndex - 1));
  }

  function continueAfterEmergency() {
    setAcknowledgedEmergency(true);
    setShowEmergency(false);
    void fetchFollowUps(true);
  }

  function restart() {
    resetToServer();
    setFollowUps(null);
    setAssessment(null);
    setServerRedFlags([]);
    setAcknowledgedEmergency(false);
    setShowEmergency(false);
    setError(null);
    setStage(3);
  }

  function pickRegion(region: RegionId, side: Side | null) {
    if (step.id !== "region") return;
    const next = withRegion(answers, region);
    setAnswers({ ...next, side: needsSide(next) ? side : null });
  }

  // Follow-up questions live in memory only; refetch after a page reload.
  const needsFollowUpReload = step.id === "follow_up" && !followUps && !loading;

  // --- 3D view state derived from the answers ---
  const where = step.id === "about" ? { region: null, side: null, subLocation: null } : answers;
  const showSub = stepIndex >= STEPS.findIndex((s) => s.id === "spot");
  const whereForView = showSub ? where : { ...where, subLocation: null };
  const region = getRegion(where.region);
  const origin = originForAnswers(answers);
  const level = spinalLevelForAnswers(answers);
  const inResults = step.id === "results" && !!assessment;

  const originKey = origin.join();
  const view = useMemo(() => {
    if (inResults && assessment) return viewForStage(stage, origin, level, assessment.referredTo);
    if (!whereForView.region) return OVERVIEW;
    return viewForAnswers(whereForView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inResults, assessment, stage, originKey, level, whereForView.region, whereForView.side, whereForView.subLocation]);

  const highlight = useMemo((): StructureKey[] => {
    if (inResults && stage === 1) return level === "lumbar" || level === "sacral" ? ["lumbar_spine"] : ["thoracic_spine"];
    if (inResults && stage === 2) return ["thalamus", "somatosensory_cortex"];
    if (inResults && assessment?.focusStructures.length) return assessment.focusStructures;
    return highlightForAnswers(whereForView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inResults, assessment, stage, level, whereForView.region, whereForView.subLocation]);

  const marker = useMemo(() => {
    if (!showSub || !answers.subLocation || !region) return null;
    const sub = region.subLocations.find((s) => s.id === answers.subLocation);
    if (!sub) return null;
    return region.lateral ? sidePoint(sub.focus, answers.side === "left" ? "left" : "right") : sub.focus;
  }, [showSub, answers.subLocation, answers.side, region]);

  const complete = isStepComplete(step.id, answers);
  const progress = Math.round((stepIndex / (STEPS.length - 1)) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
      {/* 3D viewer: sticky on top for mobile, right column on desktop */}
      <div className="sticky top-0 z-10 -mx-4 h-[38vh] min-h-[260px] overflow-hidden bg-[#083a39] sm:mx-0 sm:rounded-[1.75rem] lg:order-2 lg:top-6 lg:h-[calc(100vh-3rem)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,_rgba(82,205,181,0.18),_transparent_55%)]" />
        <div className="relative h-full">
          <AnatomyViewer
            view={view}
            region={(where.region as RegionId | null) ?? null}
            side={answers.side}
            highlight={highlight}
            marker={marker}
            interactive={step.id === "region"}
            onPickRegion={pickRegion}
            explain={
              inResults && assessment
                ? { origin, spinalLevel: level, referred: assessment.referredTo, stage }
                : null
            }
          />
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 text-[10px] leading-tight text-white/55">
          <span>
            Anatomy: The Open Anatomy Project (SPL brain, abdomen &amp; knee atlases; Mauritanian thoracic atlas), 3D
            Slicer licence. Not for clinical use.
          </span>
          {step.id === "region" ? <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-white/80">Tap where it hurts</span> : null}
        </div>
      </div>

      {/* Question card */}
      <div className="lg:order-1">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7ded2]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div className="h-full rounded-full bg-[#0f5a53] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-[#5f7a76] tabular-nums">
            {Math.min(stepIndex + 1, STEPS.length)} / {STEPS.length}
          </span>
        </div>

        <div className="rounded-[1.75rem] border border-[#e8e0d6] bg-[#fcfaf7] p-5 shadow-[0_20px_60px_rgba(8,58,57,0.08)] sm:p-7">
          <p className="text-[0.6875rem] font-medium tracking-[0.28em] text-[#0f5a53]/65 uppercase">{step.subtitle}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#143632]">{step.title}</h2>

          <div className="mt-6">
            {showEmergency ? (
              <EmergencyPanel reasons={serverRedFlags.length ? serverRedFlags : redFlags} onContinue={continueAfterEmergency} />
            ) : step.id === "results" ? (
              assessment ? (
                <Results assessment={assessment} redFlags={serverRedFlags} stage={stage} onStage={setStage} onRestart={restart} />
              ) : (
                <div className="space-y-3 text-sm text-[#5f7a76]">
                  <p>Your summary isn&apos;t stored after you leave the page.</p>
                  <button type="button" onClick={() => void fetchAssessment()} disabled={!!loading} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#0f5a53] px-4 text-white disabled:opacity-60">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate it again
                  </button>
                </div>
              )
            ) : needsFollowUpReload ? (
              <button type="button" onClick={() => void fetchFollowUps(acknowledgedEmergency)} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#0f5a53] px-4 text-sm text-white">
                <Sparkles className="size-4" /> Load the follow-up questions
              </button>
            ) : (
              <QuestionStep step={step.id} answers={answers} update={update} setAnswers={setAnswers} followUps={followUps} />
            )}
          </div>

          {error ? (
            <div role="alert" className="mt-5 rounded-2xl border border-[#f3b0b0] bg-[#fff0f0] p-3 text-sm text-[#a01818]">
              {error}
            </div>
          ) : null}

          {step.id !== "results" && !showEmergency ? (
            <div className="mt-7 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={back}
                disabled={stepIndex === 0 || !!loading}
                className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm text-[#143632] hover:bg-[#f1ece4] disabled:opacity-40"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
              <button
                type="button"
                onClick={next}
                disabled={!complete || !!loading || needsFollowUpReload}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full bg-[#0f5a53] px-5 text-sm font-medium text-white transition-colors hover:bg-[#0b4843] disabled:opacity-40"
                )}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : step.id === "follow_up" ? <Sparkles className="size-4" /> : null}
                {loading === "follow_up"
                  ? "Thinking of questions…"
                  : loading === "assess"
                    ? "Writing your summary…"
                    : step.id === "follow_up"
                      ? "Get my AI summary"
                      : "Next"}
                {!loading && step.id !== "follow_up" ? <ArrowRight className="size-4" /> : null}
              </button>
            </div>
          ) : null}
          {showEmergency ? (
            <button type="button" onClick={() => setShowEmergency(false)} className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#5f7a76] hover:underline">
              <ArrowLeft className="size-4" /> Change my answers
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
