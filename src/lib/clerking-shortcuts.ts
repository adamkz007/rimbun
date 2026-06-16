export type ClerkingTab =
  | "chief_complaint"
  | "history"
  | "examination"
  | "diagnosis"
  | "prescription"
  | "general_notes";

export const CLERKING_TAB_ORDER: ClerkingTab[] = [
  "chief_complaint",
  "history",
  "examination",
  "diagnosis",
  "prescription",
  "general_notes",
];

export function getClerkingTabFromShortcut(digit: number): ClerkingTab | null {
  if (digit < 1 || digit > CLERKING_TAB_ORDER.length) {
    return null;
  }

  return CLERKING_TAB_ORDER[digit - 1] ?? null;
}

export function shouldIgnoreClerkingShortcut(target: EventTarget | null) {
  if (!target || typeof target !== "object" || !("tagName" in target)) {
    return false;
  }

  const element = target as HTMLElement;
  const tagName = element.tagName;

  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }

  if ("isContentEditable" in element && element.isContentEditable) {
    return true;
  }

  if (typeof element.closest !== "function") {
    return false;
  }

  return Boolean(
    element.closest(
      "[role='combobox'], [role='listbox'], [role='dialog'], [data-slot='command-dialog']"
    )
  );
}
