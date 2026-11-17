# Scratchpad: performance & stability improvement plan

Status: **Phase 0 implemented**; Phases 1–3 proposed · Scope: clerking scratchpad (`src/components/clerking/scratchpad-canvas.tsx`,
`src/components/clerking/tldraw-canvas.tsx`, `saveScratchpad` in `src/lib/actions/encounter-actions.ts`,
`persistEncounterDrafts` in `src/components/clerking/clerking-workspace.tsx`)

Symptom reported: sketching stutters on tablets.

(Line references in §3 point to the code before Phase 0.)

---

## 1. How it worked before Phase 0

```
ClerkingWorkspace
└─ ScratchpadCanvas            floating panel, fixed bottom-right, 48rem × 30rem max
   ├─ state: isExpanded, status, hasUnsavedChanges, initialSnapshot (set once at hydration)
   ├─ refs: snapshotRef, pending/lastSaved version, autosave timer
   └─ {isExpanded && <TldrawCanvas initialSnapshot onChange disabled />}   ← unmounted on collapse
        └─ <Tldraw onMount> → editor.loadSnapshot(initialSnapshot)
                              editor.store.listen(cb, { scope: "document", source: "user" })
```

On **every** user change to the document store, `cb` runs synchronously and:

1. `editor.getSnapshot()` builds a full snapshot (all document records **plus** session state).
2. `ScratchpadCanvas.handleChange` → `JSON.stringify(snapshot)` of the whole thing.
3. `sessionStorage.setItem(...)` writes that string synchronously on the main thread.
4. `setHasUnsavedChanges(true)` / `setStatus("unsaved")`.
5. Clears and re-arms a 20 s autosave `setTimeout`.

While a pen stroke is being drawn, tldraw updates the stroke's `draw` shape record on every
pointer move, so the listener fires once per pointer event. Steps 1–3 are **O(size of the whole
drawing)**, so every stroke gets slower as the drawing grows.

Persistence: autosave calls the `saveScratchpad` server action, which upserts the full snapshot JSON into
`encounter_scratchpads.canvas_data` (jsonb, one row per encounter). Completing the encounter also flushes
the sessionStorage draft through `persistEncounterDrafts`.

## 2. Measurements

**Harness:** `ScratchpadCanvas` on a throwaway route, production build (`next build && next start`),
desktop Chromium at 820 × 1180 (iPad-portrait size), **4× CPU throttling**. The run draws 5 batches of 20
mouse strokes (60 pointer moves each). Main-thread time comes from Chrome's `Performance.getMetrics`.
The "bare tldraw" row mounts `<Tldraw />` alone at the same size, with none of our code.

Script time per 20-stroke batch:

| Strokes on canvas | Bare tldraw | Old scratchpad | New scratchpad (Phase 0) |
|---|---|---|---|
| 20  | 4.65 s | 5.20 s | 4.64 s |
| 60  | 4.91 s | 7.44 s | 7.41 s* |
| 100 | 6.35 s | **9.21 s** | **7.09 s** |

\* Single runs; expect ±10–15 % noise between batches.

Draft writes (sessionStorage) per 20-stroke batch: **old ~1,080 (one per pointer move) → new ~24 (about
one per stroke)**. In an earlier dev-mode run, `stringify` plus `setItem` time per batch at 100 strokes fell
from ~3.0 s to ~0.2 s.

What this shows:

- **Our per-event work was real overhead, and it grew with the drawing.** At 100 strokes the old code
  added ~2.9 s of script per batch on top of tldraw, about 45 % more. Phase 0 cuts that to ~0.7 s, roughly
  noise level.
- **tldraw's own cost also grows with the drawing.** Bare tldraw goes from 4.7 s to 6.4 s, so even a
  perfect wrapper can't make dense drawings free.
- **Desktop Chromium did not reproduce visible stutter.** p95 frame time stayed at 16.7 ms for all three
  variants in production builds. The tablet stutter therefore probably comes from things this harness
  doesn't model:
  - Apple Pencil events arrive at up to 240 Hz, which is about 4× the listener calls here.
  - WebKit's storage and JSON performance is probably different, though that isn't verified.
  - Real strokes with pressure have more points.
  - A dev build may have been in use (dev mode is markedly slower).

  **Next step: profile on the actual iPad** with Safari Web Inspector → Timelines, comparing before and
  after Phase 0 (see Phase 0.5).

## 3. Stability defects found

| # | Defect | Impact | Evidence |
|---|---|---|---|
| S1 | **Collapse → expand shows a stale drawing.** `TldrawCanvas` unmounts on collapse; on expand it reloads `initialSnapshot`, which is only set at hydration. It never reloads `snapshotRef.current`. | The canvas comes back empty or old. The next stroke then emits a snapshot built from that stale state and autosaves over the newer data. **Data loss.** The same happens after a successful save, because `handleSave` doesn't refresh `initialSnapshot` either. | Harness: 92 shapes drawn → collapse → expand → **0 shapes rendered**. |
| S2 | `sessionStorage.setItem` is called without `try/catch` inside the store listener. | sessionStorage holds about 5 MB per origin, shared with the note and vitals drafts. Once a large sketch exceeds that, every pointer move throws inside a tldraw listener. | Code: `scratchpad-canvas.tsx:128` |
| S3 | The full snapshot is sent through a Server Action, and Next's default body limit is **1 MB**. `next.config.ts` doesn't raise it. | Large or dense sketches fail to save ("Save failed"), autosave keeps failing, and Complete fails in `persistEncounterDrafts`. | `next.config.ts` has no `serverActions.bodySizeLimit` |
| S4 | The snapshot includes **session** state (camera, current tool, page state), not just the document. | Payload bloat. Restoring also brings back the last user's camera and tool, which is odd across devices. | `editor.getSnapshot()` |
| S5 | `disabled` is only read in `onMount`, which tldraw runs once (`useOnMount` uses `useEvent`). | If the panel is open when an amendment starts or the encounter completes (`router.refresh()`), read-only mode doesn't change. When unlocked it stays read-only and drops edits; when locked it stays editable. | `tldraw-canvas.tsx:30-43`, `TldrawEditor.mjs:423-440` |
| S6 | Autosave is debounced with no max wait. Each pointer move resets the 20 s timer. | Continuous sketching never autosaves. If the tab is killed (iPadOS does this to background tabs), only the sessionStorage draft survives. | `scratchpad-canvas.tsx:132-139` |
| S7 | The unmount-save effect depends on `hasUnsavedChanges`, so its cleanup also runs on every true↔false flip, not only on unmount. Saves can overlap (autosave, manual save, cleanup) with no single in-flight guard. | Redundant requests. An older snapshot can land after a newer one. | `scratchpad-canvas.tsx:142-152`, `101-120` |
| S8 | No `licenseKey` is passed to `<Tldraw>` (tldraw 5.1, tldraw SDK license). | Check how unlicensed production builds behave under the current license terms (watermark or restrictions). | `tldraw-canvas.tsx` |

## 4. Plan

### Phase 0: stop the stutter and the data loss ✅ implemented

What changed (`scratchpad-canvas.tsx`, `tldraw-canvas.tsx`):

1. ✅ **Store listener is O(1).** It bumps a version counter and records the change time (refs only). React
   state changes only on the first change after a save. Timers are armed once and re-check the
   last-change time when they fire, so nothing is cleared and recreated per event.
2. ✅ **Serialization happens off the hot path:** on `pointer_up` (via `requestIdleCallback`), after 750 ms
   idle, on collapse, on `visibilitychange` → hidden, on `pagehide`, on unmount, and on Save.
3. ✅ **Document-only snapshots** (`editor.store.getStoreSnapshot("document")`). Old `{ document, session }`
   rows still load, because `loadSnapshot` accepts both shapes.
4. ✅ **The editor stays mounted after the first expand** (`hidden` when collapsed), which fixes S1. The
   collapse dialog now says **"Keep as draft"**, because strokes are no longer discarded on collapse; the
   draft is still saved on Complete.
5. ✅ **All storage access is wrapped in `try/catch`.** On quota or blocked storage, the code drops the
   local draft and saves to the server immediately (S2).
6. ✅ **`disabled` is applied live** via `updateInstanceState({ isReadonly })`. The listener reads it from a
   ref (S5).
7. ✅ **Autosave:** 5 s after the last change, at most 30 s while dirty (S6).
8. ✅ **Single-flight saver.** Callers wait for the in-flight save, then save the newest version. The
   unsaved flag only clears when the saved version is still the latest. The cleanup effect that ran on
   every state flip was replaced with explicit flushes (S7).
9. ✅ **Extra:** the tldraw chunk is preloaded on pointer-enter or focus of the collapsed bar, and the canvas
   container uses `contain: strict`.

Verified in the harness (Chromium, production build):

- Draft writes are ~24 per 20 strokes instead of ~1,080.
- Script overhead over bare tldraw at 100 strokes fell from ~2.9 s to ~0.7 s per batch.
- Collapse → "Keep as draft" → expand keeps all 92 of 92 shapes. The old code kept 0.
- Toggling read-only while open blocks strokes, and toggling back allows them again.
- With sessionStorage pre-filled to quota, drawing raises no page errors.
- `npm test` passes (58/58), and `tsc` is clean for the changed files.

Not done in Phase 0: S3 (Server Action size limit) and S8 (license), both in Phase 1/2.

### Phase 0.5: confirm on device (next)

Profile on the tablet where the stutter was seen, using Safari Web Inspector → Timelines (JavaScript &
Events, Rendering Frames). Use a production build, Apple Pencil, and a drawing of about 100 strokes.
Compare against the commit before Phase 0.

- If frames still drop, look at what remains on the main thread: tldraw draw-shape geometry and SVG
  rendering versus our code.
- Then prioritise the Phase 2 items: the full-screen canvas reduces pans, and also try tldraw's pen mode.

### Phase 1: payload and persistence robustness

1. **Payload size:** measure `JSON.stringify(document).length` before saving. Options, in order of preference:
   - a. Raise `experimental.serverActions.bodySizeLimit` (e.g. `"4mb"`) as a stop-gap.
   - b. Save through a Route Handler with `CompressionStream("gzip")` on the client. tldraw draw-shape
     point data compresses very well.
   - c. Longer term, store large documents in Supabase Storage and keep only a pointer and thumbnail
     in `encounter_scratchpads`. There is already an unused `thumbnail_url` column.
2. **Local draft store:** move the draft from sessionStorage to IndexedDB, which is async and has a much
   larger quota. **Privacy note:** IndexedDB outlives the tab, and these are clinical sketches on shared
   clinic tablets. Clear the entry after a successful server save and on logout. Avoid tldraw's
   `persistenceKey` for this reason (persistent, unscoped to the session).
3. **Single draft source:** `persistEncounterDrafts` reads the scratchpad draft from sessionStorage, which
   duplicates the component's state. Expose a `flush()` from the scratchpad (via a context or ref
   registry) so Complete saves exactly what the editor holds.
4. **Conflict safety:** add `updated_at` to `encounter_scratchpads` and send the last-seen value with each
   save, so two devices editing one encounter don't silently overwrite each other.

### Phase 2: tablet UX that affects perceived smoothness

1. **Full-screen sketch mode on touch devices** (`pointer: coarse`, or width < lg). Use `inset-0` with
   `h-dvh` instead of a 48 × 30 rem floating panel. A larger canvas needs fewer camera pans, and `dvh`
   avoids Safari toolbar resize jumps (the panel currently uses `100vh`).
2. ✅ *(done in Phase 0)* **Isolate the canvas:** add `contain: strict` (or `layout paint size`) on the canvas container so
   paints and layout in the clerking page behind it don't invalidate it.
3. ✅ *(done in Phase 0)* **Preload the editor chunk** on idle or on pointer-enter of the collapsed bar
   (`import("./tldraw-canvas")`), so the first expand on a tablet doesn't block for the download and parse.
4. **Pen ergonomics:** keep tldraw's pen mode (palm rejection), and default to the draw tool with a
   sensible stroke size when the panel opens empty.
5. **Licensing (S8):** add `licenseKey` from env if production use requires it.

### Phase 3: guardrails

- Commit the benchmark as `scripts/perf/scratchpad-bench.mjs`. It mounts the canvas on a dev-only route,
  draws N strokes under CPU throttling and prints the table above. Run it before and after each phase.
- Add a Playwright regression test for the collapse → expand round-trip (S1) and for read-only toggling (S5).
- Track client errors from the scratchpad (save failures, quota errors) so field problems on tablets are visible.

## 5. Suggested order and size

| Step | Size | Fixes |
|---|---|---|
| Phase 0 | ✅ done | Per-event overhead, S1, S2, S4, S5, S6, S7 |
| Phase 0.5 (device profiling) | ~1 h | Confirms what still costs frames on the tablet |
| Phase 1.1a (body limit) | minutes | S3 stop-gap |
| Phase 1.1b–1.4 | 1–2 days | S3 properly, draft privacy, conflicts |
| Phase 2 | ~1 day | Tablet feel |
| Phase 3 | ~½ day | Prevent regressions |

Phase 0 removed the measurable overhead from our code. Whether that is enough for the tablet has to be
confirmed on the device (Phase 0.5) before choosing between Phase 1 and Phase 2.
