"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Maximize2, Minimize2, Pencil, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveScratchpad } from "@/lib/actions/encounter-actions";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const TldrawCanvas = dynamic(() => import("./tldraw-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading canvas...
    </div>
  ),
});

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

function serializeSnapshot(snapshot: Record<string, unknown> | null) {
  return JSON.stringify(snapshot ?? null);
}

export function ScratchpadCanvas({
  encounterId,
  initialData,
  disabled,
}: {
  encounterId: string;
  initialData: Record<string, unknown> | null;
  disabled: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<Record<string, unknown> | null>(initialData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const snapshotRef = useRef<Record<string, unknown> | null>(initialData);
  const pendingSaveVersionRef = useRef(0);
  const lastSavedVersionRef = useRef(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef(serializeSnapshot(initialData));
  const draftStorageKey = `clerking:draft:scratchpad:${encounterId}`;

  useEffect(() => {
    const serverSerialized = serializeSnapshot(initialData);
    lastSavedSnapshotRef.current = serverSerialized;
    pendingSaveVersionRef.current = 0;
    lastSavedVersionRef.current = 0;
    setHasUnsavedChanges(false);

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (disabled) {
      snapshotRef.current = initialData;
      setInitialSnapshot(initialData);
      setStatus("idle");
      setHasHydrated(true);
      return;
    }

    const storedDraft = window.sessionStorage.getItem(draftStorageKey);
    if (storedDraft) {
      try {
        const parsedDraft = JSON.parse(storedDraft) as Record<string, unknown>;
        snapshotRef.current = parsedDraft;
        setInitialSnapshot(parsedDraft);
        const draftIsDirty = storedDraft !== serverSerialized;
        setHasUnsavedChanges(draftIsDirty);
        setStatus(draftIsDirty ? "unsaved" : "idle");
      } catch {
        window.sessionStorage.removeItem(draftStorageKey);
        snapshotRef.current = initialData;
        setInitialSnapshot(initialData);
        setStatus("idle");
      }
    } else {
      snapshotRef.current = initialData;
      setInitialSnapshot(initialData);
      setStatus("idle");
    }

    setHasHydrated(true);
  }, [disabled, draftStorageKey, encounterId, initialData]);

  const saveSnapshot = useCallback(async (versionToSave = pendingSaveVersionRef.current) => {
    const snapshot = snapshotRef.current;
    if (!snapshot || disabled) return false;
    if (versionToSave <= lastSavedVersionRef.current) return true;

    setStatus("saving");

    try {
      await saveScratchpad(encounterId, snapshot);
      lastSavedVersionRef.current = versionToSave;
      lastSavedSnapshotRef.current = serializeSnapshot(snapshot);
      window.sessionStorage.removeItem(draftStorageKey);
      setHasUnsavedChanges(false);
      setStatus("saved");
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }, [disabled, draftStorageKey, encounterId]);

  const handleChange = useCallback((snapshot: Record<string, unknown>) => {
    snapshotRef.current = snapshot;
    pendingSaveVersionRef.current += 1;

    if (disabled) return;

    window.sessionStorage.setItem(draftStorageKey, serializeSnapshot(snapshot));
    setHasUnsavedChanges(true);
    setStatus("unsaved");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    const versionToSave = pendingSaveVersionRef.current;
    autosaveTimerRef.current = setTimeout(() => {
      void saveSnapshot(versionToSave);
    }, 20000);
  }, [disabled, draftStorageKey, saveSnapshot]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      if (!disabled && hasUnsavedChanges) {
        void saveSnapshot();
      }
    };
  }, [disabled, hasUnsavedChanges, saveSnapshot]);

  const handleSave = useCallback(async () => {
    if (!snapshotRef.current || disabled) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (pendingSaveVersionRef.current === 0) {
      pendingSaveVersionRef.current = 1;
    }

    const saved = await saveSnapshot();
    if (saved) {
      toast.success("Scratchpad saved");
    } else if (snapshotRef.current) {
      toast.error("Scratchpad save failed", "Please try again.");
    }
  }, [disabled, saveSnapshot]);

  const requestExpandedChange = useCallback((open: boolean) => {
    if (open) {
      setIsExpanded(true);
      return;
    }

    if (disabled || !hasUnsavedChanges) {
      setIsExpanded(false);
      return;
    }

    setIsCloseConfirmOpen(true);
  }, [disabled, hasUnsavedChanges]);

  const handleCloseDecision = useCallback(async (shouldSave: boolean) => {
    if (shouldSave) {
      await handleSave();
    }

    setIsCloseConfirmOpen(false);
    setIsExpanded(false);
  }, [handleSave]);

  const statusLabel =
    status === "unsaved"
      ? "Unsaved"
      : status === "saving"
        ? "Saving..."
        : status === "saved"
          ? "Saved"
          : status === "error"
            ? "Save failed"
            : null;

  return (
    <>
      <div className="pointer-events-none fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
        {isExpanded ? (
          <div
            className={cn(
              "pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-white shadow-2xl",
              "h-[min(30rem,calc(100vh-6rem))] w-[min(48rem,calc(100vw-2rem))]"
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-white/80" />
                <div>
                  <p className="text-sm font-medium">Scratchpad</p>
                  <p className="text-[11px] text-white/60">Quick sketches and notes for this encounter</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {statusLabel && (
                  <Badge
                    variant="outline"
                    className="border-white/10 bg-white/5 text-[10px] text-white/80"
                    role="status"
                    aria-live="polite"
                  >
                    {statusLabel}
                  </Badge>
                )}
                {!disabled && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-white hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      void handleSave();
                    }}
                    disabled={status === "saving" || !hasUnsavedChanges}
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span className="sr-only">Save scratchpad</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={() => requestExpandedChange(false)}
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Collapse scratchpad</span>
                </Button>
              </div>
            </div>
            <div className="h-[calc(100%-57px)] bg-background">
              {hasHydrated && (
                <TldrawCanvas
                  initialSnapshot={initialSnapshot}
                  onChange={handleChange}
                  disabled={disabled}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-2 text-white shadow-2xl backdrop-blur">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-white/80" />
              <div>
                <p className="text-sm font-medium leading-none">Scratchpad</p>
                <p className="mt-1 text-[11px] leading-none text-white/60">
                  {disabled ? "View drawing" : "Tap expand to sketch"}
                </p>
              </div>
            </div>
            {statusLabel && (
              <Badge
                variant="outline"
                className="border-white/10 bg-white/5 text-[10px] text-white/80"
                role="status"
                aria-live="polite"
              >
                {statusLabel}
              </Badge>
            )}
            {!disabled && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  void handleSave();
                }}
                disabled={status === "saving" || !hasUnsavedChanges}
              >
                <Save className="h-3.5 w-3.5" />
                <span className="sr-only">Save scratchpad</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => requestExpandedChange(true)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="sr-only">Expand scratchpad</span>
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false} aria-describedby="scratchpad-close-description">
          <DialogHeader>
            <DialogTitle>Save scratchpad?</DialogTitle>
            <DialogDescription id="scratchpad-close-description">
              Save the current scratchpad to this encounter before closing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                void handleCloseDecision(false);
              }}
            >
              Close without saving
            </Button>
            <Button
              onClick={() => {
                void handleCloseDecision(true);
              }}
              disabled={status === "saving"}
            >
              {status === "saving" ? "Saving..." : "Save scratchpad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
