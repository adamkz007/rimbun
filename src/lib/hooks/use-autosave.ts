"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutosave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  { delay = 2000, enabled = true }: { delay?: number; enabled?: boolean } = {}
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>("");
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const save = useCallback(async (dataToSave: T) => {
    const serialized = JSON.stringify(dataToSave);
    if (serialized === lastSavedRef.current) return;

    setStatus("saving");
    try {
      await saveFnRef.current(dataToSave);
      lastSavedRef.current = serialized;
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(data), delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [data, delay, enabled, save]);

  const saveNow = useCallback(() => save(data), [data, save]);

  return { status, saveNow };
}
