/**
 * Determines whether the parent selected an issue that routes them down the
 * ADHD / developmental-concern onboarding branch (extra diagnosis/support
 * questions, reworded copy on a few downstream screens).
 */
export function hasAdhdOrDevelopmentalConcern(issue: string | string[] | undefined | null): boolean {
  const issues = Array.isArray(issue) ? issue : issue ? [issue] : [];
  return issues.includes('adhd') || issues.includes('developmental_concerns');
}
