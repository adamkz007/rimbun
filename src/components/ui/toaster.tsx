"use client";

import { useEffect, useState } from "react";
import { Bell, Check, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dismissToast,
  subscribeToasts,
  type ToastMessage,
  type ToastVariant,
} from "@/lib/toast";

// Styled after the floating "Next in queue" card on the landing page: a frosted
// card with a coloured icon tile.
const VARIANT_TILE: Record<ToastVariant, { className: string; icon: typeof Bell }> = {
  default: { className: "bg-leaf-ink text-leaf-paper", icon: Bell },
  success: { className: "bg-leaf text-white", icon: Check },
  error: { className: "bg-destructive text-white", icon: TriangleAlert },
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const tile = VARIANT_TILE[toast.variant];
  const Icon = tile.icon;

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-white/70 bg-white/90 py-2.5 pr-2 pl-2.5 shadow-xl shadow-leaf-ink/12 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tile.className)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5 py-0.5">
        <p className="text-sm font-semibold text-leaf-text">{toast.title}</p>
        {toast.description ? (
          <p className="text-[13px] leading-snug text-leaf-muted">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-leaf-muted transition-colors hover:bg-leaf-mist hover:text-leaf-ink"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
      >
        <X className="size-4" />
      </button>
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
      className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:top-20 sm:right-6 sm:w-96"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
