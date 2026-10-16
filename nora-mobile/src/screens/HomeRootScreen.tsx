/**
 * HomeRootScreen
 * The MainTabs route. Parents whose hardest problem (onboarding ChildIssue)
 * is screen time get the Screen Time module as their home screen; everyone
 * else gets the regular tabs. Onboarding, login and reports all land here via
 * MainTabs, so they pick the right home without knowing about modules.
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthService } from '../contexts/AppContext';
import { TabNavigator } from '../navigation/TabNavigator';
import { setModuleHomeKey } from '../navigation/moduleNavigation';
import type { LearnModuleKey } from '../constants/learnModules';
import { COLORS } from '../constants/assets';
import { LearnModuleScreen_v2 } from './LearnModuleScreen_v2';

// ChildIssue value → module shown as home.
const MODULE_HOME_BY_ISSUE: Record<string, LearnModuleKey> = {
  screen_time: 'screenTime',
};

// ChildIssue is single-choice (a string); older accounts may hold an array.
const homeModuleFor = (issue: string | string[] | undefined): LearnModuleKey | null => {
  const hardest = Array.isArray(issue) ? issue[0] : issue;
  return (hardest && MODULE_HOME_BY_ISSUE[hardest]) || null;
};

export const HomeRootScreen: React.FC = () => {
  const authService = useAuthService();
  // undefined = still loading the (cached) profile.
  const [moduleKey, setModuleKey] = useState<LearnModuleKey | null | undefined>(undefined);

  useEffect(() => {
    authService.getCurrentUser()
      .then(user => setModuleKey(homeModuleFor(user?.issue)))
      .catch(() => setModuleKey(null));
  }, [authService]);

  useEffect(() => {
    if (moduleKey === undefined) return;
    setModuleHomeKey(moduleKey);
    return () => setModuleHomeKey(null);
  }, [moduleKey]);

  if (moduleKey === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.mainPurple} />
      </View>
    );
  }
  return moduleKey ? <LearnModuleScreen_v2 homeModuleKey={moduleKey} /> : <TabNavigator />;
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
});
