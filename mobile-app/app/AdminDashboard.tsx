import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AdminCard, AdminPage, ErrorBanner } from '../components/admin/AdminShared';
import { AppText as Text } from '../components/AppTypography';
import { useAdminSession } from '../context/AdminSessionContext';
import { useAppTheme } from '../context/AppThemeContext';
import { adminRequest } from '../lib/adminApi';

type Summary = {
  totalEmployees?: number;
  presentToday?: number;
  absentToday?: number;
  lateArrivalsToday?: number;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { adminSession, adminReady, logoutAdmin } = useAdminSession();
  const { colors } = useAppTheme();
  const [summary, setSummary] = useState<Summary>({});
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [weekOffCount, setWeekOffCount] = useState<number | null>(null);
  const [supportCount, setSupportCount] = useState<number | null>(null);
  const [holidayCount, setHolidayCount] = useState<number | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (adminReady && !adminSession) {
      router.replace('/AdminLogin');
    }
  }, [adminReady, adminSession, router]);

  const loadDashboard = useCallback(async () => {
    if (!adminSession?.id) return;
    setError('');
    setSummaryLoading(true);
    setRequestsLoading(true);
    setHolidaysLoading(true);

    const summaryPromise = adminRequest<Summary>('/api/attendance/summary', { clientId: adminSession.id })
      .then(setSummary)
      .catch((err) => {
        console.error('[AdminDashboard] summary failed', err);
        setError('Some dashboard data could not be loaded.');
      })
      .finally(() => setSummaryLoading(false));

    const requestsPromise = adminRequest<number>('/api/leaves/status/Pending/count', { clientId: adminSession.id })
      .then((count) => setPendingCount(Number(count) || 0))
      .catch((err) => {
        console.error('[AdminDashboard] pending count failed', err);
        setPendingCount(0);
      })
      .finally(() => setRequestsLoading(false));

    const weekOffPromise = adminRequest<any[]>('/api/leaves/all', { clientId: adminSession.id })
      .then((rows) => {
        const count = (Array.isArray(rows) ? rows : []).filter((request) => {
          const type = String(request?.leaveType || '').toLowerCase();
          const status = String(request?.status || '').toLowerCase();
          return status === 'pending' && (type.includes('weekoff') || type.includes('week off'));
        }).length;
        setWeekOffCount(count);
      })
      .catch((err) => {
        console.error('[AdminDashboard] week off count failed', err);
        setWeekOffCount(0);
      });

    const supportPromise = adminRequest<any[]>('/api/attendance-support', {
      clientId: adminSession.id,
      query: { status: 'PENDING', requestType: 'Attendance Support' },
    })
      .then((rows) => setSupportCount(Array.isArray(rows) ? rows.length : 0))
      .catch((err) => {
        console.error('[AdminDashboard] support count failed', err);
        setSupportCount(0);
      });

    const holidaysPromise = adminRequest<any[]>('/api/admin/holidays', { clientId: adminSession.id })
      .then((rows) => setHolidayCount(Array.isArray(rows) ? rows.length : 0))
      .catch((err) => {
        console.error('[AdminDashboard] holidays failed', err);
        setHolidayCount(0);
      })
      .finally(() => setHolidaysLoading(false));

    await Promise.allSettled([summaryPromise, requestsPromise, weekOffPromise, supportPromise, holidaysPromise]);
  }, [adminSession?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  if (!adminSession) {
    return null;
  }

  return (
    <AdminPage
      title="Admin Dashboard"
      subtitle={adminSession.companyName || adminSession.clientName || adminSession.username || 'Zentime'}
      rightAction={
        <TouchableOpacity
          onPress={async () => {
            await logoutAdmin();
            router.replace('/AdminLogin');
          }}
          style={styles.logoutButton}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <ErrorBanner message={error} />
        <View style={styles.grid}>
          <AdminCard
            title="Employees"
            value={summary.totalEmployees ?? adminSession.employeeCount ?? 0}
            subtitle="Active employees"
            loading={summaryLoading}
            onPress={() => router.push('/AdminEmployees')}
            style={styles.gridCard}
          />
          <AdminCard
            title="Present"
            value={summary.presentToday ?? 0}
            subtitle="Today"
            loading={summaryLoading}
            onPress={() => router.push({ pathname: '/AdminAttendanceList', params: { type: 'present' } })}
            style={styles.gridCard}
          />
          <AdminCard
            title="Absent"
            value={summary.absentToday ?? 0}
            subtitle="Today"
            loading={summaryLoading}
            onPress={() => router.push({ pathname: '/AdminAttendanceList', params: { type: 'absent' } })}
            style={styles.gridCard}
          />
          <AdminCard
            title="Late Arrival"
            value={summary.lateArrivalsToday ?? 0}
            subtitle="Today"
            loading={summaryLoading}
            onPress={() => router.push({ pathname: '/AdminAttendanceList', params: { type: 'late' } })}
            style={styles.gridCard}
          />
          <AdminCard
            title="Leave / Permission"
            value={pendingCount ?? 0}
            subtitle="Pending requests"
            loading={requestsLoading}
            onPress={() => router.push('/AdminLeavePermissions')}
            style={styles.gridCard}
          />
          <AdminCard
            title="Week Off Requests"
            value={weekOffCount ?? 0}
            subtitle="Pending swap requests"
            loading={requestsLoading}
            onPress={() => router.push({ pathname: '/AdminLeavePermissions', params: { type: 'weekoff' } })}
            style={styles.gridCard}
          />
          <AdminCard
            title="Support Requests"
            value={supportCount ?? 0}
            subtitle="Attendance corrections"
            loading={requestsLoading}
            onPress={() => router.push('/AdminSupportRequests')}
            style={styles.gridCard}
          />
          <AdminCard
            title="Holiday"
            value={holidayCount ?? 0}
            subtitle="Configured holidays"
            loading={holidaysLoading}
            onPress={() => router.push('/AdminHolidays')}
            style={styles.gridCard}
          />
        </View>
      </ScrollView>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    marginBottom: 14,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#f3e8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
