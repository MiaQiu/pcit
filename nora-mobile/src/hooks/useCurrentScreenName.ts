import { useRoute } from '@react-navigation/native';

/**
 * Safe wrapper around useRoute() — returns the current route name, or
 * undefined if called from a component rendered outside a navigator context
 * (useRoute() throws in that case).
 */
export function useCurrentScreenName(): string | undefined {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const route = useRoute();
    return route?.name;
  } catch {
    return undefined;
  }
}
