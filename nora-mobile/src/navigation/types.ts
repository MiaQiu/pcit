/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

export type RootTabParamList = {
  Home: undefined;
  Record: undefined;
  Learn: undefined;
  Progress: undefined;
};

export type RootTabNavigationProp = BottomTabNavigationProp<RootTabParamList>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
