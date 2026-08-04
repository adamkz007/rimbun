"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

function serializeDraft<T>(value: T) {
  return JSON.stringify(value ?? null);
}

function parseDraft<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type DraftState<T> = {
  value: T;
  hasHydrated: boolean;
  persistedSerialized: string;
};

type DraftAction<T> =
  | { type: "hydrate"; value: T; persistedSerialized: string }
  | { type: "set_value"; value: T }
  | { type: "mark_persisted"; persistedSerialized: string }
  | { type: "reset"; value: T; persistedSerialized: string };

function draftReducer<T>(state: DraftState<T>, action: DraftAction<T>): DraftState<T> {
  switch (action.type) {
    case "hydrate":
      return {
        value: action.value,
        hasHydrated: true,
        persistedSerialized: action.persistedSerialized,
      };
    case "set_value":
      return {
        ...state,
        value: action.value,
      };
    case "mark_persisted":
      return {
        ...state,
        persistedSerialized: action.persistedSerialized,
      };
    case "reset":
      return {
        value: action.value,
        hasHydrated: true,
        persistedSerialized: action.persistedSerialized,
      };
    default:
      return state;
  }
}

export function useLocalDraft<T>(
  storageKey: string,
  serverValue: T,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const serverSerialized = useMemo(() => serializeDraft(serverValue), [serverValue]);
  const [state, dispatch] = useReducer(draftReducer<T>, {
    value: serverValue,
    hasHydrated: false,
    persistedSerialized: serverSerialized,
  });
  const enabledRef = useRef(enabled);
  const hydratedRef = useRef(false);
  const persistedSerializedRef = useRef(serverSerialized);

  useEffect(() => {
    enabledRef.current = enabled;
    hydratedRef.current = state.hasHydrated;
    persistedSerializedRef.current = state.persistedSerialized;
  }, [enabled, state.hasHydrated, state.persistedSerialized]);

  useEffect(() => {
    if (!enabled) {
      dispatch({
        type: "hydrate",
        value: serverValue,
        persistedSerialized: serverSerialized,
      });
      return;
    }

    const storedDraft = window.sessionStorage.getItem(storageKey);
    if (storedDraft !== null) {
      dispatch({
        type: "hydrate",
        value: parseDraft(storedDraft, serverValue),
        persistedSerialized: serverSerialized,
      });
    } else {
      dispatch({
        type: "hydrate",
        value: serverValue,
        persistedSerialized: serverSerialized,
      });
    }
  }, [enabled, serverSerialized, serverValue, storageKey]);

  const currentSerialized = useMemo(() => serializeDraft(state.value), [state.value]);
  const hasLocalChanges = currentSerialized !== state.persistedSerialized;

  useEffect(() => {
    if (!enabled || !state.hasHydrated) return;

    if (hasLocalChanges) {
      window.sessionStorage.setItem(storageKey, currentSerialized);
      return;
    }

    window.sessionStorage.removeItem(storageKey);
  }, [currentSerialized, enabled, hasLocalChanges, state.hasHydrated, storageKey]);

  const setValue = useCallback((valueOrUpdater: T | ((previousValue: T) => T)) => {
    const nextValue = typeof valueOrUpdater === "function"
      ? (valueOrUpdater as (previousValue: T) => T)(state.value)
      : valueOrUpdater;

    if (enabledRef.current && hydratedRef.current) {
      const nextSerialized = serializeDraft(nextValue);
      if (nextSerialized === persistedSerializedRef.current) {
        window.sessionStorage.removeItem(storageKey);
      } else {
        window.sessionStorage.setItem(storageKey, nextSerialized);
      }
    }

    dispatch({ type: "set_value", value: nextValue });
  }, [state.value, storageKey]);

  const markPersisted = useCallback((persistedValue: T) => {
    dispatch({
      type: "mark_persisted",
      persistedSerialized: serializeDraft(persistedValue),
    });
    window.sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  const resetToServer = useCallback(() => {
    dispatch({
      type: "reset",
      value: serverValue,
      persistedSerialized: serverSerialized,
    });
    window.sessionStorage.removeItem(storageKey);
  }, [serverSerialized, serverValue, storageKey]);

  return {
    value: state.value,
    setValue,
    hasHydrated: state.hasHydrated,
    hasLocalChanges,
    markPersisted,
    resetToServer,
  };
}
