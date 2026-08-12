import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../components/AppTypography';
import { AppThemeMode, useAppTheme } from '../context/AppThemeContext';

export default function ThemePreference() {
  const router = useRouter();
  const { colors, isDark, setThemePreference } = useAppTheme();
  const [saving, setSaving] = useState<AppThemeMode | null>(null);

  const chooseTheme = async (mode: AppThemeMode) => {
    try {
      setSaving(mode);
      await setThemePreference(mode);
      router.replace('/EmployeeLogin');
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.iconCircle, { backgroundColor: isDark ? '#1f2937' : '#F3E8FF' }]}>
          <Feather name="moon" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Apply dark theme?</Text>
        <Text style={[styles.subtitle, { color: colors.mutedText }]}>
          Choose how ZenTime should appear on this device.
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => chooseTheme('dark')}
          disabled={Boolean(saving)}
        >
          {saving === 'dark' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Yes, use dark theme</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => chooseTheme('light')}
          disabled={Boolean(saving)}
        >
          {saving === 'light' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.secondaryText, { color: colors.text }]}>No, use light theme</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
  },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
