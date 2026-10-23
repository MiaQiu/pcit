# Nora Mobile — Onboarding Flow

_Last updated: 2026-10-21 (branch `feat/screen-time-module`)_

This describes the onboarding flow as it currently runs, traced from the
`navigate` calls in each screen. Navigator: `nora-mobile/src/navigation/OnboardingNavigator.tsx`.
Screens: `nora-mobile/src/screens/onboarding/`.

## Flow at a glance

Account-first signup: the parent creates the account on the second screen, then answers
the questions (see "Account creation").

```
Welcome → Start ─┬─ Login ──────────────► MainTabs, or resume onboarding (see below)
                 └─ Get Started
                        │
                 CreateAccount → OB1V2 → OB2V2
                        │
                 NameInput → Relationship → ChildName → ChildGender
                   → ChildBirthday → ChildIssue                (profile)
                        │
          ┌──────────────────┼─────────────────────┐
  Screen-time        ADHD / developmental /       anything else
  management         anxiety selected                  │
          │                  │                         │
  ScreenTimeStep ×29–31   DiagnosisStatus             ParentGoal
  (ends on its plan,   → ProfessionalSupport           │
  then MainTabs)             └────────────┬────────────┘
                        │
                 ParentGoalIntro → OBLetterV2 → OBLetterContent
                   → OBPlay1V2 → OBPlay2V2 → OBDisciplineV2 → OBIntro1V2
                        │
                 ReminderTime → OBIntro2V2 → MainTabs
```

## Steps

### 1. Entry and auth

| Screen | What it does | Next |
|---|---|---|
| `Welcome` | Splash | `Start` (replace) |
| `Start` | Dragon, "Nora", "5 Minutes a Day to a Calmer, Happier Child." | **Get Started** → `CreateAccount`, or **I already have an account** → `Login` |
| `Login` | Logs in, then runs `checkOnboardingStep` | `MainTabs`, or back into onboarding at the missing step |
| `CreateAccount` | Email and password, with the Terms and Privacy line | `OB1V2` (stack reset, so back can't return to signup) |
| `OB1V2` | "Parenting is hard. But you don't have to do it alone." Meet Nora | `OB2V2` |
| `OB2V2` | Clinical advisor Prof. Yi-Chuen Chen: "Nora helps you build the skills for hard moments, together." | `NameInput` |

`ForgotPassword` and `ResetPassword` branch off `Login`. The intro slide `OB3V2` is no longer
in the flow.

### 3. Profile questions

| Screen | Field |
|---|---|
| `NameInput` | `name` |
| `Relationship` | `relationshipToChild` |
| `ChildName` | `childName` |
| `ChildGender` | `childGender` |
| `ChildBirthday` | `childBirthday` |
| `ChildIssue` | `issue` (single choice; "Other" saves the typed text) |

Each answer is saved to the account as it's given (`saveOnboardingFields` in
`utils/onboardingDraft.ts`). `Relationship` and `ChildGender` don't save on their own screen;
`OBIntro1V2` (or the screen-time plan) sends the full profile once more, which covers them.

### 4. Branch at `ChildIssue`

The question is "What feels hardest right now?" and takes a single answer.

- **`screen_time`** ("Screen-time management"): goes into the screen-time branch (section 4a).
- Otherwise `hasAdhdOrDevelopmentalConcern()` in `nora-mobile/src/utils/onboardingBranch.ts` returns true if
`issue` includes `adhd`, `developmental_concerns` or `anxiety`.

- **True:** `DiagnosisStatus` (saves `diagnosisStatus`) → `ProfessionalSupport` (saves `professionalSupport`)
- **False:** `ParentGoal` (saves `parentGoal`)

Both paths rejoin at `ParentGoalIntro`. The same helper switches some later screens,
such as `OBIntro2V2`, to different copy for the branch.

### 4a. Screen-time branch

Rebuilt in the app's onboarding style from the prototype at
https://github.com/MiaQiu/Nora-Onboarding-1.
- Code: `nora-mobile/src/screens/onboarding/screenTime/`.
- Copy: `onboarding.screenTime.*` in all three locales.

Every step is the same route, `ScreenTimeStep`, with a `step` index into `SCREEN_TIME_STEPS`
(`screenTimeFlow.ts`). Each step pushes the next index, so the back button and swipe-back work normally.

| # | Step | Type |
|---|---|---|
| 1 | `intro`: "You're not alone." (screen time ending is hard for many parents) | Insight |
| 2–10 | `pmum0`–`pmum8`: nine screen-media statements (agree/disagree) | Single |
| 11 | `dopamine`: heard of the dopamine loop? | Single |
| 12 | `context`: screens are stimulating / the dopamine loop | Insight |
| 13 | `differences`: learning and thinking differences ("None" clears the others) | Multi |
| 14 | `strategies`: what you've tried | Multi |
| 15 | `worked`: how well it worked | Single |
| 16 | `stress`: how hard endings are on you | Single |
| 17 | `hardest`: what feels hardest right now | Single |
| 18 | `teen`: worried it gets harder as a teen? | Single |
| 19 | `why`: why it hasn't worked so far (copy by path, see below) | Insight |
| 20–25 | `signal0`–`signal5`: hidden-signal frequency questions | Single |
| | **Differences path** | |
| 26 | `routine`: a predictable routine plus 5 minutes of Special Play Time | Insight |
| 27 | `specialPlay`: what Special Play Time is | Insight |
| | **None path** | |
| 26 | `cortex`: heard of the prefrontal cortex? | Single |
| 27 | `cortexHelp`: what the prefrontal cortex does | Insight |
| 28 | `canLearn`: your child can learn to make the transition | Insight |
| 29 | `easierEnd`: let's make screen time easier to end | Insight |
| | **Both paths** | |
| next | `coaching`: coaching from your voice recordings (copy by path); button "Create my account" | Insight |
| last | `plan`: the child's starting plan | Plan |

The pmum and signal questions take one screen each. The plan screen:
- shows the hard moment (`hardest`) and what they've tried;
- shows a before/after image for a boy or girl (none for "prefer not to say");
- comes right after the `coaching` screen (its button still reads "Create my account");
- on **Get started**, sends `screenTimeIntake` (see `buildScreenTimeIntake`) together with
  `relationshipToChild` and `childGender` to `PATCH /api/auth/complete-onboarding`;
- then sets the local completed flag and goes to `MainTabs`.

This branch skips the letter/play/discipline intro screens and `ReminderTime`.

Answers are saved in `User.screenTimeIntake` (JSONB; migration `20261015120000_add_user_screen_time_intake`).
A failed save is logged and does not stop the parent from finishing.

**Paths.** After `teen` the branch splits on the `differences` answer (`screenTimePath()` in
`screenTimeFlow.ts`): **none** when the parent picked only "None that I know of", **differences**
when they picked anything else (a suspected difference counts).
- `why` and `coaching` have different copy per path, under `<id>.none.*` and `<id>.differences.*`
  (insight steps with `byPath: true`; their layout can differ too, keyed `<id>.<path>` in `INSIGHT_BLOCKS`).
- Both paths answer the hidden-signal questions. Then the differences path has `routine` → `specialPlay`,
  the none path `cortex` → `cortexHelp` → `canLearn` → `easierEnd`. Both then go to `coaching` and the plan.
- A step's `paths` lists the paths it's shown on; next/back use `adjacentStepIndex()` to skip the others.
  The differences path has 29 screens, the none path 31.
- `screenTimeIntake.path` records the path; `cortex` is null on the differences path.

**Progress bar.** Only question screens show it; information screens neither show nor count toward it.
Each section has its own title (`OnboardingProgressHeader` with `label`); no screen count is shown,
but the bar fills through the section's screens:
- The profile questions (`NameInput`–`ChildIssue`) show no bar. *Basic data* is `ParentGoal` (1/1), or on
  the ADHD/developmental/anxiety path `DiagnosisStatus` 1/2 and `ProfessionalSupport` 2/2.
- Screen time (`stepSection()` / `sectionProgress()` in `ScreenTimeStepScreen.tsx`): *Screen time habits*
  (the 9 statements, 1/9–9/9), *Your experience* (dopamine through teen, 1/8–8/8), *Hidden signals* 1/6–6/6.
  Nothing after the signals shows a bar, including the none path's `cortex` question.
- The bar has one equal segment per section on the parent's path: 3 on the screen-time path (the three
  above), 1 on the others. The title is the current section's.

Pronouns use i18next context: `_boy` and `_girl` variants, with a gender-neutral base key that uses the child's name.

### 5. Letter and method content

`ParentGoalIntro` → `OBLetterV2` (tap-to-open envelope) → `OBLetterContent`
→ `OBPlay1V2` → `OBPlay2V2` → `OBDisciplineV2` → `OBIntro1V2`.

### 6. Wrap-up

- **`ReminderTime`**: the parent picks a daily time for the play session.
  - *Enable*: saves `reminderTime` in context, asks for notification permission and, if granted,
    schedules the daily reminder and writes `@notification_preferences`.
  - *Skip*: moves on with no reminder.
  - Both go to `OBIntro2V2`.
- **`OBIntro2V2`**: last screen. Calls `OnboardingContext.completeOnboarding()`, which sets the
  local flag `@nora_onboarding_completed`, then `replace('MainTabs')`.

## Account creation

`CreateAccount` comes right after `Start` (**Get Started**). It signs up with
`POST /api/auth/signup` (name and child fields empty; they're filled in screen by screen) and
resets the onboarding stack to `OB1V2`. A taken email shows the signup error.

**Account-last leftovers.** Parents who started on the earlier account-last build have a device
draft and no account. They resume where they were, and `OBIntro1V2` (or the screen-time `coaching`
step) sends them to `CreateAccount` with a `next` route param:
- **Sign up:** signup with the real name, child name, birthday and issue, then
  `PATCH /api/auth/complete-onboarding` with every other answer (`buildProfilePayload`). The device
  draft is cleared, then onboarding continues at `next`.
- **Email already registered** (`CONFLICT`): an alert offers
  - *Use a different email*: stay and create a new account;
  - *Log in and update it*: `Login` with `overrideWithOnboarding`. After login, the onboarding answers
    overwrite that account's child profile, and onboarding continues where `CreateAccount` would have.

## Resume logic

**Logged out, unfinished onboarding.** Until the account exists (only on `CreateAccount`, or for
account-last leftovers), `OnboardingNavigator` saves the answers and the current screen to the device (`@nora_onboarding_draft`, `utils/onboardingDraft.ts`).
On launch, `RootNavigator` resumes a logged-out parent at that screen with their answers restored.

**Logged in.** `RootNavigator` (on app start) and `Login` (after sign-in) both call `checkOnboardingStep()`
in `nora-mobile/src/utils/onboardingCheck.ts`.

- Mid-onboarding on this device, the parent resumes at the last screen reached, with their answers.
  `OnboardingNavigator` saves it per user (`@nora_onboarding_resume`, `saveUserDraft`) on every screen;
  `completeOnboarding()` clears it. The server fields below can't tell this: they're all set once
  `ChildIssue` is answered.

- If `@nora_onboarding_completed` is set on this device, the user goes to `MainTabs`.
- Otherwise the user resumes at the first missing required field on the server:
  1. `name` missing or `'User'` → `NameInput`
  2. `childName` missing or `'Child'` → `ChildName`
  3. `childBirthday` missing → `ChildBirthday`
  4. `issue` missing → `ChildIssue`
  5. All present → `MainTabs`
- On resume, the navigator gets `initialStep` and `resumeUserData`, and fills
  `OnboardingContext` from the server user.

Only those four fields are required. Relationship, gender, diagnosis, goal and reminder are optional.

## Registered but not in the flow

Still registered in the navigator so deep links and old resume state don't crash. Nothing in the
flow navigates to them:

- **Old intro slide:** `OB3V2` (`OB2V2` now goes straight to `NameInput`).
- **V1 versions of the V2 screens:** `OB1`–`OB3`, `OBLetter`, `OBPlay1`, `OBPlay2`, `OBDiscipline`,
  `OBIntro1`, `OBIntro2`. These are kept on purpose (see below).
- **Older flows:** `Demo1`–`Demo5`, `Demo1B`, `Demo2B`, `ParentingIntro`, `ChildSnapshotIntro`,
  `WacbQuestion1`–`10`, `ChildBehaviorProfile`, `Intro3`, `PlaySession1`–`5`,
  `NotificationPermission`.
- **`Subscription`:** a standalone screen, opened from Record and Profile.

## V2 preview status

The V2 screens are wired in as a **temporary preview** while the V2 design is reviewed. Three
screens carry `TEMP` comments with revert instructions:

| Screen | Currently goes to | Revert to |
|---|---|---|
| `ParentGoalIntroScreen` | `OBLetterV2` | `OBLetter` |
| `OBLetterContentScreen` | `OBPlay1V2` | `OBPlay1` |
| `ReminderTimeScreen` | `OBIntro2V2` | `OBIntro2` |

Keep the V1 screens until the V2 review is done.

To preview any onboarding screen in dev, set `DEV_FORCE_ONBOARDING_SCREEN` in
`nora-mobile/src/navigation/RootNavigator.tsx`.
