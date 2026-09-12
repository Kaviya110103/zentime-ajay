import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AdminPage, EmptyState, ErrorBanner, SegmentButton } from '../components/admin/AdminShared';
import { AppText as Text } from '../components/AppTypography';
import { useAdminSession } from '../context/AdminSessionContext';
import { useAppTheme } from '../context/AppThemeContext';
import { adminRequest, fetchAdminBranches, getDisplayName } from '../lib/adminApi';

type AttendanceType = 'present' | 'absent' | 'late';

function titleForType(type: AttendanceType) {
  if (type === 'absent') return 'Absent';
  if (type === 'late') return 'Late Arrival';
  return 'Present';
}

export default function AdminAttendanceList() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const type = (params.type === 'absent' || params.type === 'late' ? params.type : 'present') as AttendanceType;
  const { adminSession, adminReady } = useAdminSession();
  const { colors } = useAppTheme();
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [absentTab, setAbsentTab] = useState<'absent' | 'weekOff' | 'holiday'>('absent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (adminReady && !adminSession) router.replace('/AdminLogin');
  }, [adminReady, adminSession, router]);

  useEffect(() => {
    let active = true;
    const loadBranches = async () => {
      if (!adminSession?.id) return;
      try {
        const names = await fetchAdminBranches(adminSession.id);
        if (active) setBranches(['All', ...names]);
      } catch (err) {
        console.warn('[AdminAttendanceList] branches failed', err);
        if (active) setBranches(['All']);
      }
    };
    loadBranches();
    return () => {
      active = false;
    };
  }, [adminSession?.id]);

  const loadRows = useCallback(async () => {
    if (!adminSession?.id) return;
    setLoading(true);
    setError('');
    try {
      const branch = selectedBranch === 'All' ? undefined : selectedBranch;
      if (type === 'absent') {
        const data = await adminRequest<any>('/api/attendance/today-absent', {
          clientId: adminSession.id,
          query: { branch },
        });
        const groupedRows = Array.isArray(data?.[absentTab]) ? data[absentTab] : [];
        setRows(groupedRows);
        setCounts({
          absent: Number(data?.counts?.absent) || 0,
          weekOff: Number(data?.counts?.weekOff) || 0,
          holiday: Number(data?.counts?.holiday) || 0,
        });
      } else {
        const endpoint = type === 'late' ? '/api/attendance/today-time-in-late' : '/api/attendance/today-timein';
        const data = await adminRequest<any[]>(endpoint, { clientId: adminSession.id, query: { branch } });
        setRows(Array.isArray(data) ? data : []);
        setCounts({});
      }
    } catch (err) {
      console.error('[AdminAttendanceList] failed', err);
      setRows([]);
      setError(err instanceof Error ? err.message : `Failed to load ${titleForType(type)} employees.`);
    } finally {
      setLoading(false);
    }
  }, [adminSession?.id, selectedBranch, type, absentTab]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  return (
    <AdminPage title={titleForType(type)} subtitle={`${rows.length} records`}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRows} tintColor={colors.primary} />}
      >
        <ErrorBanner message={error} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchScroll}>
          {branches.map((branch) => (
            <SegmentButton key={branch} label={branch} active={selectedBranch === branch} onPress={() => setSelectedBranch(branch)} />
          ))}
        </ScrollView>

        {type === 'absent' ? (
          <View style={styles.tabs}>
            <SegmentButton label={`Absent ${counts.absent ?? 0}`} active={absentTab === 'absent'} onPress={() => setAbsentTab('absent')} />
            <SegmentButton label={`Week Off ${counts.weekOff ?? 0}`} active={absentTab === 'weekOff'} onPress={() => setAbsentTab('weekOff')} />
            <SegmentButton label={`Holiday ${counts.holiday ?? 0}`} active={absentTab === 'holiday'} onPress={() => setAbsentTab('holiday')} />
          </View>
        ) : null}

        {!loading && rows.length === 0 ? <EmptyState message={`No ${titleForType(type).toLowerCase()} records found.`} /> : null}

        {rows.map((row, index) => (
          <View key={`${row?.employeeId || row?.id || index}`} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.name, { color: colors.text }]}>{getDisplayName(row)}</Text>
            <Text style={[styles.meta, { color: colors.mutedText }]}>ID: {row?.employeeId || row?.id || '-'} · {row?.branch || 'No branch'}</Text>
            <Text style={[styles.meta, { color: colors.mutedText }]}>Status: {row?.status || row?.displayStatus || titleForType(type)}</Text>
            {row?.timeIn ? <Text style={[styles.meta, { color: colors.mutedText }]}>Time In: {String(row.timeIn)}</Text> : null}
            {row?.lateMinutes ? <Text style={styles.lateText}>Late: {row.lateMinutes} min</Text> : null}
          </View>
        ))}
      </ScrollView>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  branchScroll: { marginBottom: 12 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  row: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  name: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  meta: { fontSize: 12, marginTop: 3 },
  lateText: { color: '#ea580c', fontSize: 12, fontWeight: 'bold', marginTop: 5 },
});
