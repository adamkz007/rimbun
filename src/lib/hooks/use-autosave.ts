"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

function serializeData<T>(value: T) {
  return JSON.stringify(value ?? null);
}

type AutosaveState = {
  status: SaveStatus;
  lastSavedSerialized: string;
  hasUnsavedChanges: boolean;
};

type AutosaveAction =
  | { type: "sync_baseline"; baseline: string; current: string }
  | { type: "sync_dirty"; dirty: boolean }
  | { type: "saving" }
  | { type: "saved"; serialized: string }
  | { type: "error" };

function autosaveReducer(state: AutosaveState, action: AutosaveAction): AutosaveState {
  switch (action.type) {
    case "sync_baseline": {
      const nextHasUnsavedChanges = action.current !== action.baseline;
      const nextStatus =
        state.status === "saving"
          ? state.status
          : nextHasUnsavedChanges
            ? "unsaved"
            : "idle";

      if (
        state.lastSavedSerialized === action.baseline &&
        state.hasUnsavedChanges === nextHasUnsavedChanges &&
        state.status === nextStatus
      ) {
        return state;
      }

      return {
        ...state,
        lastSavedSerialized: action.baseline,
        hasUnsavedChanges: nextHasUnsavedChanges,
        status: nextStatus,
      };
    }
    case "sync_dirty": {
      const nextHasUnsavedChanges = action.dirty;
      const nextStatus = action.dirty
        ? state.status === "error"
          ? "error"
          : "unsaved"
        : state.status === "saving"
          ? "saving"
          : "idle";

      if (
        state.hasUnsavedChanges === nextHasUnsavedChanges &&
        state.status === nextStatus
      ) {
        return state;
      }

      return {
        ...state,
        hasUnsavedChanges: nextHasUnsavedChanges,
        status: nextStatus,
      };
    }
    case "saving":
      return state.status === "saving"
        ? state
        : {
            ...state,
            status: "saving",
          };
    case "saved":
      if (
        state.status === "saved" &&
        state.lastSavedSerialized === action.serialized &&
        !state.hasUnsavedChanges
      ) {
        return state;
      }

      return {
        status: "saved",
        lastSavedSerialized: action.serialized,
        hasUnsavedChanges: false,
      };
    case "error":
      return state.status === "error"
        ? state
        : {
            ...state,
            status: "error",
          };
    default:
      return state;
  }
}

export function useAutosave<T>(
  data: T,
  saveFn: (data: T) => Promise<void>,
  {
    delay = 2000,
    enabled = true,
    initialData,
    onSaveSuccess,
  }: {
    delay?: number;
    enabled?: boolean;
    initialData?: T;
    onSaveSuccess?: (data: T) => void;
  } = {}
) {
  const [state, dispatch] = useReducer(autosaveReducer, {
    status: "idle" as SaveStatus,
    lastSavedSerialized: serializeData(initialData ?? data),
    hasUnsavedChanges: serializeData(data) !== serializeData(initialData ?? data),
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef(data);
  const enabledRef = useRef(enabled);
  const saveFnRef = useRef(saveFn);
  const onSaveSuccessRef = useRef(onSaveSuccess);
  const lastSavedSerializedRef = useRef(serializeData(initialData ?? data));

  const initialSerialized = serializeData(initialData);

  useEffect(() => {
    latestDataRef.current = data;
    enabledRef.current = enabled;
    saveFnRef.current = saveFn;
    onSaveSuccessRef.current = onSaveSuccess;
  }, [data, enabled, saveFn, onSaveSuccess]);

  useEffect(() => {
    lastSavedSerializedRef.current = initialSerialized;
    dispatch({
      type: "sync_baseline",
      baseline: initialSerialized,
      current: initialSerialized,
    });
  }, [initialSerialized]);

  const save = useCallback(async (dataToSave: T) => {
    const serialized = serializeData(dataToSave);
    if (serialized === lastSavedSerializedRef.current) return;

    dispatch({ type: "saving" });
    try {
      await saveFnRef.current(dataToSave);
      lastSavedSerializedRef.current = serialized;
      dispatch({ type: "saved", serialized });
      onSaveSuccessRef.current?.(dataToSave);
    } catch {
      dispatch({ type: "error" });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const serialized = serializeData(data);
    const dirty = serialized !== lastSavedSerializedRef.current;
    dispatch({ type: "sync_dirty", dirty });

    if (!dirty) {
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void save(data);
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [data, delay, enabled, save]);

  // Flush pending changes on unmount without re-running when `save` identity changes.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (enabledRef.current) {
        void save(latestDataRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only cleanup
  }, []);

  const saveNow = useCallback((dataOverride?: T) => save(dataOverride ?? latestDataRef.current), [save]);

  return { status: state.status, saveNow, hasUnsavedChanges: state.hasUnsavedChanges };
}
