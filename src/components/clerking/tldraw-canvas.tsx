"use client";

import { useCallback, useRef } from "react";
import { Tldraw, Editor } from "tldraw";
import "tldraw/tldraw.css";

export default function TldrawCanvas({
  initialSnapshot,
  onChange,
  disabled,
}: {
  initialSnapshot: Record<string, unknown> | null;
  onChange: (snapshot: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const editorRef = useRef<Editor | null>(null);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;

      if (initialSnapshot) {
        try {
          editor.loadSnapshot(initialSnapshot as Parameters<Editor["loadSnapshot"]>[0]);
        } catch {
          // Invalid snapshot data, start fresh
        }
      }

      if (disabled) {
        editor.updateInstanceState({ isReadonly: true });
      }

      // Listen for changes and emit snapshots
      const unsub = editor.store.listen(
        () => {
          if (!disabled) {
            const snapshot = editor.getSnapshot();
            onChange(snapshot as unknown as Record<string, unknown>);
          }
        },
        { scope: "document", source: "user" }
      );

      return () => {
        unsub();
      };
    },
    [initialSnapshot, onChange, disabled]
  );

  return (
    <div className="h-full w-full [&_.tl-background]:bg-white">
      <Tldraw
        onMount={handleMount}
        hideUi={disabled}
      />
    </div>
  );
}
