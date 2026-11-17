"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircleHeart, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PATIENT_LANGUAGES, type PatientLanguage } from "@/lib/care-loop/catalogue";
import { formatClinicDateTime } from "@/lib/care-loop/format";
import { LANGUAGE_LABELS } from "@/lib/care-loop/messages";
import { scheduleSafetyNet, suggestSafetyNet } from "@/lib/actions/safety-net-actions";
import {
  CAUSE_LEVEL_LABELS,
  getProtocol,
  PROTOCOL_STATUS,
  PROTOCOLS,
  STARTING_LEVELS,
  type Protocol,
  type StartingLevel,
} from "@/lib/safety-net/protocols";
import type { Suggestion } from "@/lib/safety-net/suggest";
import { STATE_LABELS, type FollowupState } from "@/lib/safety-net/workflow";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

type CauseChoice = { cause: string; level: StartingLevel; on: boolean };

function defaultCauses(protocol: Protocol): CauseChoice[] {
  return protocol.causes.map((cause) => ({ cause: cause.id, level: cause.defaultLevel, on: true }));
}
const HOUR_CHOICES = [4, 6, 12, 24, 36, 48, 72, 96, 120];

export type SafetyNetPanelData = {
  patient: { phone: string | null; preferredLanguage: PatientLanguage; hasConsent: boolean };
  current: { id: string; state: FollowupState; protocolCode: string; checkinDueAt: string } | null;
};

export function SafetyNetPanel({
  encounterId,
  data,
  isDoctor,
  beforeSuggest,
}: {
  encounterId: string;
  data: SafetyNetPanelData;
  isDoctor: boolean;
  beforeSuggest?: () => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ value: Suggestion; signature: string } | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [protocolCode, setProtocolCode] = useState(PROTOCOLS[0].code);
  const [hours, setHours] = useState(PROTOCOLS[0].defaultCheckInHours);
  const [signs, setSigns] = useState<string[]>(PROTOCOLS[0].signs.map((sign) => sign.id));
  const [causes, setCauses] = useState<CauseChoice[]>(defaultCauses(PROTOCOLS[0]));
  const [language, setLanguage] = useState<PatientLanguage>(data.patient.preferredLanguage);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const protocol = getProtocol(protocolCode)!;
  const hourChoices = useMemo(() => [...new Set([...HOUR_CHOICES, hours])].sort((a, b) => a - b), [hours]);
  const current = data.current;
  const open_ = current && current.state !== "closed";

  function chooseProtocol(code: string) {
    const next = getProtocol(code);
    if (!next) return;
    setProtocolCode(code);
    setHours(next.defaultCheckInHours);
    setSigns(next.signs.map((sign) => sign.id));
    setCauses(defaultCauses(next));
  }

  async function askClaude() {
    setSuggesting(true);
    setSuggestError(null);
    try {
      await beforeSuggest?.();
      const result = await suggestSafetyNet(encounterId);
      if (!result.ok) {
        setSuggestError(result.error);
        return;
      }
      const value = result.data.suggestion;
      setSuggestion({ value, signature: result.data.signature });
      if (value.recommend && value.protocolCode) {
        setProtocolCode(value.protocolCode);
        setHours(value.checkInHours);
        setSigns(value.signs);
        const suggestedProtocol = getProtocol(value.protocolCode);
        if (suggestedProtocol) {
          setCauses(
            suggestedProtocol.causes.map((cause) => {
              const pick = value.causes.find((item) => item.cause === cause.id);
              return { cause: cause.id, level: pick?.level ?? cause.defaultLevel, on: !!pick };
            })
          );
        }
      }
    } finally {
      setSuggesting(false);
    }
  }

  function submit() {
    startTransition(async () => {
      const result = await scheduleSafetyNet({
        encounterId,
        protocolCode,
        checkInHours: hours,
        signs,
        causes: causes.filter((item) => item.on).map(({ cause, level }) => ({ cause, level })),
        language,
        note,
        consentConfirmed: data.patient.hasConsent || consent,
        suggestion,
      });
      if (!result.ok) {
        toast.error("Couldn't set up the follow-up", result.error);
        return;
      }
      toast.success("Safety-net follow-up scheduled");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <MessageCircleHeart className="h-4 w-4" />
          Safety-net follow-up
        </CardTitle>
        <CardDescription className="text-xs">
          A WhatsApp check-in if the cause isn&apos;t confirmed today.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {current ? (
          <Link
            href={`/followups/${current.id}`}
            className="block rounded-md border px-2.5 py-2 text-xs transition-colors hover:border-primary/50"
          >
            <span className="font-medium">{getProtocol(current.protocolCode)?.label ?? current.protocolCode}</span>
            <span className="mt-0.5 flex items-center gap-2 text-muted-foreground">
              <Badge variant={current.state === "escalated" ? "destructive" : "outline"}>{STATE_LABELS[current.state]}</Badge>
              {current.state === "scheduled" ? `Check-in ${formatClinicDateTime(current.checkinDueAt)}` : null}
            </span>
          </Link>
        ) : null}
        {isDoctor && !open_ ? (
          <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
            Set up follow-up
          </Button>
        ) : null}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Safety-net follow-up</DialogTitle>
            <DialogDescription>
              The patient gets a WhatsApp check-in. Fixed rules route the answers: improving closes, a concern goes to a
              nurse call, a red flag sends emergency advice and alerts a doctor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Suggestion from Claude</p>
                <Button size="sm" variant="outline" disabled={suggesting} onClick={askClaude}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {suggesting ? "Reading the visit..." : suggestion ? "Ask again" : "Suggest"}
                </Button>
              </div>
              {suggestion ? (
                <div className="mt-2 space-y-1 text-xs">
                  <p className="font-medium">
                    {suggestion.value.recommend && suggestion.value.protocolCode
                      ? `${getProtocol(suggestion.value.protocolCode)?.label}, after ${suggestion.value.checkInHours} h (filled in below)`
                      : "Claude doesn't suggest a follow-up for this visit."}
                  </p>
                  <p className="text-muted-foreground">{suggestion.value.reason}</p>
                </div>
              ) : suggestError ? (
                <p className="mt-2 text-xs text-destructive">{suggestError}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Reads this visit&apos;s notes, vitals and diagnoses (no name, IC or contact details) and fills in the form.
                  You decide.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sn-protocol">Question set</Label>
              <select
                id="sn-protocol"
                className={SELECT_CLASS}
                value={protocolCode}
                onChange={(event) => chooseProtocol(event.target.value)}
              >
                {PROTOCOLS.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {protocol.summary} {protocol.timingNote}
              </p>
              <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-200">
                {PROTOCOL_STATUS}
              </Badge>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Possible causes</legend>
              <p className="text-xs text-muted-foreground">
                Rimbun will ask about{" "}
                {causes.filter((item) => item.on).length
                  ? causes
                      .filter((item) => item.on)
                      .map((item) => protocol.causes.find((cause) => cause.id === item.cause)?.label)
                      .join(", ")
                  : "the warning signs only"}
                . Red-flag questions are always asked; untick a cause to stop asking about it.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {causes.map((item) => {
                  const cause = protocol.causes.find((entry) => entry.id === item.cause);
                  if (!cause) return null;
                  return (
                    <span
                      key={item.cause}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs",
                        !item.on && "opacity-50",
                        item.on && item.level === "watch" && "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-3.5"
                        aria-label={`Ask about ${cause.label}`}
                        checked={item.on}
                        onChange={(event) =>
                          setCauses((value) =>
                            value.map((entry) => (entry.cause === item.cause ? { ...entry, on: event.target.checked } : entry))
                          )
                        }
                      />
                      {cause.label}
                      <select
                        aria-label={`${cause.label} starting level`}
                        className="rounded border-0 bg-transparent py-0 pl-0.5 pr-0 text-xs text-muted-foreground"
                        value={item.level}
                        disabled={!item.on}
                        onChange={(event) =>
                          setCauses((value) =>
                            value.map((entry) =>
                              entry.cause === item.cause ? { ...entry, level: event.target.value as StartingLevel } : entry
                            )
                          )
                        }
                      >
                        {STARTING_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {CAUSE_LEVEL_LABELS[level].toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </span>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sn-hours">Check in after</Label>
                <select
                  id="sn-hours"
                  className={SELECT_CLASS}
                  value={hours}
                  onChange={(event) => setHours(Number(event.target.value))}
                >
                  {hourChoices.map((value) => (
                    <option key={value} value={value}>
                      {value} hours{value % 24 === 0 ? ` (${value / 24} day${value === 24 ? "" : "s"})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sn-language">Language</Label>
                <select
                  id="sn-language"
                  className={SELECT_CLASS}
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as PatientLanguage)}
                >
                  {PATIENT_LANGUAGES.map((value) => (
                    <option key={value} value={value}>
                      {LANGUAGE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Warning signs to ask about</legend>
              <p className="text-xs text-muted-foreground">The core questions are always asked.</p>
              {protocol.signs.map((sign) => (
                <label key={sign.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={signs.includes(sign.id)}
                    onChange={(event) =>
                      setSigns((value) =>
                        event.target.checked ? [...value, sign.id] : value.filter((item) => item !== sign.id)
                      )
                    }
                  />
                  {sign.label}
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="sn-note">Note for the nurse (optional)</Label>
              <Textarea
                id="sn-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. NS1 sent today; review platelets if not improving."
              />
            </div>

            {!data.patient.phone ? (
              <p className="rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive">
                No mobile number on file. Add it in the patient record first.
              </p>
            ) : !data.patient.hasConsent ? (
              <label className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
                <input type="checkbox" className="mt-0.5 size-4" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                The patient agreed to receive messages from the clinic on WhatsApp at {data.patient.phone} (PDPA consent
                and WhatsApp opt-in).
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">Messages go to {data.patient.phone} (consent on file).</p>
            )}

            <Button
              className={cn("w-full")}
              disabled={isPending || !data.patient.phone || (!data.patient.hasConsent && !consent)}
              onClick={submit}
            >
              {isPending ? "Scheduling..." : "Schedule check-in"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
