import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { AppText as Text } from '../AppTypography';
import { useAppTheme } from '../../context/AppThemeContext';

export function AdminPage({
  title,
  subtitle,
  children,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
        {rightAction}
      </View>
      {children}
    </View>
  );
}

export function AdminCard({
  title,
  value,
  subtitle,
  loading,
  onPress,
  style,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  loading?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.82 : 1}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Text style={[styles.cardValue, { color: colors.text }]}>{value ?? '--'}</Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.cardSubtitle, { color: colors.mutedText }]}>{subtitle}</Text> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

export function EmptyState({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.emptyState, { borderColor: colors.border }]}>
      <Text style={[styles.emptyText, { color: colors.mutedText }]}>{message}</Text>
    </View>
  );
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.segment,
        { borderColor: colors.primary, backgroundColor: active ? colors.primary : 'transparent' },
      ]}
    >
      <Text style={[styles.segmentText, { color: active ? '#ffffff' : colors.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#f3e8ff',
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    minHeight: 112,
    justifyContent: 'center',
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardSubtitle: {
    marginTop: 6,
    fontSize: 12,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  segment: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 8,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});
