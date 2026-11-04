import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RimbunMark } from "@/components/branding/rimbun-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACTIVE_QUEUE_STATUSES,
  formatQueueNumber,
  formatWaitDuration,
  getQueueStatusLabel,
  sortQueueEntries,
} from "@/lib/queue";
import type { QueueStatus } from "@/types/database";

type DisplayEntry = {
  id: string;
  queue_number: number;
  status: QueueStatus;
  sort_order: number;
  checked_in_at: string;
  patients:
    | { full_name: string; mrn: string }
    | Array<{ full_name: string; mrn: string }>
    | null;
};

type WaitingRoomDisplayProps = {
  clinicName: string;
  entries: DisplayEntry[];
};

function getPatient(entry: DisplayEntry) {
  return Array.isArray(entry.patients) ? entry.patients[0] : entry.patients;
}

export function WaitingRoomDisplay({ clinicName, entries }: WaitingRoomDisplayProps) {
  const activeEntries = sortQueueEntries(
    entries.filter((entry) => ACTIVE_QUEUE_STATUSES.includes(entry.status))
  );
  const nowServing = [...activeEntries]
    .reverse()
    .find((entry) => entry.status === "with_doctor");
  const upNext = activeEntries.filter(
    (entry) => entry.status === "waiting" || entry.status === "with_nurse"
  );

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <RimbunMark className="size-12" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{clinicName}</h1>
            <p className="text-muted-foreground">Waiting room display</p>
          </div>
        </div>
        <Link href="/queue">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to queue board
          </Button>
        </Link>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-[0.2em] text-muted-foreground">
            Now serving
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nowServing ? (
            <div className="space-y-2">
              <p className="font-mono text-6xl font-bold">
                {formatQueueNumber(nowServing.queue_number)}
              </p>
              <p className="text-xl text-muted-foreground">
                {getPatient(nowServing)?.full_name ?? "Patient"}
              </p>
            </div>
          ) : (
            <p className="py-6 text-2xl text-muted-foreground">No patient with the doctor yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-[0.2em] text-muted-foreground">
            Up next
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upNext.length === 0 ? (
            <p className="py-4 text-lg text-muted-foreground">The waiting queue is clear.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upNext.map((entry) => (
                <div key={entry.id} className="rounded-xl border px-4 py-4">
                  <p className="font-mono text-4xl font-bold">
                    {formatQueueNumber(entry.queue_number)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {getQueueStatusLabel(entry.status)} · Waiting{" "}
                    {formatWaitDuration(entry.checked_in_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
