import test from "node:test";
import assert from "node:assert/strict";
import {
  getClerkingTabFromShortcut,
  shouldIgnoreClerkingShortcut,
  CLERKING_TAB_ORDER,
} from "../src/lib/clerking-shortcuts.ts";
import {
  isModuleEnabled,
  isModuleImplemented,
  isModuleVisibleInNav,
} from "../src/lib/modules.ts";
import { dismissToast, subscribeToasts, toast } from "../src/lib/toast.ts";

test("getClerkingTabFromShortcut maps Alt+digit tabs in workspace order", () => {
  assert.equal(getClerkingTabFromShortcut(1), CLERKING_TAB_ORDER[0]);
  assert.equal(getClerkingTabFromShortcut(5), "prescription");
  assert.equal(getClerkingTabFromShortcut(6), "general_notes");
  assert.equal(getClerkingTabFromShortcut(0), null);
  assert.equal(getClerkingTabFromShortcut(9), null);
});

test("shouldIgnoreClerkingShortcut ignores editable and dialog targets", () => {
  const input = { tagName: "INPUT", isContentEditable: false, closest: () => null };
  const textarea = { tagName: "TEXTAREA", isContentEditable: false, closest: () => null };
  const editor = {
    tagName: "DIV",
    isContentEditable: true,
    closest: () => null,
  };
  const dialogTarget = {
    tagName: "BUTTON",
    isContentEditable: false,
    closest: (selector: string) => (selector.includes("dialog") ? {} : null),
  };
  const panel = { tagName: "DIV", isContentEditable: false, closest: () => null };

  assert.equal(shouldIgnoreClerkingShortcut(input as EventTarget), true);
  assert.equal(shouldIgnoreClerkingShortcut(textarea as EventTarget), true);
  assert.equal(shouldIgnoreClerkingShortcut(editor as EventTarget), true);
  assert.equal(shouldIgnoreClerkingShortcut(dialogTarget as EventTarget), true);
  assert.equal(shouldIgnoreClerkingShortcut(panel as EventTarget), false);
});

test("isModuleVisibleInNav requires both clinic flag and implementation", () => {
  const enabledSettings = { modules: { queue: true } };

  assert.equal(isModuleEnabled(enabledSettings, "queue"), true);
  assert.equal(isModuleImplemented("queue"), true);
  assert.equal(isModuleVisibleInNav(enabledSettings, "queue"), true);
  assert.equal(isModuleVisibleInNav(enabledSettings, "clerking"), true);
  assert.equal(isModuleVisibleInNav(null, "queue"), false);
});

test("toast store publishes and dismisses messages", () => {
  const seen: string[] = [];
  const unsubscribe = subscribeToasts((messages) => {
    seen.push(messages.map((message) => message.title).join("|"));
  });

  const id = toast.success("Saved", "Patient record updated.");
  assert.ok(seen.some((snapshot) => snapshot.includes("Saved")));

  dismissToast(id);
  assert.ok(seen.some((snapshot) => snapshot === ""));

  unsubscribe();
});
