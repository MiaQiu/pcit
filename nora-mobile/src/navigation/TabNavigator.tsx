/**
 * Bottom Tab Navigator
 * Styled to match Figma design
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootTabParamList } from './types';
import {
  HomeScreen,
  RecordScreen,
  LearnScreen,
  ProgressScreen,
} from '../screens';

const Tab = createBottomTabNavigator<RootTabParamList>();

export const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#8C49D5', // Main purple
        tabBarInactiveTintColor: '#7C7C7C', // Gray to match Figma
        tabBarStyle: {
          height: 74,
          paddingTop: 4.5,
          paddingBottom: 15,
          paddingHorizontal: 30,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: '#C0C0C0',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 9,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'PlusJakartaSans_600SemiBold',
          marginTop: 4,
          letterSpacing: -0.3125,
        },
        tabBarItemStyle: {
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Record"
        component={RecordScreen}
        options={{
          tabBarLabel: 'Record',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'mic' : 'mic-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Learn"
        component={LearnScreen}
        options={{
          tabBarLabel: 'Learn',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarLabel: 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'bar-chart' : 'bar-chart-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
