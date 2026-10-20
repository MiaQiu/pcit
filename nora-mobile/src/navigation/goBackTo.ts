/**
 * Back that always animates as back (the previous screen enters from the left).
 *
 * With history, it's a plain goBack. Without it (a screen restored from a saved
 * onboarding draft, or opened cold from a link), `replace` would slide the
 * fallback screen in from the right like a forward step. Instead, the fallback
 * is slipped in underneath the current screen, then popped back to.
 */

import { CommonActions } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

export function goBackTo(
  navigation: NavigationProp<ParamListBase>,
  name: string,
  params?: object,
): void {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  navigation.dispatch((state) => {
    const current = state.routes[state.index];
    const fallback = { key: `${name}-${Date.now()}`, name, params };
    const routes = [...state.routes.slice(0, state.index), fallback, current];
    return CommonActions.reset({ ...state, routes, index: routes.length - 1 });
  });
  navigation.goBack();
}
