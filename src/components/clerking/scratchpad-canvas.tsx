"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { Editor } from "tldraw";
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

const loadTldrawCanvas = () => import("./tldraw-canvas");

const TldrawCanvas = dynamic(loadTldrawCanvas, {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading canvas...
    </div>
  ),
});

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";
type Snapshot = Record<string, unknown>;

/** Write the local draft this long after the last change, if no gesture end came first. */
const DRAFT_IDLE_MS = 750;
/** Autosave to the server this long after the last change... */
const AUTOSAVE_IDLE_MS = 5_000;
/** ...but never wait longer than this while there are unsaved changes. */
const AUTOSAVE_MAX_WAIT_MS = 30_000;

function serializeSnapshot(snapshot: Snapshot | null) {
  return JSON.stringify(snapshot ?? null);
}

function readDraft(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when the draft could not be stored (quota exceeded, storage blocked). */
function writeDraft(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    removeDraft(key);
    return false;
  }
}

function removeDraft(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Storage unavailable; nothing to clean up.
  }
}

function scheduleIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 250 });
  } else {
    setTimeout(callback, 0);
  }
}

export function ScratchpadCanvas({
  encounterId,
  initialData,
  disabled,
}: {
  encounterId: string;
  initialData: Snapshot | null;
  disabled: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Once opened, the editor stays mounted (hidden when collapsed) so collapsing
  // never discards strokes and re-expanding doesn't re-initialize tldraw.
  const [hasOpened, setHasOpened] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<Snapshot | null>(initialData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const editorRef = useRef<Editor | null>(null);
  /** Latest serialized-able document when the editor is not mounted. */
  const snapshotRef = useRef<Snapshot | null>(initialData);
  /** Bumped on every change; cheap. */
  const versionRef = useRef(0);
  /** Version last written to the local draft. */
  const draftVersionRef = useRef(0);
  /** Version last confirmed saved on the server. */
  const savedVersionRef = useRef(0);
  const lastChangeAtRef = useRef(0);
  const firstUnsavedAtRef = useRef<number | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightSaveRef = useRef<Promise<unknown> | null>(null);
  const dirtyRef = useRef(false);
  const disabledRef = useRef(disabled);
  const draftStorageKey = `clerking:draft:scratchpad:${encounterId}`;

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const clearTimers = useCallback(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    draftTimerRef.current = null;
    autosaveTimerRef.current = null;
  }, []);

  const markClean = useCallback(() => {
    dirtyRef.current = false;
    firstUnsavedAtRef.current = null;
    setHasUnsavedChanges(false);
  }, []);

  useEffect(() => {
    const serverSerialized = serializeSnapshot(initialData);
    clearTimers();
    versionRef.current = 0;
    draftVersionRef.current = 0;
    savedVersionRef.current = 0;
    // Hydrating from sessionStorage (an external store) on mount / encounter change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    markClean();

    if (disabled) {
      snapshotRef.current = initialData;
      setInitialSnapshot(initialData);
      setStatus("idle");
      setHasHydrated(true);
      return;
    }

    const storedDraft = readDraft(draftStorageKey);
    let parsedDraft: Snapshot | null = null;
    if (storedDraft) {
      try {
        parsedDraft = JSON.parse(storedDraft) as Snapshot;
      } catch {
        removeDraft(draftStorageKey);
      }
    }

    if (parsedDraft && storedDraft !== serverSerialized) {
      snapshotRef.current = parsedDraft;
      setInitialSnapshot(parsedDraft);
      // Treat the restored draft as one unsaved change so Save/autosave pick it up.
      versionRef.current = 1;
      draftVersionRef.current = 1;
      dirtyRef.current = true;
      firstUnsavedAtRef.current = Date.now();
      setHasUnsavedChanges(true);
      setStatus("unsaved");
    } else {
      snapshotRef.current = parsedDraft ?? initialData;
      setInitialSnapshot(parsedDraft ?? initialData);
      setStatus("idle");
    }

    setHasHydrated(true);
  }, [clearTimers, disabled, draftStorageKey, encounterId, initialData, markClean]);

  /** Serialize the current document. Only call off the per-pointer-event path. */
  const captureSnapshot = useCallback((): Snapshot | null => {
    const editor = editorRef.current;
    if (editor) {
      // Document only: camera, tool and selection are per-device session state.
      snapshotRef.current = editor.store.getStoreSnapshot("document") as unknown as Snapshot;
    }
    return snapshotRef.current;
  }, []);

  const saveSnapshot = useCallback(async (): Promise<boolean> => {
    if (disabledRef.current) return false;

    // Single flight: wait for any running save, then save whatever is newest.
    while (inFlightSaveRef.current) {
      await inFlightSaveRef.current.catch(() => undefined);
    }

    const versionToSave = versionRef.current;
    if (versionToSave <= savedVersionRef.current) return true;

    const snapshot = captureSnapshot();
    if (!snapshot) return false;

    setStatus("saving");
    const request = saveScratchpad(encounterId, snapshot);
    inFlightSaveRef.current = request;

    try {
      await request;
      savedVersionRef.current = Math.max(savedVersionRef.current, versionToSave);
      if (versionRef.current === versionToSave) {
        removeDraft(draftStorageKey);
        markClean();
        setStatus("saved");
      } else {
        setStatus("unsaved");
      }
      return true;
    } catch {
      setStatus("error");
      return false;
    } finally {
      if (inFlightSaveRef.current === request) inFlightSaveRef.current = null;
    }
  }, [captureSnapshot, draftStorageKey, encounterId, markClean]);

  /** Persist the local draft now (off the hot path). */
  const flushDraft = useCallback(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    if (disabledRef.current || versionRef.current <= draftVersionRef.current) return;

    const version = versionRef.current;
    const snapshot = captureSnapshot();
    if (!snapshot) return;

    if (writeDraft(draftStorageKey, serializeSnapshot(snapshot))) {
      draftVersionRef.current = version;
    } else {
      // Local draft can't be kept (e.g. storage quota): save to the server right away.
      void saveSnapshot();
    }
  }, [captureSnapshot, draftStorageKey, saveSnapshot]);

  const armAutosave = useCallback(() => {
    if (autosaveTimerRef.current) return;

    const tick = () => {
      autosaveTimerRef.current = null;
      if (!dirtyRef.current) return;
      const firstUnsavedAt = firstUnsavedAtRef.current ?? lastChangeAtRef.current;
      const dueAt = Math.min(
        lastChangeAtRef.current + AUTOSAVE_IDLE_MS,
        firstUnsavedAt + AUTOSAVE_MAX_WAIT_MS
      );
      const wait = dueAt - Date.now();
      if (wait > 0) {
        autosaveTimerRef.current = setTimeout(tick, wait);
        return;
      }
      flushDraft();
      void saveSnapshot();
    };

    autosaveTimerRef.current = setTimeout(tick, AUTOSAVE_IDLE_MS);
  }, [flushDraft, saveSnapshot]);

  const armDraftTimer = useCallback(() => {
    if (draftTimerRef.current) return;

    const tick = () => {
      draftTimerRef.current = null;
      const wait = lastChangeAtRef.current + DRAFT_IDLE_MS - Date.now();
      if (wait > 0) {
        draftTimerRef.current = setTimeout(tick, wait);
        return;
      }
      scheduleIdle(flushDraft);
    };

    draftTimerRef.current = setTimeout(tick, DRAFT_IDLE_MS);
  }, [flushDraft]);

  // Hot path: runs once per pointer move while drawing. Refs only; timers are
  // armed once and re-check the last-change time when they fire, instead of
  // being cleared and re-created on every event.
  const handleDocumentChange = useCallback(() => {
    if (disabledRef.current) return;

    versionRef.current += 1;
    lastChangeAtRef.current = Date.now();

    if (!dirtyRef.current) {
      dirtyRef.current = true;
      firstUnsavedAtRef.current = lastChangeAtRef.current;
      setHasUnsavedChanges(true);
      setStatus("unsaved");
    }

    armDraftTimer();
    armAutosave();
  }, [armAutosave, armDraftTimer]);

  const handleGestureEnd = useCallback(() => {
    scheduleIdle(flushDraft);
  }, [flushDraft]);

  const handleEditor = useCallback((editor: Editor | null) => {
    if (!editor && editorRef.current) {
      // Capture the final state before the editor goes away.
      snapshotRef.current = editorRef.current.store.getStoreSnapshot("document") as unknown as Snapshot;
    }
    editorRef.current = editor;
  }, []);

  // Flush when the tab is hidden or closed (iPadOS may discard background tabs),
  // and on unmount.
  useEffect(() => {
    const flushAndSave = () => {
      flushDraft();
      if (dirtyRef.current) void saveSnapshot();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushAndSave();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushAndSave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushAndSave);
      clearTimers();
      flushAndSave();
    };
  }, [clearTimers, flushDraft, saveSnapshot]);

  const handleSave = useCallback(async () => {
    if (disabledRef.current) return;
    if (!editorRef.current && !snapshotRef.current) return;

    clearTimers();
    flushDraft();

    // Allow an explicit save of a restored draft or an untouched canvas.
    if (versionRef.current <= savedVersionRef.current && dirtyRef.current) {
      versionRef.current = savedVersionRef.current + 1;
    }

    const saved = await saveSnapshot();
    if (saved) {
      toast.success("Scratchpad saved");
    } else {
      toast.error("Scratchpad save failed", "Please try again.");
    }
  }, [clearTimers, flushDraft, saveSnapshot]);

  const requestExpandedChange = useCallback((open: boolean) => {
    if (open) {
      setHasOpened(true);
      setIsExpanded(true);
      return;
    }

    flushDraft();

    if (disabled || !hasUnsavedChanges) {
      setIsExpanded(false);
      return;
    }

    setIsCloseConfirmOpen(true);
  }, [disabled, flushDraft, hasUnsavedChanges]);

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
        {hasOpened && (
          <div
            className={cn(
              "pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-white shadow-2xl",
              "h-[min(30rem,calc(100vh-6rem))] w-[min(48rem,calc(100vw-2rem))]",
              !isExpanded && "hidden"
            )}
            aria-hidden={!isExpanded}
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
                  disabled={disabled}
                  onEditor={handleEditor}
                  onDocumentChange={handleDocumentChange}
                  onGestureEnd={handleGestureEnd}
                />
              )}
            </div>
          </div>
        )}
        {!isExpanded && (
          <div
            onPointerEnter={() => void loadTldrawCanvas()}
            onFocus={() => void loadTldrawCanvas()}
            className="pointer-events-auto flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/95 px-4 py-2 text-white shadow-2xl backdrop-blur"
          >
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
              Save the current scratchpad to this encounter before closing? If you don&apos;t, it stays as an unsaved draft and is saved when the encounter is completed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                void handleCloseDecision(false);
              }}
            >
              Keep as draft
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
