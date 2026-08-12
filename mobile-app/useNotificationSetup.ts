import { useEffect, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';

export const useNotificationSetup = () => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const register = async () => {
      try {
        if (!Device.isDevice) {
          Alert.alert('📱 Physical device required', 'Push notifications work only on a real device.');
          return;
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (finalStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert('🔕 Notifications disabled', 'Push notification permission was not granted.');
          return;
        }

        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId ??
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

        if (!projectId) {
          console.warn('EAS projectId is missing. Push token cannot be generated.');
          return;
        }

        console.log('Push setup environment:', Constants.executionEnvironment);

        // Useful to diagnose APK-specific failures quickly.
        const nativeToken = await Notifications.getDevicePushTokenAsync();
        console.log('Native push token:', nativeToken.type, nativeToken.data);

        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        console.log('Expo Push Token:', token.data);
        setExpoPushToken(token.data);
      } catch (error) {
        const message = String(error);
        if (message.toLowerCase().includes('firebase') || message.toLowerCase().includes('default firebaseapp')) {
          console.warn(
            'Android Firebase is not configured for this build. Add google-services.json and FCM V1 credentials in EAS.'
          );
        }
        console.warn('Failed to register for push notifications:', error);
      }
    };

    register();

    const subscription = Notifications.addPushTokenListener((token) => {
      setExpoPushToken(token.data);
      console.log('Push token updated:', token.data);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return expoPushToken;
};
