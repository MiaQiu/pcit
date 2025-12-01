/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Quiz } from '@nora/core';

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
  Quiz: {
    quizId: string;
    lessonId: string;
    quiz: Quiz;
  };
};

export type RootTabNavigationProp = BottomTabNavigationProp<RootTabParamList>;
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
