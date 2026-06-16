"use client";

import { useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { useLocalDraft } from "@/lib/hooks/use-local-draft";
import { saveVitals } from "@/lib/actions/encounter-actions";
import { toast } from "@/lib/toast";
import { VITAL_FIELDS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

type VitalsData = Record<string, number | null>;

function buildVitalsState(initialVitals: VitalsData | null) {
  const initial: VitalsData = {};
  for (const field of VITAL_FIELDS) {
    initial[field.key] = initialVitals?.[field.key] ?? null;
  }
  return initial;
}

export function VitalsForm({
  encounterId,
  initialVitals,
  disabled,
}: {
  encounterId: string;
  initialVitals: VitalsData | null;
  disabled: boolean;
}) {
  const serverVitals = useMemo(() => buildVitalsState(initialVitals), [initialVitals]);
  const {
    value: vitals,
    setValue: setVitals,
    hasHydrated,
    markPersisted,
  } = useLocalDraft(
    `clerking:draft:vitals:${encounterId}`,
    serverVitals,
    { enabled: !disabled }
  );

  const { status, saveNow, hasUnsavedChanges } = useAutosave(
    vitals,
    async (data) => {
      await saveVitals(encounterId, data);
    },
    {
      delay: 12000,
      enabled: hasHydrated && !disabled,
      initialData: serverVitals,
      onSaveSuccess: markPersisted,
    }
  );

  const handleChange = useCallback((key: string, value: string) => {
    setVitals((prev) => ({
      ...prev,
      [key]: value === "" ? null : parseFloat(value),
    }));
  }, [setVitals]);

  const bmi = vitals.weight && vitals.height
    ? (vitals.weight / ((vitals.height / 100) ** 2)).toFixed(1)
    : null;

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Vitals</CardTitle>
        <div className="flex items-center gap-1">
          {status !== "idle" && (
            <Badge
              variant="outline"
              className="text-[10px] h-5"
              role="status"
              aria-live="polite"
            >
              {status === "unsaved"
                ? "Unsaved"
                : status === "saving"
                  ? "Saving..."
                  : status === "saved"
                    ? "Saved"
                    : "Save failed"}
            </Badge>
          )}
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await saveNow();
                toast.success("Vitals saved");
              }}
              disabled={status === "saving" || !hasUnsavedChanges}
              aria-label="Save vitals"
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
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
              onBlur={() => void saveNow()}
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
