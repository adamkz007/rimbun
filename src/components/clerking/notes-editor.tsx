"use client";

import { useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { useLocalDraft } from "@/lib/hooks/use-local-draft";
import { saveNote } from "@/lib/actions/encounter-actions";
import { toast } from "@/lib/toast";
import type { NoteSection } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

const PLACEHOLDERS: Record<NoteSection, string> = {
  chief_complaint: "Patient presents with...",
  history: "History of presenting illness, past medical history...",
  examination: "Physical examination findings...",
  diagnosis: "Clinical diagnosis notes...",
  general_notes: "Additional notes...",
};

const EMPTY_NOTE_CONTENT: Record<string, unknown> = {
  type: "doc",
  content: [],
};

export function NotesEditor({
  encounterId,
  section,
  initialContent,
  disabled,
}: {
  encounterId: string;
  section: NoteSection;
  initialContent: Record<string, unknown> | null;
  disabled: boolean;
}) {
  const {
    value: content,
    setValue: setContent,
    hasHydrated,
    markPersisted,
  } = useLocalDraft(
    `clerking:draft:note:${encounterId}:${section}`,
    initialContent,
    { enabled: !disabled }
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: PLACEHOLDERS[section] }),
    ],
    content: initialContent ?? undefined,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      setContent(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[200px] focus:outline-none px-3 py-2",
      },
    },
  });

  useEffect(() => {
    if (!editor || !hasHydrated) return;

    const nextContent = content ?? EMPTY_NOTE_CONTENT;
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(nextContent)) return;

    editor.commands.setContent(nextContent, { emitUpdate: false });
  }, [content, editor, hasHydrated]);

  const { status, saveNow, hasUnsavedChanges } = useAutosave(
    content,
    async (content) => {
      if (!content) return;
      await saveNote(encounterId, section, content);
    },
    {
      delay: 8000,
      enabled: hasHydrated && !disabled && !!editor && content !== null,
      initialData: initialContent,
      onSaveSuccess: markPersisted,
    }
  );

  const handleSaveCurrentContent = useCallback(async () => {
    const latestContent = (editor?.getJSON() as Record<string, unknown> | undefined) ?? content;
    if (!latestContent) return Promise.resolve();

    setContent(latestContent);
    await saveNow(latestContent);
    toast.success("Note saved", section.replaceAll("_", " "));
  }, [content, editor, saveNow, section, setContent]);

  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground capitalize">
          {section.replace("_", " ")}
        </span>
        <div className="flex items-center gap-1">
          {status !== "idle" && (
            <Badge
              variant="outline"
              className="text-[10px] h-5"
              role="status"
              aria-live="polite"
            >
              {status === "unsaved"
                ? "Unsaved"
                : status === "saving"
                  ? "Saving..."
                  : status === "saved"
                    ? "Saved"
                    : "Save failed"}
            </Badge>
          )}
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleSaveCurrentContent()}
              disabled={status === "saving" || !hasUnsavedChanges}
              aria-label={`Save ${section.replaceAll("_", " ")} note`}
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <EditorContent editor={editor} onBlur={() => void handleSaveCurrentContent()} />
    </div>
  );
}
