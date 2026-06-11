# Temporarily Hide Behavior Tracker

**Date:** 2026-06-11  
**Status:** Implemented

## What was hidden

The ABC behavior tracker feature was temporarily removed from the UI. No backend, database, or data was changed — all routes, schema, and screen files are intact and can be re-exposed.

## Touch points changed

### 1. `nora-mobile/src/navigation/TabNavigator.tsx`
- Commented out the **"Log" bottom tab** (same pattern as the hidden "Tips" tab).

### 2. `nora-mobile/src/screens/HomeScreen_v2.tsx`
- Removed the **"Log a Outburst" ABC prompt card** from the rotating action card area (the branch that showed when `hasRecordedSession && isReportRead && chatIntroDismissed && !abcLoggedToday && !abcCardSkipped`). Falls through to the default daily tip card now.
- Removed the **`logsThisWeek` StatPill** from the weekly stats row (the green journal icon pill).
- Removed the **`log-behavior` plan item** from the daily plan checklist builder.
- Removed the **`/api/abc-logs` fetch** from the `Promise.all` in `loadData` and all downstream references (`abcLogsData`, `logsThisWeek` mapping, `abcLoggedToday`/`abcCardSkipped` state).

## What was NOT changed

- `ABCLogScreen.tsx`, `LogScreen.tsx` — screen files untouched
- `RootNavigator.tsx` — stack route for `ABCLog` still registered (harmless)
- `server/routes/abc-logs.cjs` — API routes untouched
- `prisma/schema.prisma` — schema untouched

## To re-enable

1. Uncomment the "Log" tab in `TabNavigator.tsx`.
2. Restore the ABC card branch, the `logsThisWeek` StatPill, the `log-behavior` plan item, and the `/api/abc-logs` fetch in `HomeScreen_v2.tsx`.
