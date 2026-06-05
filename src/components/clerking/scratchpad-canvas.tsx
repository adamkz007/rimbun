"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Maximize2, Save, X } from "lucide-react";
import { saveScratchpad } from "@/lib/actions/encounter-actions";
import dynamic from "next/dynamic";

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
  const [isFullscreen, setIsFullscreen] = useState(false);
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
    if (!snapshot || disabled) return;
    if (versionToSave <= lastSavedVersionRef.current) return;

    setStatus("saving");

    try {
      await saveScratchpad(encounterId, snapshot);
      lastSavedVersionRef.current = versionToSave;
      lastSavedSnapshotRef.current = serializeSnapshot(snapshot);
      window.sessionStorage.removeItem(draftStorageKey);
      setHasUnsavedChanges(false);
      setStatus("saved");
    } catch {
      setStatus("error");
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

    await saveSnapshot();
  }, [disabled, saveSnapshot]);

  const requestClose = useCallback((open: boolean) => {
    if (open) {
      setIsFullscreen(true);
      return;
    }

    if (disabled) {
      setIsFullscreen(false);
      return;
    }

    setIsCloseConfirmOpen(true);
  }, [disabled]);

  const handleCloseDecision = useCallback(async (shouldSave: boolean) => {
    if (shouldSave) {
      await handleSave();
    }

    setIsCloseConfirmOpen(false);
    setIsFullscreen(false);
  }, [handleSave]);

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          Scratchpad
        </CardTitle>
        <div className="flex items-center gap-1">
          {status !== "idle" && (
            <Badge variant="outline" className="text-[10px] h-5">
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
              onClick={handleSave}
              disabled={status === "saving" || !hasUnsavedChanges}
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          )}
          <Dialog open={isFullscreen} onOpenChange={requestClose}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-md p-1.5 hover:bg-muted transition-colors">
              <Maximize2 className="h-3.5 w-3.5" />
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] p-0" showCloseButton={false}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-2 z-10"
                onClick={() => requestClose(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close scratchpad</span>
              </Button>
              <div className="h-full w-full">
                {hasHydrated && (
                  <TldrawCanvas
                    initialSnapshot={initialSnapshot}
                    onChange={handleChange}
                    disabled={disabled}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
            <DialogContent className="sm:max-w-md" showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Save scratchpad?</DialogTitle>
                <DialogDescription>
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
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-48 border-t">
          {!isFullscreen && hasHydrated && (
            <TldrawCanvas
              initialSnapshot={initialSnapshot}
              onChange={handleChange}
              disabled={disabled}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
