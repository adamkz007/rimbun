"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tldraw, type Editor, type TLEventInfo } from "tldraw";
import "tldraw/tldraw.css";

export type TldrawCanvasProps = {
  initialSnapshot: Record<string, unknown> | null;
  disabled: boolean;
  /** Called with the editor once mounted, and with null on unmount. */
  onEditor: (editor: Editor | null) => void;
  /**
   * Called on every user change to the document. Fires once per pointer move
   * while drawing, so it must stay O(1): no serialization, no storage, no
   * React state updates.
   */
  onDocumentChange: () => void;
  /** Called when a pointer is released, i.e. a stroke or gesture has ended. */
  onGestureEnd: () => void;
};

export default function TldrawCanvas({
  initialSnapshot,
  disabled,
  onEditor,
  onDocumentChange,
  onGestureEnd,
}: TldrawCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  // tldraw only runs onMount once, so read the latest props through refs.
  const disabledRef = useRef(disabled);
  const callbacksRef = useRef({ onEditor, onDocumentChange, onGestureEnd });
  const initialSnapshotRef = useRef(initialSnapshot);

  useEffect(() => {
    callbacksRef.current = { onEditor, onDocumentChange, onGestureEnd };
  }, [onEditor, onDocumentChange, onGestureEnd]);

  useEffect(() => {
    disabledRef.current = disabled;
    editor?.updateInstanceState({ isReadonly: disabled });
  }, [editor, disabled]);

  const handleMount = useCallback((mounted: Editor) => {
    const snapshot = initialSnapshotRef.current;
    if (snapshot) {
      try {
        mounted.loadSnapshot(snapshot as Parameters<Editor["loadSnapshot"]>[0]);
      } catch {
        // Invalid snapshot data, start fresh
      }
    }

    mounted.updateInstanceState({ isReadonly: disabledRef.current });

    const unlisten = mounted.store.listen(
      () => {
        if (!disabledRef.current) callbacksRef.current.onDocumentChange();
      },
      { scope: "document", source: "user" }
    );

    const handleEvent = (info: TLEventInfo) => {
      if (info.name === "pointer_up" && !disabledRef.current) {
        callbacksRef.current.onGestureEnd();
      }
    };
    mounted.on("event", handleEvent);

    setEditor(mounted);
    callbacksRef.current.onEditor(mounted);

    return () => {
      unlisten();
      mounted.off("event", handleEvent);
      callbacksRef.current.onEditor(null);
    };
  }, []);

  return (
    <div className="h-full w-full [contain:strict] [&_.tl-background]:bg-white">
      <Tldraw onMount={handleMount} hideUi={disabled} />
    </div>
  );
}
