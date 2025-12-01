/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootTabParamList = {
  Home: undefined;
  Record: undefined;
  Learn: undefined;
  Progress: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  LessonViewer: {
    lessonId: string;
  };
};

export type RootTabNavigationProp = BottomTabNavigationProp<RootTabParamList>;
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
