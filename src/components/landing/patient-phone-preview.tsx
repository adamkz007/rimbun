import { Lock } from "lucide-react";
import { RimbunMark } from "@/components/branding/rimbun-logo";

// Static replica of the patient's secure-link page (/r/[token]) in Bahasa
// Melayu, using the same wording as the real page.
const options = [
  { label: "Buat temujanji semakan dengan doktor anda di klinik", picked: true },
  { label: "Tiada apa-apa, keputusan adalah normal" },
  { label: "Berjumpa pakar; klinik akan menguruskan rujukan" },
];

export function PatientPhonePreview() {
  return (
    <figure className="mx-auto w-full max-w-[19rem]">
      <div className="rounded-[2.25rem] border border-leaf-ink/15 bg-leaf-ink p-2.5 shadow-[0_24px_64px_-16px] shadow-leaf-ink/40">
        <div className="overflow-hidden rounded-[1.75rem] bg-leaf-paper" aria-hidden="true">
          <div className="flex items-center justify-center gap-1.5 border-b border-leaf-rule bg-white py-2 text-[10px] text-leaf-muted">
            <Lock className="size-3" />
            rimbun.app/r/••••••
          </div>
          <div className="space-y-2.5 p-3">
            <div className="flex items-center gap-2">
              <RimbunMark className="size-6" />
              <div>
                <p className="text-[11px] font-semibold text-leaf-ink">Klinik Rimbun</p>
                <p className="text-[9px] text-leaf-muted">Keputusan ujian anda</p>
              </div>
            </div>

            <div className="rounded-xl border border-leaf-rule bg-white p-3">
              <p className="text-[10px] text-leaf-muted">Salam Siti,</p>
              <p className="text-sm font-semibold text-leaf-ink">HbA1c</p>
              <p className="mt-1 text-[10px] leading-4 text-leaf-text">
                Gula dalam darah anda lebih tinggi daripada biasa. Ini boleh dirawat dengan baik jika
                dikesan awal.
              </p>
            </div>

            <div className="rounded-xl border border-leaf/30 bg-leaf-mist p-3">
              <p className="text-[9px] font-medium tracking-wide text-leaf uppercase">Langkah seterusnya</p>
              <p className="text-[11px] font-semibold text-leaf-ink">Semakan dengan doktor di klinik</p>
              <p className="text-[10px] text-leaf-muted">Bila: dalam seminggu akan datang</p>
            </div>

            <div className="rounded-xl border border-leaf-rule bg-white p-3">
              <p className="text-[10px] font-medium text-leaf-text">Apakah langkah seterusnya untuk anda?</p>
              <ul className="mt-1.5 space-y-1">
                {options.map((option) => (
                  <li
                    key={option.label}
                    className={
                      option.picked
                        ? "rounded-md border border-leaf-ink bg-leaf-mist px-2 py-1 text-[9px] text-leaf-ink"
                        : "rounded-md border border-leaf-rule px-2 py-1 text-[9px] text-leaf-muted"
                    }
                  >
                    {option.label}
                  </li>
                ))}
              </ul>
              <p className="mt-2 rounded-md bg-leaf-ink py-1.5 text-center text-[10px] font-semibold text-leaf-paper">
                Saya faham
              </p>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-sm text-leaf-muted">
        What the patient sees, in English or Bahasa Melayu.
      </figcaption>
    </figure>
  );
}
