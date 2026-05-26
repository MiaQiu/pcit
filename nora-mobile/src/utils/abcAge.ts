import type { AgeTier } from '../data/abcTags';

export function getAgeTier(
  childBirthday?: Date | null,
  childBirthYear?: number | null,
): AgeTier {
  if (childBirthday) {
    const months =
      (new Date().getFullYear() - childBirthday.getFullYear()) * 12 +
      (new Date().getMonth() - childBirthday.getMonth());
    return months >= 48 ? 'school' : 'toddler';
  }
  if (childBirthYear) {
    const years = new Date().getFullYear() - childBirthYear;
    return years >= 4 ? 'school' : 'toddler';
  }
  return 'toddler';
}
