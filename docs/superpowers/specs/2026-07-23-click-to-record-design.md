# Click-to-record mic button

## Problem
The mic button in the AI quick-add form ([quick-add-task-form.tsx](../../../src/components/gentle/quick-add-task-form.tsx)) requires the user to press and hold (`onPointerDown`/`onPointerUp`) while speaking. This is uncomfortable, especially on mobile, and users expect a simple click-to-start/click-to-stop toggle instead.

## Design
Replace the hold gesture with a click toggle:

- First click: start listening (same as today's press).
- Second click: stop listening, which triggers the existing parse-on-end flow (same as today's release).
- No auto-stop on silence — recognition only stops when the user clicks again. This matches current behavior, since `continuous: true` in [use-speech-recognition.ts](../../../src/hooks/use-speech-recognition.ts) never auto-stops on silence either.

### Changes
- `quick-add-task-form.tsx`: replace `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` handlers on the mic `Button` with a single `onClick` that calls `handleMicPress()` if not listening, or `handleMicRelease()` if listening. Drop `touch-none select-none` classes and `onContextMenu` prevention (no longer needed without a hold gesture).
- Update copy that references holding/releasing:
  - `aria-label`: "Утримуй, щоб наговорити задачу" → "Натисни, щоб наговорити задачу"
  - Listening hint text: "Слухаю… відпусти кнопку, коли договориш" → "Слухаю… натисни ще раз, щоб зупинити"
- No changes to `use-speech-recognition.ts` or the parse-on-end logic — the underlying start/stop/parse flow is reused as-is.

## Out of scope
- Auto-stop after N seconds of silence (explicitly declined by user for this pass).
- Any change to the speech recognition hook itself.
