import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardList,
  LayoutDashboard,
  Pill,
  Search,
  Stethoscope,
  Users,
} from "lucide-react";
import { RimbunMark } from "@/components/branding/rimbun-logo";
import { cn } from "@/lib/utils";

// Static marketing replica of the clerking workspace. Labels mirror
// NOTE_SECTIONS / VITAL_FIELDS so the preview matches the real product.
const tabs = ["Chief Complaint", "History", "Examination", "Diagnosis", "Prescription", "General Notes"];
const activeTab = "Diagnosis";

const railIcons = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Users, label: "Queue" },
  { icon: Stethoscope, label: "Clerking", active: true },
  { icon: Pill, label: "Dispensary" },
  { icon: CalendarDays, label: "Attendance" },
];

const icdResults = [
  { code: "J06.9", name: "Acute upper respiratory infection, unspecified", active: true },
  { code: "J00", name: "Acute nasopharyngitis (common cold)" },
  { code: "J02.9", name: "Acute pharyngitis, unspecified" },
];

const vitals = [
  { label: "BP", value: "118/76", unit: "mmHg" },
  { label: "Heart Rate", value: "82", unit: "bpm" },
  { label: "Temperature", value: "37.1", unit: "°C" },
  { label: "SpO2", value: "98", unit: "%" },
];

const prescriptions = [
  { drug: "Paracetamol 500 mg tab", sig: "2 tab · QID PRN · 3 days" },
  { drug: "Chlorpheniramine 4 mg tab", sig: "1 tab · ON · 5 days" },
];

export function EncounterPreview() {
  return (
    <figure className="relative min-w-0 lg:w-[46rem]">
      <div className="overflow-hidden rounded-[1.25rem] border border-leaf-ink/10 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_64px_-12px] shadow-leaf-ink/25 ring-8 ring-white/60">
        <div className="flex">
          {/* App rail */}
          <div className="hidden w-14 shrink-0 flex-col items-center gap-1.5 bg-leaf-ink py-4 sm:flex" aria-hidden="true">
            <RimbunMark variant="reversed" className="mb-3 size-7" />
            {railIcons.map(({ icon: Icon, label, active }) => (
              <span
                key={label}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  active ? "bg-white/14 text-leaf-paper" : "text-leaf-on-ink/55"
                )}
              >
                <Icon className="size-4" />
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            {/* Patient header */}
            <div className="flex items-center gap-3 border-b border-leaf-rule px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf-sage/45 text-xs font-semibold text-leaf-ink">
                AR
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-leaf-text">Aina Rahman</p>
                <p className="truncate text-[11px] text-leaf-muted">MRN 000482 · Female · 34y</p>
              </div>
              <span className="hidden items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 sm:inline-flex">
                <AlertTriangle className="size-3" aria-hidden="true" />
                Penicillin
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <span className="hidden items-center gap-1 text-[11px] text-leaf-muted md:inline-flex">
                  <Check className="size-3 text-leaf" aria-hidden="true" />
                  Saved
                </span>
                <span className="rounded-full bg-leaf px-2.5 py-1 text-[11px] font-medium text-white">
                  In progress
                </span>
              </div>
            </div>

            {/* Section tabs */}
            <div className="overflow-hidden border-b border-leaf-rule px-4" aria-hidden="true">
              <div className="flex gap-4 text-[11px] font-medium whitespace-nowrap">
                {tabs.map((tab) => (
                  <span
                    key={tab}
                    className={cn(
                      "-mb-px border-b-2 py-2.5",
                      tab === activeTab ? "border-leaf-ink text-leaf-ink" : "border-transparent text-leaf-muted"
                    )}
                  >
                    {tab}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-[minmax(0,1fr)_13.5rem]">
              {/* Diagnosis */}
              <div className="min-w-0 space-y-3 p-4">
                <div className="relative">
                  <div className="flex h-9 items-center gap-2 rounded-lg border border-leaf bg-white px-3 text-xs text-leaf-text ring-3 ring-leaf/15">
                    <Search className="size-3.5 text-leaf-muted" aria-hidden="true" />
                    <span>
                      upper resp
                      <span className="ml-px inline-block h-3.5 w-px translate-y-0.5 bg-leaf-ink" aria-hidden="true" />
                    </span>
                    <span className="ml-auto rounded border border-leaf-rule px-1 font-mono text-[10px] text-leaf-muted">
                      ICD-10
                    </span>
                  </div>
                  <ul className="mt-1.5 overflow-hidden rounded-lg border border-leaf-rule bg-white text-xs shadow-lg shadow-leaf-ink/8">
                    {icdResults.map((r) => (
                      <li
                        key={r.code}
                        className={cn("flex items-baseline gap-2.5 px-3 py-2", r.active && "bg-leaf-mist")}
                      >
                        <span className="w-10 shrink-0 font-mono text-[11px] font-semibold text-leaf">{r.code}</span>
                        <span className="truncate text-leaf-text">{r.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-leaf-rule bg-leaf-paper px-2 py-1 text-[11px] text-leaf-text">
                    <span className="font-mono font-semibold text-leaf">R05</span> Cough
                  </span>
                </div>

                <div className="rounded-lg border border-leaf-rule bg-leaf-paper/60 p-3 text-xs leading-5 text-leaf-text">
                  <p className="mb-1 text-[10px] font-semibold tracking-wide text-leaf-muted uppercase">Notes</p>
                  Dry cough × 5 days, worse at night. Throat mildly injected, chest clear,
                  no red flags. Advised fluids and rest; return if fever &gt; 3 days.
                </div>
              </div>

              {/* Side panel */}
              <div className="space-y-4 border-t border-leaf-rule bg-leaf-paper/50 p-4 md:border-t-0 md:border-l">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-leaf-ink">
                    <ClipboardList className="size-3.5" aria-hidden="true" />
                    Vitals
                  </p>
                  <dl className="grid grid-cols-2 gap-1.5">
                    {vitals.map((v) => (
                      <div key={v.label} className="rounded-md border border-leaf-rule bg-white px-2 py-1.5">
                        <dt className="text-[10px] text-leaf-muted">{v.label}</dt>
                        <dd className="text-sm font-semibold whitespace-nowrap text-leaf-text tabular-nums">
                          {v.value}
                          <span className="ml-0.5 text-[10px] font-normal text-leaf-muted">{v.unit}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-leaf-ink">
                    <Pill className="size-3.5" aria-hidden="true" />
                    Prescription
                  </p>
                  <ul className="space-y-1.5">
                    {prescriptions.map((rx) => (
                      <li key={rx.drug} className="rounded-md border border-leaf-rule bg-white px-2 py-1.5">
                        <p className="truncate text-[11px] font-medium text-leaf-text">{rx.drug}</p>
                        <p className="truncate text-[10px] text-leaf-muted">{rx.sig}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating queue card */}
      <div
        className="absolute -bottom-6 left-4 hidden items-center gap-3 rounded-2xl border border-white/70 bg-white/80 py-2.5 pr-4 pl-2.5 shadow-xl shadow-leaf-ink/12 backdrop-blur-md sm:flex lg:-left-8"
        aria-hidden="true"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-leaf-ink text-xs font-semibold text-leaf-paper tabular-nums">
          07
        </span>
        <div>
          <p className="text-xs font-semibold text-leaf-text">Next in queue</p>
          <p className="text-[11px] text-leaf-muted">Lim Wei Jie · waiting 12 min</p>
        </div>
      </div>

      <figcaption className="sr-only">
        Example of the Rimbun clerking workspace: patient header, ICD-10 diagnosis search, vitals and prescriptions.
      </figcaption>
    </figure>
  );
}
