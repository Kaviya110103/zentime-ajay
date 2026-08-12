// app/_layout.tsx
import { enableScreens } from 'react-native-screens';
enableScreens(); // ✅ MUST be called before any navigation

import React, { useContext, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StyleSheet, View } from 'react-native';
import {
  Entypo,
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from '@expo/vector-icons';
import { EmployeeProvider } from '../context/EmployeeContext';
import { EmployeeContext } from '../context/EmployeeContext';
import { useNotificationSetup } from '../useNotificationSetup';
import { buildApiUrl } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_FONT_FAMILY } from '../lib/typography';
import { PaperProvider } from 'react-native-paper';
import { darkPaperTheme, lightPaperTheme } from '../lib/paperTheme';
import { AppThemeProvider, useAppTheme } from '../context/AppThemeContext';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';

const NotificationRegistrar = () => {
  const expoPushToken = useNotificationSetup();
  const { employee } = useContext(EmployeeContext);
  const [lastRegisteredToken, setLastRegisteredToken] = useState<string | null>(null);

  useEffect(() => {
    if (!expoPushToken) return;
    AsyncStorage.setItem('expoPushToken', expoPushToken).catch((err) => {
      console.warn('Failed to cache push token:', err);
    });
  }, [expoPushToken]);

  useEffect(() => {
    if (!employee?.id || !expoPushToken || expoPushToken === lastRegisteredToken) return;

    const register = async () => {
      try {
        const response = await fetch(buildApiUrl(`/api/employees/${employee.id}/push-token`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: expoPushToken }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(
            `Failed to register push token (HTTP ${response.status}):`,
            errorText || 'No response body'
          );
          return;
        }
        setLastRegisteredToken(expoPushToken);
      } catch (err) {
        console.warn('Failed to register push token:', err);
      }
    };

    register();
  }, [employee, expoPushToken, lastRegisteredToken]);

  return null;
};

function LayoutContent() {
  const { isDark, colors, themeReady } = useAppTheme();
  const [fontsLoaded] = useFonts({
    AppFont: require('../assets/fonts/Arial.ttf'),
    AppFontBold: require('../assets/fonts/Arial-Bold.ttf'),
    ...Feather.font,
    ...FontAwesome5.font,
    ...MaterialIcons.font,
    ...MaterialCommunityIcons.font,
    ...Ionicons.font,
    ...Entypo.font,
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch((err) => {
      console.warn('Failed to apply system background color:', err);
    });
  }, [colors.background]);

  if (!fontsLoaded || !themeReady) {
    return null;
  }

  const paperTheme = isDark ? darkPaperTheme : lightPaperTheme;

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      <View style={[styles.appRoot, { backgroundColor: colors.background }]}>
        <NotificationRegistrar />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: isDark ? '#111827' : '#351153',
            },
            headerTintColor: isDark ? '#f9fafb' : '#ffffff',
            headerTitleStyle: {
              fontFamily: APP_FONT_FAMILY,
              fontWeight: 'bold',
            },
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="EmployeeLogin" options={{ headerShown: false }} />
          <Stack.Screen name="AdminLogin" options={{ headerShown: false }} />
          <Stack.Screen name="AdminDashboard" options={{ headerShown: false }} />
          <Stack.Screen name="WelcomeBack" options={{ headerShown: false }} />
          <Stack.Screen name="MarkAttendance" options={{ headerShown: false }} />
          <Stack.Screen name="Calendarprinting" options={{ headerShown: false }} />
          <Stack.Screen name="EmployeeProfile" options={{ headerShown: false }} />
          <Stack.Screen name="MarkTimeIn" options={{ title: 'Mark Time In' }} />
          <Stack.Screen name="MarkTimeOut" options={{ title: 'Mark Time Out' }} />
          <Stack.Screen name="EmployeePermission" options={{ headerShown: false }} />
          <Stack.Screen name="LeavePermission" options={{ headerShown: false }} />
          <Stack.Screen name="AllAnnouncements" options={{ headerShown: false }} />
          <Stack.Screen name="EmployeeCalendar" options={{ headerShown: false }} />
          <Stack.Screen name="EmployeeSupportRequest" options={{ headerShown: false }} />
          <Stack.Screen name="SwapWeekoff" options={{ headerShown: false }} />
          <Stack.Screen name="EmployeeLeavePermission" options={{ headerShown: false }} />
          <Stack.Screen name="LocationTest" options={{ headerShown: false }} />
          {/* <Stack.Scr    een name="Leaverequest" options={{ headerShown: false }} /> */}
          <Stack.Screen name="Walkthrough" options={{ headerShown: false }} />
          <Stack.Screen name="ThemePreference" options={{ headerShown: false }} />
          <Stack.Screen name="ClientReg" options={{ headerShown: false }} />
        </Stack>
      </View>
    </PaperProvider>
  );
}

export default function Layout() {
  return (
    <EmployeeProvider>
      <AppThemeProvider>
        <LayoutContent />
      </AppThemeProvider>
    </EmployeeProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
});
