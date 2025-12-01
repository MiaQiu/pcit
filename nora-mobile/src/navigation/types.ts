/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LessonContent } from '../screens/LessonViewerScreen';

export type RootTabParamList = {
  Home: undefined;
  Record: undefined;
  Learn: undefined;
  Progress: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  LessonViewer: {
    lesson: LessonContent;
  };
};

export type RootTabNavigationProp = BottomTabNavigationProp<RootTabParamList>;
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
