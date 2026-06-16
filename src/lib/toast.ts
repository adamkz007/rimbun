export type ToastVariant = "default" | "success" | "error";

export type ToastMessage = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

const DEFAULT_DURATION_MS = 4000;

let toasts: ToastMessage[] = [];
const listeners = new Set<(nextToasts: ToastMessage[]) => void>();
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) {
    listener(toasts);
  }
}

function createToastId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function dismissToast(id: string) {
  const timer = dismissTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }

  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function toast(input: ToastInput) {
  const id = createToastId();
  const nextToast: ToastMessage = {
    id,
    title: input.title,
    description: input.description,
    variant: input.variant ?? "default",
  };

  toasts = [...toasts, nextToast];
  emit();

  const timer = setTimeout(() => {
    dismissToast(id);
  }, input.durationMs ?? DEFAULT_DURATION_MS);
  dismissTimers.set(id, timer);

  return id;
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: "success" });

toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: "error" });

export function subscribeToasts(listener: (nextToasts: ToastMessage[]) => void) {
  listeners.add(listener);
  listener(toasts);

  return () => {
    listeners.delete(listener);
  };
}
