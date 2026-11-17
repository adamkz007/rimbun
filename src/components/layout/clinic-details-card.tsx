"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateClinicDetails } from "@/lib/actions/clinic-actions";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@/types/database";

type ClinicDetails = {
  name: string;
  address: string | null;
  registration_number: string | null;
};

type ClinicDetailsCardProps = {
  clinic: ClinicDetails | null;
  role: StaffRole;
  /** "dark" for the navigation rail's ink background. */
  tone?: "light" | "dark";
};

type ClinicDetailsForm = {
  name: string;
  registrationNumber: string;
  address: string;
};

export function ClinicDetailsCard({ clinic, role, tone = "light" }: ClinicDetailsCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const clinicSnapshot = serializeClinicSnapshot(clinic);
  const initialForm = useMemo(() => getInitialForm(clinic), [clinicSnapshot]);
  const [form, setForm] = useState<ClinicDetailsForm>(initialForm);
  const canEdit = role === "admin";
  const dark = tone === "dark";

  useEffect(() => {
    if (!isDialogOpen) {
      setForm(initialForm);
      setMessage(null);
    }
  }, [initialForm, isDialogOpen]);

  if (!clinic) {
    return null;
  }

  function handleSave() {
    setMessage(null);

    startTransition(async () => {
      const result = await updateClinicDetails({
        name: form.name,
        registrationNumber: form.registrationNumber,
        address: form.address,
      });

      setMessage(result.message);

      if (result.success) {
        setIsDialogOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className={cn("mt-auto py-3", dark ? "px-3" : "px-2")}>
      <Card
        size="sm"
        className={cn(
          "gap-3",
          dark ? "bg-white/6 text-leaf-on-ink ring-white/10" : "bg-muted/30 ring-foreground/10"
        )}
      >
        <CardHeader className="gap-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className={cn("text-sm", dark && "text-leaf-paper")}>{clinic.name}</CardTitle>
          </div>
          {canEdit ? (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 justify-start px-2 text-xs",
                      dark ? "text-leaf-on-ink/70 hover:bg-white/8 hover:text-leaf-paper" : "text-muted-foreground"
                    )}
                  />
                }
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit details
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Clinic Details</DialogTitle>
                  <DialogDescription>
                    Update what staff see in the sidebar card for this clinic.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="clinic-name">Clinic Name</Label>
                      <Input
                        id="clinic-name"
                        value={form.name}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clinic-ssm">SSM Number</Label>
                      <Input
                        id="clinic-ssm"
                        value={form.registrationNumber}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            registrationNumber: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clinic-address">Address</Label>
                    <Textarea
                      id="clinic-address"
                      value={form.address}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, address: event.target.value }))
                      }
                      placeholder="Enter the clinic address"
                    />
                  </div>

                  {message ? (
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      {message}
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={isPending}>
                      {isPending ? "Saving..." : "Save Clinic Details"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-3 text-xs">
          <div className={cn("flex items-start gap-2", dark ? "text-leaf-on-ink/60" : "text-muted-foreground")}>
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className={dark ? "text-leaf-on-ink" : "text-foreground"}>
              {clinic.registration_number?.trim() || "SSM number not set"}
            </span>
          </div>

          <div className={cn("flex items-start gap-2", dark ? "text-leaf-on-ink/60" : "text-muted-foreground")}>
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className={cn("whitespace-pre-line", dark ? "text-leaf-on-ink" : "text-foreground")}>
              {clinic.address?.trim() || "Address not set"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getInitialForm(clinic: ClinicDetails | null): ClinicDetailsForm {
  return {
    name: clinic?.name ?? "",
    registrationNumber: clinic?.registration_number ?? "",
    address: clinic?.address ?? "",
  };
}

function serializeClinicSnapshot(clinic: ClinicDetails | null) {
  return JSON.stringify({
    name: clinic?.name ?? "",
    registrationNumber: clinic?.registration_number ?? "",
    address: clinic?.address ?? "",
  });
}
