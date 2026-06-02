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
import { useAutosave } from "@/lib/hooks/use-autosave";
import dynamic from "next/dynamic";

const TldrawCanvas = dynamic(() => import("./tldraw-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading canvas...
    </div>
  ),
});

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
  const [currentSnapshot, setCurrentSnapshot] = useState<Record<string, unknown> | null>(initialData);
  const snapshotRef = useRef<Record<string, unknown> | null>(initialData);

  useEffect(() => {
    setCurrentSnapshot(initialData);
    snapshotRef.current = initialData;
  }, [initialData, encounterId]);

  const handleChange = useCallback((snapshot: Record<string, unknown>) => {
    snapshotRef.current = snapshot;
    setCurrentSnapshot(snapshot);
  }, []);

  const { status, saveNow } = useAutosave(
    currentSnapshot,
    async (snapshot) => {
      if (!snapshot) return;
      await saveScratchpad(encounterId, snapshot);
    },
    { enabled: !disabled && !!currentSnapshot }
  );

  const handleSave = useCallback(async () => {
    if (!snapshotRef.current || disabled) return;
    await saveNow();
  }, [disabled, saveNow]);

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
              {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Error"}
            </Badge>
          )}
          {!disabled && (
            <Button variant="ghost" size="sm" onClick={handleSave} disabled={status === "saving"}>
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
                <TldrawCanvas
                  initialSnapshot={currentSnapshot}
                  onChange={handleChange}
                  disabled={disabled}
                />
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
          <TldrawCanvas
            initialSnapshot={currentSnapshot}
            onChange={handleChange}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
