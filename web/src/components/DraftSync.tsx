import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { accountLast, useOnboarding } from '../contexts/OnboardingContext';
import { createSignupDraft, SignupDraftUpdate, updateSignupDraft } from '../api';
import { draftProgress } from '../signupSync';

// Account-last links only: keeps an anonymous server-side record of how far the visitor
// got (child birth year, concern keys, WACB score, last screen opened), so drop-off before
// the account screen is still visible in the admin portal. Created on the first onboarding
// screen; every later screen change sends the full current state. All calls are
// fire-and-forget. See doc/implementation/account-last-signup.md.
export default function DraftSync() {
  const { pathname } = useLocation();
  const { data, setSignupDraftId } = useOnboarding();
  const creating = useRef(false);
  const failedCreates = useRef(0);
  // Latest state, so a screen change made while the draft is still being created isn't lost.
  const latest = useRef<SignupDraftUpdate | null>(null);
  // Updates go out one at a time so a slow request can't overwrite a newer lastStep.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const active = accountLast(data) && !data.accessToken;

  useEffect(() => {
    // Redirect-only routes aren't screens: /p/ and /join/ load the link; /subscribe and
    // /success bounce to /create-account until the account exists.
    if (!active || /^\/(p|join)\/|^\/(subscribe|success)$/.test(pathname)) return;

    const payload = draftProgress(data, pathname);
    latest.current = payload;

    if (data.signupDraftId) {
      const id = data.signupDraftId;
      queue.current = queue.current.then(() => updateSignupDraft(id, payload)).catch(() => {});
      return;
    }

    // The draft starts when the visitor starts answering — earlier screens only count
    // as link visits (CampaignVisit).
    // Give up after a few failures (e.g. the link's accountLast was switched off since the
    // visitor opened it) — the signup itself never depends on the draft.
    if (!pathname.startsWith('/onboarding/') || creating.current || failedCreates.current >= 3 || !data.partnerInfo) return;
    creating.current = true;
    createSignupDraft({
      partnerSlug: data.partnerInfo.slug,
      messageKey: data.partnerInfo.messageKey,
      source: data.partnerInfo.source,
      ...payload,
    })
      .then(({ id }) => {
        setSignupDraftId(id);
        // Catch up if the visitor changed screens while the draft was being created.
        const current = latest.current;
        if (current && current !== payload) {
          queue.current = queue.current.then(() => updateSignupDraft(id, current)).catch(() => {});
        }
      })
      .catch(() => { failedCreates.current += 1; })
      .finally(() => { creating.current = false; });
    // Runs on screen changes only; the payload reads the answers current at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, active]);

  return null;
}
