"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Clock3, MapPin, Pencil, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  CLINIC_DAY_LABELS,
  CLINIC_DAY_ORDER,
  formatHoursRange,
  getOpenStatus,
  normalizeOpeningHours,
} from "@/lib/clinic-details";
import { cn } from "@/lib/utils";
import type { ClinicOpeningHours, StaffRole } from "@/types/database";

type ClinicDetails = {
  name: string;
  address: string | null;
  registration_number: string | null;
  opening_hours: ClinicOpeningHours;
};

type ClinicDetailsCardProps = {
  clinic: ClinicDetails | null;
  role: StaffRole;
};

type ClinicDetailsForm = {
  name: string;
  registrationNumber: string;
  address: string;
  openingHours: ClinicOpeningHours;
};

export function ClinicDetailsCard({ clinic, role }: ClinicDetailsCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const initialForm = useMemo(() => getInitialForm(clinic), [clinic]);
  const [form, setForm] = useState<ClinicDetailsForm>(initialForm);
  const canEdit = role === "admin";
  const normalizedHours = useMemo(
    () => normalizeOpeningHours(clinic?.opening_hours),
    [clinic?.opening_hours]
  );
  const openStatus = useMemo(() => getOpenStatus(normalizedHours, now), [normalizedHours, now]);

  useEffect(() => {
    if (!isDialogOpen) {
      setForm(initialForm);
      setMessage(null);
    }
  }, [initialForm, isDialogOpen]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  if (!clinic) {
    return null;
  }

  function updateDayField(
    day: keyof ClinicOpeningHours,
    field: "isOpen" | "open" | "close",
    value: boolean | string
  ) {
    setForm((current) => ({
      ...current,
      openingHours: {
        ...current.openingHours,
        [day]: {
          ...current.openingHours[day],
          [field]: value,
        },
      },
    }));
  }

  function handleSave() {
    setMessage(null);

    startTransition(async () => {
      const result = await updateClinicDetails({
        name: form.name,
        registrationNumber: form.registrationNumber,
        address: form.address,
        openingHours: form.openingHours,
      });

      setMessage(result.message);

      if (result.success) {
        setIsDialogOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-auto px-2 py-3">
      <Card size="sm" className="gap-3 bg-muted/30 ring-foreground/10">
        <CardHeader className="gap-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm">{clinic.name}</CardTitle>
            {openStatus.isOpenNow ? (
              <Badge variant="secondary" className="shrink-0">
                Open Now
              </Badge>
            ) : null}
          </div>
          {canEdit ? (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 justify-start px-2 text-xs text-muted-foreground"
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

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Opening Hours</p>
                      <p className="text-xs text-muted-foreground">
                        Use 24-hour time in HH:MM format.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {CLINIC_DAY_ORDER.map((day) => {
                        const dayHours = form.openingHours[day];

                        return (
                          <div
                            key={day}
                            className="grid gap-3 rounded-lg border p-3 md:grid-cols-[76px_1fr_1fr]"
                          >
                            <label className="flex items-center gap-2 text-sm font-medium">
                              <input
                                type="checkbox"
                                checked={dayHours.isOpen}
                                onChange={(event) =>
                                  updateDayField(day, "isOpen", event.target.checked)
                                }
                              />
                              {CLINIC_DAY_LABELS[day]}
                            </label>
                            <div className="space-y-2">
                              <Label htmlFor={`open-${day}`}>Open</Label>
                              <Input
                                id={`open-${day}`}
                                type="time"
                                value={dayHours.open}
                                disabled={!dayHours.isOpen}
                                onChange={(event) =>
                                  updateDayField(day, "open", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`close-${day}`}>Close</Label>
                              <Input
                                id={`close-${day}`}
                                type="time"
                                value={dayHours.close}
                                disabled={!dayHours.isOpen}
                                onChange={(event) =>
                                  updateDayField(day, "close", event.target.value)
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
          <div className="flex items-start gap-2 text-muted-foreground">
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground">
              {clinic.registration_number?.trim() || "SSM number not set"}
            </span>
          </div>

          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-pre-line text-foreground">
              {clinic.address?.trim() || "Address not set"}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5 shrink-0" />
              <span>
                Today ({CLINIC_DAY_LABELS[openStatus.today]}):{" "}
                <span className="text-foreground">
                  {formatHoursRange(openStatus.todayHours)}
                </span>
              </span>
            </div>

            <div className="space-y-1 rounded-lg border bg-background/70 p-2">
              {CLINIC_DAY_ORDER.map((day) => {
                const isToday = day === openStatus.today;
                return (
                  <div
                    key={day}
                    className={cn(
                      "flex items-center justify-between gap-3",
                      isToday ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <span className={cn("font-medium", !isToday && "font-normal")}>
                      {CLINIC_DAY_LABELS[day]}
                    </span>
                    <span>{formatHoursRange(normalizedHours[day])}</span>
                  </div>
                );
              })}
            </div>
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
    openingHours: normalizeOpeningHours(clinic?.opening_hours),
  };
}
