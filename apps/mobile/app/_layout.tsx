import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#090d16',
          },
          headerTintColor: '#f8fafc',
          headerTitleStyle: {
            fontWeight: '700',
          },
          contentStyle: {
            backgroundColor: '#090d16',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'SharePlate',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(donor)/index"
          options={{
            title: 'Donor Portal',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="(ngo)/index"
          options={{
            title: 'NGO Food Discovery',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="(volunteer)/index"
          options={{
            title: 'Volunteer Dispatch',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="impact"
          options={{
            title: 'SDG Impact Hub',
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
