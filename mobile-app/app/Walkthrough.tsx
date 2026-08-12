import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { AppText as Text } from '../components/AppTypography';

const WALKTHROUGH_DONE_KEY = 'walkthroughCompleted';

const WalkthroughScreen = () => {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { width, height } = useWindowDimensions();
  const isNarrow = width < 480;
  const isShort = height < 700;

  const slides = useMemo(
    () => [
      {
        image: require('../assets/images/walk1.png'),
        title: 'Welcome to ZenTime',
        description: 'Mark attendance with time-in, time-out, and camera capture.',
      },
      {
        image: require('../assets/images/walk2.png'),
        title: 'Location Based Attendance',
        description: 'Attendance is verified against your branch location and policy.',
      },
      {
        image: require('../assets/images/walk3.png'),
        title: 'Start Your Day',
        description: 'Track your daily activity and reports from one place.',
      },
    ],
    []
  );

  const goToLogin = async () => {
    await AsyncStorage.setItem(WALKTHROUGH_DONE_KEY, 'true');
    router.replace('/ThemePreference');
  };

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }
    await goToLogin();
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const slide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      <Image source={slide.image} style={[styles.backgroundImage, { width, height }]} />
      <View
        style={[
          styles.overlay,
          {
            paddingHorizontal: isNarrow ? 16 : 24,
            paddingTop: isShort ? 20 : 36,
            paddingBottom: isShort ? 24 : 36,
          },
        ]}
      >
        <View style={styles.topRow}>
          <TouchableOpacity onPress={goToLogin} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.contentCard,
            {
              paddingHorizontal: isNarrow ? 16 : 24,
              paddingVertical: isNarrow ? 18 : 24,
            },
          ]}
        >
          <Text style={styles.stepText}>{`Step ${currentIndex + 1} of ${slides.length}`}</Text>
          <Text style={[styles.title, { fontSize: isNarrow ? 24 : 30, lineHeight: isNarrow ? 30 : 36 }]}>
            {slide.title}
          </Text>
          <Text style={[styles.description, { fontSize: isNarrow ? 14 : 16, lineHeight: isNarrow ? 21 : 24 }]}>
            {slide.description}
          </Text>

          <View style={styles.dotRow}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === currentIndex && styles.activeDot]}
              />
            ))}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, currentIndex === 0 && styles.disabledButton]}
              onPress={handleBack}
              disabled={currentIndex === 0}
            >
              <Text style={[styles.secondaryButtonText, currentIndex === 0 && styles.disabledButtonText]}>
                Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>{isLast ? 'Get Started' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  backgroundImage: {
    position: 'absolute',
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.58)',
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  contentCard: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
  },
  stepText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '600',
  },
  title: {
    color: '#111827',
    fontWeight: '800',
    marginBottom: 10,
  },
  description: {
    color: '#374151',
    marginBottom: 18,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#D1D5DB',
  },
  activeDot: {
    width: 24,
    backgroundColor: '#351153',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#351153',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minWidth: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#F3F4F6',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
});

export default WalkthroughScreen;
