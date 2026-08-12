import React, { useEffect, useRef, useContext } from 'react';
import { View, StyleSheet, Animated, BackHandler, Alert } from 'react-native';
import { AppAnimatedText } from '../components/AppTypography';
import { useRouter } from 'expo-router';
import { EmployeeContext } from '../context/EmployeeContext'; // adjust path if needed
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_THEME_PREFERENCE_KEY, useAppTheme } from '../context/AppThemeContext';

const WALKTHROUGH_DONE_KEY = 'walkthroughCompleted';

export default function Index() {
  const imageAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { employee, adminClient, sessionType, authReady } = useContext(EmployeeContext);
  const { colors, isDark } = useAppTheme();
  // useEffect(() => {
  //   const backAction = () => {
  //     Alert.alert('Hold on!', 'Are you sure you want to exit the app?', [
  //       { text: 'Cancel', onPress: () => null, style: 'cancel' },
  //       { text: 'YES', onPress: () => BackHandler.exitApp() },
  //     ]);
  //     return true; // Prevent default behavior (exit)
  //   };

  //   const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

  //   return () => backHandler.remove();
  // }, []);
  useEffect(() => {
    // Animate logo and text
    Animated.timing(imageAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(textAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    });

    if (!authReady) {
      return;
    }

    // Navigate after animation completes
    const timer = setTimeout(async () => {
      if (sessionType === 'admin' && adminClient) {
        router.replace('/AdminDashboard');
      } else if (sessionType === 'employee' && employee) {
        router.replace('/WelcomeBack');
      } else {
        const walkthroughCompleted = await AsyncStorage.getItem(WALKTHROUGH_DONE_KEY);
        const themePreference = await AsyncStorage.getItem(APP_THEME_PREFERENCE_KEY);
        if (walkthroughCompleted === 'true' && !themePreference) {
          router.replace('/ThemePreference');
        } else if (walkthroughCompleted === 'true') {
          router.replace('/EmployeeLogin');
        } else {
          router.replace('/Walkthrough');
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [employee, adminClient, sessionType, authReady]);

  return (
    <View  //div
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <Animated.Image
        source={require('../assets/images/icon.png')}
        style={[
          styles.image,
          {
            opacity: imageAnim,
            transform: [{ scale: imageAnim }],
          },
        ]}
        resizeMode="contain"
      />

      <AppAnimatedText
        style={[
          styles.text,
          {
            opacity: textAnim,
            color: colors.text,
            textShadowColor: isDark ? '#000000' : '#aaa',
          },
        ]}
      >
        ZenTime
      </AppAnimatedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 220,
    height: 220,
    marginBottom: 20,
  },
  text: {
    fontSize: 32,
    fontWeight: 'bold',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 5,
  },
});

