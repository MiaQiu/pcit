# Module Selection

Documents how a user's "current module" is determined, stored, and used across the app.

---

## Overview

After completing the Foundation module, users choose which module to focus on next. The chosen module is called the **current module**. It is stored locally and used to:

- Suppress the Module Picker Modal (it only ever shows once)
- Pin the current module to the top of the Learn screen module library
- Show a "Current" badge on the current module's card

---

## Storage

| Key | Value | Purpose |
|---|---|---|
| `module_picker_shown` | `"true"` | Set the moment the modal is first shown; prevents it from ever showing again |
| `module_picker_selected_module` | `moduleKey` string (e.g. `"EMOTION_COACHING"`) | The user's chosen module; used to pin it in Learn screen and select daily lessons |

Both are local-only values — never synced to the server.

---

## How the current module gets set

There are two entry points:

### 1. Module Picker Modal
Shown automatically after Foundation completion (see [trigger logic](#module-picker-modal-trigger) below). The first recommended module (or first available if none are recommended) is **automatically saved** as the current module when the modal opens, and shown with a purple "Current" badge. Tapping any module card navigates to `ModuleDetailScreen`, where the user can tap "Set as daily lesson" to change the selection.

### 2. "Set as daily lesson" button
Available on every non-Foundation, non-completed module's detail page (`ModuleDetailScreen.tsx`). Tapping it saves the key to AsyncStorage and shows a toast. The button changes to "Current module ✓" (outlined, disabled) when that module is already selected.

---

## Module Picker Modal trigger

`checkModulePickerPopup` (`HomeScreen.tsx`) runs:
- On initial Home screen mount
- Every time the Home screen comes into focus (via `useFocusEffect`) — this includes returning from a completed lesson

The modal is shown only when **both** of the following are true:

| Condition | Detail |
|---|---|
| Never shown before | `module_picker_shown` is unset |
| Foundation completed | `isFoundationCompleted === true` from API |

When the check passes, `module_picker_shown` is set to `"true"` immediately (before rendering the modal) so it never shows again — regardless of whether the user picks a module or dismisses.

Before showing the modal, `checkModulePickerPopup` auto-saves the first available module to `module_picker_selected_module`. Tapping a card only navigates — the selection can be changed via the "Set as daily lesson" button on `ModuleDetailScreen`.

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
