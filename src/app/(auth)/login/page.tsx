"use client";

import { useRef, useState } from "react";
import { login } from "@/lib/actions/auth-actions";
import { ChevronDown } from "lucide-react";
import { RimbunMark } from "@/components/branding/rimbun-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Demo accounts in the seeded "Rimbun Demo Clinic", shown for hackathon judges.
// Admin is left out on purpose: it can manage staff accounts.
const DEMO_PASSWORD = "Rimbun123!";
const DEMO_ACCOUNTS = [
  { role: "Doctor", email: "doctor@demo.rimbun.local" },
  { role: "Nurse", email: "nurse@demo.rimbun.local" },
  { role: "Reception", email: "reception@demo.rimbun.local" },
];

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showDemo, setShowDemo] = useState(false);

  function fillDemoAccount(email: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
    passwordRef.current?.focus();
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <RimbunMark className="size-12" />
          </div>
          <CardTitle className="font-brand text-3xl font-extrabold tracking-[-0.035em] text-[#12382A]">
            rimbun
          </CardTitle>
          <p className="text-sm text-muted-foreground">Clinic OS</p>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input ref={emailRef} id="email" name="email" type="email" required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input ref={passwordRef} id="password" name="password" type="password" required />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-dashed border-leaf-sage bg-leaf-mist/60 text-xs">
            <button
              type="button"
              onClick={() => setShowDemo((value) => !value)}
              aria-expanded={showDemo}
              aria-controls="demo-access"
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left font-medium text-leaf-ink hover:bg-leaf-mist"
            >
              For Hack2Skill evaluators: demo access
              <ChevronDown
                className={`size-4 shrink-0 transition-transform ${showDemo ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {showDemo ? (
              <div id="demo-access" className="px-3 pb-3">
              <p className="text-muted-foreground">
                Sign in to the demo clinic with any account below. Password:{" "}
                <code className="rounded bg-card px-1 py-0.5 font-mono text-leaf-ink">{DEMO_PASSWORD}</code>
              </p>
              <ul className="mt-2 space-y-1">
                {DEMO_ACCOUNTS.map((account) => (
                  <li key={account.email} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-leaf-ink">{account.role}</span>{" "}
                      <span className="text-muted-foreground">{account.email}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => fillDemoAccount(account.email)}
                      className="shrink-0 rounded-md px-2 py-0.5 font-medium text-leaf hover:bg-card"
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
