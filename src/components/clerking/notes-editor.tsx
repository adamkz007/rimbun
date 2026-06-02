"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { saveNote } from "@/lib/actions/encounter-actions";
import type { NoteSection } from "@/types/database";
import { Badge } from "@/components/ui/badge";

const PLACEHOLDERS: Record<NoteSection, string> = {
  chief_complaint: "Patient presents with...",
  history: "History of presenting illness, past medical history...",
  examination: "Physical examination findings...",
  assessment: "Clinical assessment notes...",
  plan: "Management plan, follow-up...",
  general_notes: "Additional notes...",
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
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: PLACEHOLDERS[section] }),
    ],
    content: initialContent ?? undefined,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[200px] focus:outline-none px-3 py-2",
      },
    },
  });

  const { status } = useAutosave(
    editor?.getJSON() ?? null,
    async (content) => {
      if (!content) return;
      await saveNote(encounterId, section, content);
    },
    { enabled: !disabled && !!editor }
  );

  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground capitalize">
          {section.replace("_", " ")}
        </span>
        {status !== "idle" && (
          <Badge variant="outline" className="text-[10px] h-5">
            {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Error"}
          </Badge>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
