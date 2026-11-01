import { RimbunMark } from "@/components/branding/rimbun-logo";

/** Plain, phone-first frame for the public secure-link pages. */
export function PublicShell({
  clinicName,
  subtitle,
  children,
}: {
  clinicName: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f6f0e8] font-sans text-[#143632]">
      <div className="mx-auto w-full max-w-xl px-4 pt-6 pb-16">
        <header className="mb-6 flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#083a39] text-[#dff7f1]">
            <RimbunMark className="size-6" />
          </span>
          <span>
            <span className="block text-sm font-semibold">{clinicName}</span>
            <span className="block text-xs text-[#5f7a76]">{subtitle}</span>
          </span>
        </header>
        {children}
      </div>
    </main>
  );
}

export function PublicCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#e3dbd0] bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function LinkProblem({ status }: { status: "expired" | "invalid" }) {
  return (
    <PublicShell clinicName="Rimbun" subtitle="Secure link">
      <PublicCard>
        <h1 className="text-lg font-semibold">
          {status === "expired" ? "This link has expired" : "This link isn't valid"}
        </h1>
        <p className="mt-2 text-sm text-[#4b6662]">
          {status === "expired"
            ? "For your privacy, links stop working after 30 days. Please contact your clinic for a new one."
            : "Please check you opened the full link from your message, or contact your clinic."}
        </p>
      </PublicCard>
    </PublicShell>
  );
}
