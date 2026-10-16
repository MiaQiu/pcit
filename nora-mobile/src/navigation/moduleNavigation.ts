/**
 * Getting back to a Learn module screen that's already open, wherever it is:
 * a pushed LearnModule route, or the home screen itself (MainTabs renders the
 * module as home for parents whose hardest problem is that module — see
 * HomeRootScreen).
 */

import { CommonActions, StackActions } from '@react-navigation/native';
import type { LearnModuleKey } from '../constants/learnModules';
import type { RootStackNavigationProp, RootStackParamList } from './types';

// The module MainTabs is rendering as home, or null when it's the regular tabs.
// Set by HomeRootScreen.
let moduleHomeKey: LearnModuleKey | null = null;
export const setModuleHomeKey = (key: LearnModuleKey | null) => {
  moduleHomeKey = key;
};

type ModuleParams = Omit<RootStackParamList['LearnModule'], 'moduleKey'>;

/**
 * Pops back to the open screen for `moduleKey` and merges `params` into it
 * (e.g. initialTab, startRecordingAt). Pushes a new LearnModule if none is open.
 */
export const returnToModule = (
  navigation: RootStackNavigationProp,
  moduleKey: LearnModuleKey,
  params: ModuleParams = {},
) => {
  const state = navigation.getState();
  let index = -1;
  for (let i = state.routes.length - 1; i >= 0; i--) {
    const route = state.routes[i];
    const isModuleRoute = route.name === 'LearnModule' && (route.params as { moduleKey?: string } | undefined)?.moduleKey === moduleKey;
    const isModuleHome = route.name === 'MainTabs' && moduleHomeKey === moduleKey;
    if (isModuleRoute || isModuleHome) {
      index = i;
      break;
    }
  }
  if (index === -1) {
    navigation.push('LearnModule', { moduleKey, ...params });
    return;
  }
  navigation.dispatch({ ...CommonActions.setParams(params), source: state.routes[index].key });
  const depth = state.index - index;
  if (depth > 0) navigation.dispatch(StackActions.pop(depth));
};
