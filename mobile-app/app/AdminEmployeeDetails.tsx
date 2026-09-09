import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AdminPage, EmptyState, ErrorBanner } from '../components/admin/AdminShared';
import { AppText as Text } from '../components/AppTypography';
import { useAdminSession } from '../context/AdminSessionContext';
import { useAppTheme } from '../context/AppThemeContext';
import { adminRequest, getDisplayName, resolveAssetUrl } from '../lib/adminApi';

export default function AdminEmployeeDetails() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { adminSession, adminReady } = useAdminSession();
  const { colors } = useAppTheme();
  const [employee, setEmployee] = useState<any>(null);
  const [additionalDays, setAdditionalDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (adminReady && !adminSession) router.replace('/AdminLogin');
  }, [adminReady, adminSession, router]);

  const loadDetails = useCallback(async () => {
    if (!adminSession?.id || !params.id) return;
    setLoading(true);
    setError('');
    try {
      const [employeeResult, additionalResult] = await Promise.allSettled([
        adminRequest<any>(`/api/employees/${params.id}`, { clientId: adminSession.id }),
        adminRequest<any[]>(`/api/employees/${params.id}/additional-working-days`, { clientId: adminSession.id }),
      ]);

      if (employeeResult.status === 'fulfilled') {
        setEmployee(employeeResult.value);
      } else {
        throw employeeResult.reason;
      }
      setAdditionalDays(additionalResult.status === 'fulfilled' && Array.isArray(additionalResult.value) ? additionalResult.value : []);
    } catch (err) {
      console.error('[AdminEmployeeDetails] failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load employee.');
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, [adminSession?.id, params.id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const imageUrl = resolveAssetUrl(employee?.profileImage);

  return (
    <AdminPage title="Employee Details" subtitle={employee ? getDisplayName(employee) : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDetails} tintColor={colors.primary} />}
      >
        <ErrorBanner message={error} />
        {!employee && !loading ? <EmptyState message="Employee details not available." /> : null}
        {employee ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{getDisplayName(employee).slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <Text style={[styles.name, { color: colors.text }]}>{getDisplayName(employee)}</Text>
            <Info label="Employee ID" value={employee?.id} />
            <Info label="Code" value={employee?.employeeCode} />
            <Info label="Branch" value={employee?.branch} />
            <Info label="Position" value={employee?.position} />
            <Info label="Mobile" value={employee?.mobile} />
            <Info label="Email" value={employee?.email} />
            <Info label="Week Off" value={employee?.weekOff} />
            <Info label="Shift" value={`${employee?.shiftStartTime || '-'} - ${employee?.shiftEndTime || '-'}`} />

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Additional Working Days</Text>
            {additionalDays.length === 0 ? (
              <Text style={[styles.meta, { color: colors.mutedText }]}>Not configured</Text>
            ) : (
              additionalDays.map((day, index) => (
                <View key={`${day?.dayType || index}`} style={[styles.additionalRow, { borderColor: colors.border }]}>
                  <Text style={[styles.additionalType, { color: colors.text }]}>{day?.dayType || day?.label || 'Working Day'}</Text>
                  <Text style={[styles.meta, { color: colors.mutedText }]}>
                    {day?.startTime || day?.shiftStartTime || '-'} - {day?.endTime || day?.shiftEndTime || '-'}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </AdminPage>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.infoRow, { borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.mutedText }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value ? String(value) : '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  avatar: { width: 92, height: 92, borderRadius: 46, alignSelf: 'center', marginBottom: 12 },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignSelf: 'center',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  infoRow: { borderTopWidth: 1, paddingVertical: 10 },
  label: { fontSize: 12, marginBottom: 4 },
  value: { fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', marginTop: 18, marginBottom: 8 },
  additionalRow: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
  additionalType: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  meta: { fontSize: 13 },
});
