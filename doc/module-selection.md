# Module Selection

Documents how a user's "current module" is determined, stored, and used across the app.

---

## Overview

After completing the Foundation module, users choose which module to focus on next. The chosen module is called the **current module**. It is stored locally and used to:

- Suppress the Module Picker Modal (so it doesn't re-appear unnecessarily)
- Pin the current module to the top of the Learn screen module library
- Show a "Current" badge on the current module's card

---

## Storage

**Key:** `module_picker_selected_module` (AsyncStorage)
**Value:** `moduleKey` string (e.g. `"EMOTION_COACHING"`)

This is a local-only value — it is never synced to the server.

---

## How the current module gets set

There are two entry points:

### 1. Module Picker Modal
Shown automatically after Foundation completion (see [trigger logic](#module-picker-modal-trigger) below). When the user taps a module card, `handleModulePickerSelect` in `HomeScreen.tsx` saves the key and navigates to `ModuleDetailScreen`.

### 2. "Start module" button
Available on every non-Foundation, non-completed module's detail page (`ModuleDetailScreen.tsx`). Tapping it saves the key to AsyncStorage and shows a toast. The button changes to "Current module ✓" (outlined, disabled) when that module is already selected.

---

## Module Picker Modal trigger

`checkModulePickerPopup` (`HomeScreen.tsx`) runs:
- On initial Home screen mount
- When the app returns to foreground on a **new day** (via `AppState` listener)

The modal is shown only when **all** of the following are true:

| Condition | Detail |
|---|---|
| Not dismissed today | `module_picker_dismissed_date` ≠ today (Singapore time) |
| Foundation completed | `isFoundationCompleted === true` from API |
| No current module selected | `module_picker_selected_module` is unset or points to a completed module |
| Foundation completed on a prior day | First detection of Foundation completion stores the date but skips the modal that day |
| `isDifferentDay \|\| !hasInProgressModule` | Either it's a different day from Foundation completion, or no non-Foundation module has lessons in progress |

When the user **dismisses** the modal (close button or "Skip for now"), `module_picker_dismissed_date` is set to today — suppressing the modal for the rest of that day.

When the user **selects** a module from the modal, both `module_picker_dismissed_date` and `module_picker_selected_module` are saved.

---

## How the current module gets cleared

In `checkModulePickerPopup`, after fetching module data, if `module_picker_selected_module` is set but the referenced module is **fully completed**, the key is removed from AsyncStorage. This allows the Module Picker Modal to resurface and prompt the user to choose their next module.

---

## Effect on the Learn screen

`LearnScreen.tsx` reads `module_picker_selected_module` on mount and on every focus event.

**Sort order** (Module Library section):

1. Foundation — always first
2. Current module — immediately after Foundation
3. Recommended modules — based on child issue priorities from the server
4. In-progress modules — sorted by most recent activity
5. All other modules

**Completed modules** are separated into a distinct "Completed modules" section at the bottom of the list, regardless of whether they are the current module.

The current module's card displays a purple **"Current"** badge in its top-right corner (`ModuleCard.tsx`).

---

## Relevant files

| File | Role |
|---|---|
| `nora-mobile/src/screens/HomeScreen.tsx` | `checkModulePickerPopup`, `handleModulePickerSelect`, `handleModulePickerDismiss` |
| `nora-mobile/src/components/ModulePickerModal.tsx` | Modal UI shown after Foundation completion |
| `nora-mobile/src/screens/ModuleDetailScreen.tsx` | "Start module" / "Current module" button |
| `nora-mobile/src/screens/LearnScreen.tsx` | Sort order and "Current" badge in module library |
| `nora-mobile/src/components/ModuleCard.tsx` | `isCurrentModule` prop renders the badge |
