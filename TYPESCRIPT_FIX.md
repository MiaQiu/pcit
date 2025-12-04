# TypeScript Import Error Fix

## Issue
```
Module '"@nora/core"' has no exported member 'SubmitQuizResponse'.
```

## Root Cause
This is a **TypeScript/Metro bundler cache issue**, not an actual missing export.

### Verification
The type **IS** properly exported:
- ✅ Defined in `/packages/nora-core/src/types/index.ts`
- ✅ Exported via `export * from './types'` in `/packages/nora-core/src/index.ts`
- ✅ Present in `/packages/nora-core/dist/types/index.d.ts`
- ✅ Built correctly by TypeScript compiler

## Solution

Run these commands to clear all caches:

```bash
# From nora-mobile directory
cd /Users/mia/nora/nora-mobile

# Clear watchman cache
watchman watch-del-all

# Clear metro bundler cache
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*

# Rebuild core package
cd ../packages/nora-core
npm run build

# Restart metro with clean cache
cd ../../nora-mobile
npm start -- --reset-cache
```

## Explanation
Metro bundler and TypeScript language server can cache outdated type definitions. When new types are added to `@nora/core`, the cache doesn't automatically invalidate. Clearing caches forces a fresh read of the type definitions.

## Verified Exports
All these types are properly exported from `@nora/core`:
- ✅ `Quiz`
- ✅ `QuizOption`
- ✅ `QuizResponse`
- ✅ `SubmitQuizRequest`
- ✅ `SubmitQuizResponse`
- ✅ `LessonService`

The import in `QuizScreen.tsx` is correct:
```typescript
import { LessonService, Quiz, QuizOption, SubmitQuizResponse } from '@nora/core';
```
