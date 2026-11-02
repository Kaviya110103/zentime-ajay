import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AdminPage, EmptyState, ErrorBanner, SegmentButton } from '../components/admin/AdminShared';
import { AppText as Text } from '../components/AppTypography';
import { useAdminSession } from '../context/AdminSessionContext';
import { useAppTheme } from '../context/AppThemeContext';
import { adminRequest, fetchAdminBranches } from '../lib/adminApi';

type RequestTypeTab = 'Attendance Support' | 'General Support';
type AttendanceStatusTab = 'PENDING' | 'APPROVED' | 'REJECTED';
type GeneralStatusTab = 'OPEN' | 'RESOLVED' | 'CLOSED';

const attendanceStatuses: AttendanceStatusTab[] = ['PENDING', 'APPROVED', 'REJECTED'];
const generalStatuses: GeneralStatusTab[] = ['OPEN', 'RESOLVED', 'CLOSED'];

function normalize(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function formatDate(value: unknown) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function formatTime(value: unknown) {
  if (!value) return '-';
  return String(value).slice(0, 5);
}

function statusColor(status: unknown) {
  const value = normalize(status);
  if (value === 'APPROVED' || value === 'RESOLVED') return '#16a34a';
  if (value === 'REJECTED' || value === 'CLOSED') return '#dc2626';
  if (value === 'OPEN') return '#ea580c';
  return '#ca8a04';
}

export default function AdminSupportRequests() {
  const router = useRouter();
  const { adminSession, adminReady } = useAdminSession();
  const { colors } = useAppTheme();
  const [requests, setRequests] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>(['All']);
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [requestType, setRequestType] = useState<RequestTypeTab>('Attendance Support');
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatusTab>('PENDING');
  const [generalStatus, setGeneralStatus] = useState<GeneralStatusTab>('OPEN');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | string | null>(null);
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
        console.warn('[AdminSupportRequests] branches failed', err);
      }
    };
    loadBranches();
    return () => {
      active = false;
    };
  }, [adminSession?.id]);

  const activeStatus = requestType === 'Attendance Support' ? attendanceStatus : generalStatus;

  const loadRequests = useCallback(async () => {
    if (!adminSession?.id) return;
    setLoading(true);
    setError('');
    try {
      const branch = selectedBranch === 'All' ? undefined : selectedBranch;
      const data = await adminRequest<any[]>('/api/attendance-support', {
        clientId: adminSession.id,
        query: {
          requestType,
          status: activeStatus,
          branch,
        },
      });
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[AdminSupportRequests] failed', err);
      setRequests([]);
      setError(err instanceof Error ? err.message : 'Failed to load support requests.');
    } finally {
      setLoading(false);
    }
  }, [adminSession?.id, selectedBranch, requestType, activeStatus]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const subtitle = useMemo(() => `${requests.length} ${activeStatus.toLowerCase()} requests`, [requests.length, activeStatus]);

  const updateRequest = async (request: any, action: 'approve' | 'reject' | 'resolve' | 'close') => {
    if (!adminSession?.id || !request?.id || updatingId) return;
    setUpdatingId(request.id);
    setError('');
    try {
      await adminRequest<any>(`/api/attendance-support/${request.id}/${action}`, {
        method: 'POST',
        clientId: adminSession.id,
        body: {
          approvedBy: adminSession.companyName || adminSession.companyCode || adminSession.username || 'Admin',
        },
      });
      Alert.alert('Success', `Request ${action}d.`);
      await loadRequests();
      if (action === 'approve') setAttendanceStatus('APPROVED');
      if (action === 'reject') setAttendanceStatus('REJECTED');
      if (action === 'resolve') setGeneralStatus('RESOLVED');
      if (action === 'close') setGeneralStatus('CLOSED');
    } catch (err) {
      console.error('[AdminSupportRequests] update failed', err);
      const message = err instanceof Error ? err.message : 'Failed to update support request.';
      setError(message);
      Alert.alert('Update Failed', message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminPage title="Support Requests" subtitle={subtitle}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRequests} tintColor={colors.primary} />}
      >
        <ErrorBanner message={error} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {branches.map((branch) => (
            <SegmentButton key={branch} label={branch} active={selectedBranch === branch} onPress={() => setSelectedBranch(branch)} />
          ))}
        </ScrollView>

        <View style={styles.filterWrap}>
          <SegmentButton
            label="Attendance Support"
            active={requestType === 'Attendance Support'}
            onPress={() => setRequestType('Attendance Support')}
          />
          <SegmentButton
            label="General Support"
            active={requestType === 'General Support'}
            onPress={() => setRequestType('General Support')}
          />
        </View>

        <View style={styles.filterWrap}>
          {(requestType === 'Attendance Support' ? attendanceStatuses : generalStatuses).map((status) => (
            <SegmentButton
              key={status}
              label={status.charAt(0) + status.slice(1).toLowerCase()}
              active={activeStatus === status}
              onPress={() => {
                if (requestType === 'Attendance Support') setAttendanceStatus(status as AttendanceStatusTab);
                else setGeneralStatus(status as GeneralStatusTab);
              }}
            />
          ))}
        </View>

        {!loading && requests.length === 0 ? <EmptyState message="No support requests found." /> : null}

        {requests.map((request) => {
          const status = normalize(request?.status);
          const busy = updatingId === request?.id;
          const attendanceRequest = requestType === 'Attendance Support';
          return (
            <View key={String(request?.id)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <View style={styles.cardTitleWrap}>
                  <Text style={[styles.name, { color: colors.text }]}>
                    {request?.employeeName || 'Unknown'} (ID: {request?.employeeId || 'N/A'})
                  </Text>
                  <Text style={[styles.meta, { color: colors.mutedText }]}>{request?.branch || 'No branch'}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusColor(request?.status) }]}>
                  <Text style={styles.statusText}>{status || 'PENDING'}</Text>
                </View>
              </View>

              {attendanceRequest ? (
                <>
                  <Text style={[styles.meta, { color: colors.mutedText }]}>Date: {formatDate(request?.attendanceDate)}</Text>
                  <Text style={[styles.meta, { color: colors.mutedText }]}>
                    Time: {formatTime(request?.timeIn)} - {formatTime(request?.timeOut)}
                  </Text>
                  <Text style={[styles.reason, { color: colors.text }]}>Reason: {request?.reason || '-'}</Text>
                  {status === 'PENDING' ? (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        disabled={busy}
                        onPress={() => updateRequest(request, 'approve')}
                        style={[styles.actionButton, styles.approveButton]}
                      >
                        <Text style={styles.actionText}>{busy ? 'Updating...' : 'Approve'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={busy}
                        onPress={() => updateRequest(request, 'reject')}
                        style={[styles.actionButton, styles.rejectButton]}
                      >
                        <Text style={styles.actionText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={[styles.meta, { color: colors.mutedText }]}>Date: {formatDate(request?.createdAt)}</Text>
                  <Text style={[styles.reason, { color: colors.text }]}>Message: {request?.message || '-'}</Text>
                  {status !== 'CLOSED' && status !== 'RESOLVED' ? (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        disabled={busy}
                        onPress={() => updateRequest(request, 'resolve')}
                        style={[styles.actionButton, styles.approveButton]}
                      >
                        <Text style={styles.actionText}>{busy ? 'Updating...' : 'Resolve'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={busy}
                        onPress={() => updateRequest(request, 'close')}
                        style={[styles.actionButton, styles.closeButton]}
                      >
                        <Text style={styles.actionText}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  filterRow: { marginBottom: 10 },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitleWrap: { flex: 1, paddingRight: 10 },
  name: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  meta: { fontSize: 12, marginTop: 3 },
  reason: { fontSize: 13, marginTop: 8, lineHeight: 19 },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  actions: { flexDirection: 'row', marginTop: 12 },
  actionButton: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  approveButton: { backgroundColor: '#16a34a', marginRight: 8 },
  rejectButton: { backgroundColor: '#dc2626' },
  closeButton: { backgroundColor: '#64748b' },
  actionText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
});
