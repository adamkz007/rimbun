"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  dismissToast,
  subscribeToasts,
  type ToastMessage,
} from "@/lib/toast";

function ToastItem({ toast }: { toast: ToastMessage }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg ring-1 ring-foreground/10",
        toast.variant === "success" && "border-emerald-500/30",
        toast.variant === "error" && "border-destructive/30"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{toast.title}</p>
          {toast.description ? (
            <p className="text-sm text-muted-foreground">{toast.description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={() => dismissToast(toast.id)}
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
