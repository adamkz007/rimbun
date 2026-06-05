"use client";

import { useEffect, useRef } from "react";

export function useDebounce(value: string, delay: number, callback: (value: string) => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const timer = setTimeout(() => {
      callbackRef.current(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
}
