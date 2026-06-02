"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { saveVitals } from "@/lib/actions/encounter-actions";
import { VITAL_FIELDS } from "@/lib/constants";

type VitalsData = Record<string, number | null>;

export function VitalsForm({
  encounterId,
  initialVitals,
  disabled,
}: {
  encounterId: string;
  initialVitals: VitalsData | null;
  disabled: boolean;
}) {
  const [vitals, setVitals] = useState<VitalsData>(() => {
    const initial: VitalsData = {};
    for (const field of VITAL_FIELDS) {
      initial[field.key] = initialVitals?.[field.key] ?? null;
    }
    return initial;
  });

  const { status } = useAutosave(vitals, async (data) => {
    await saveVitals(encounterId, data);
  }, { enabled: !disabled });

  const handleChange = useCallback((key: string, value: string) => {
    setVitals((prev) => ({
      ...prev,
      [key]: value === "" ? null : parseFloat(value),
    }));
  }, []);

  const bmi = vitals.weight && vitals.height
    ? (vitals.weight / ((vitals.height / 100) ** 2)).toFixed(1)
    : null;

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Vitals</CardTitle>
        {status !== "idle" && (
          <Badge variant="outline" className="text-[10px] h-5">
            {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Error"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 pt-0">
        {VITAL_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              {field.label} ({field.unit})
            </Label>
            <Input
              type="number"
              step="any"
              value={vitals[field.key] ?? ""}
              onChange={(e) => handleChange(field.key, e.target.value)}
              disabled={disabled}
              className="h-7 text-xs"
            />
          </div>
        ))}
        {bmi && (
          <div className="col-span-2 text-xs text-muted-foreground">
            BMI: <span className="font-medium">{bmi}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
