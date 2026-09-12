import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AdminPage, EmptyState, ErrorBanner, SegmentButton } from '../components/admin/AdminShared';
import { AppText as Text } from '../components/AppTypography';
import { useAdminSession } from '../context/AdminSessionContext';
import { useAppTheme } from '../context/AppThemeContext';
import { adminRequest, fetchAdminBranches, getDisplayName } from '../lib/adminApi';

type StatusTab = 'pending' | 'approved' | 'rejected';
type TypeTab = 'leave' | 'permission';

export default function AdminLeavePermissions() {
  const router = useRouter();
  const { adminSession, adminReady } = useAdminSession();
  const { colors } = useAppTheme();
  const [requests, setRequests] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>(['All']);
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [typeTab, setTypeTab] = useState<TypeTab>('leave');
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
        console.warn('[AdminLeavePermissions] branches failed', err);
      }
    };
    loadBranches();
    return () => {
      active = false;
    };
  }, [adminSession?.id]);

  const loadRequests = useCallback(async () => {
    if (!adminSession?.id) return;
    setLoading(true);
    setError('');
    try {
      const branch = selectedBranch === 'All' ? undefined : selectedBranch;
      const data = await adminRequest<any[]>('/api/leaves/all', { clientId: adminSession.id, query: { branch } });
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[AdminLeavePermissions] failed', err);
      setRequests([]);
      setError(err instanceof Error ? err.message : 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, [adminSession?.id, selectedBranch]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const visibleRequests = useMemo(() => {
    return requests.filter((request) => {
      const status = String(request?.status || '').toLowerCase();
      const leaveType = String(request?.leaveType || '').toLowerCase();
      const isPermission = leaveType === 'permission';
      return status === statusTab && (typeTab === 'permission' ? isPermission : !isPermission);
    });
  }, [requests, statusTab, typeTab]);

  const updateStatus = async (request: any, status: 'approved' | 'rejected') => {
    if (!adminSession?.id || !request?.id || updatingId) return;
    setUpdatingId(request.id);
    setError('');
    try {
      await adminRequest<string>(`/api/leaves/status/${request.id}`, {
        method: 'PUT',
        clientId: adminSession.id,
        query: { status },
      });
      Alert.alert('Success', `Request ${status}.`);
      await loadRequests();
      setStatusTab(status);
    } catch (err) {
      console.error('[AdminLeavePermissions] update failed', err);
      const message = err instanceof Error ? err.message : 'Failed to update request.';
      setError(message);
      Alert.alert('Update Failed', message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminPage title="Leave / Permission" subtitle={`${visibleRequests.length} ${statusTab} requests`}>
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
          <SegmentButton label="Pending" active={statusTab === 'pending'} onPress={() => setStatusTab('pending')} />
          <SegmentButton label="Approved" active={statusTab === 'approved'} onPress={() => setStatusTab('approved')} />
          <SegmentButton label="Rejected" active={statusTab === 'rejected'} onPress={() => setStatusTab('rejected')} />
        </View>
        <View style={styles.filterWrap}>
          <SegmentButton label="Leave" active={typeTab === 'leave'} onPress={() => setTypeTab('leave')} />
          <SegmentButton label="Permission" active={typeTab === 'permission'} onPress={() => setTypeTab('permission')} />
        </View>

        {!loading && visibleRequests.length === 0 ? <EmptyState message="No requests found." /> : null}

        {visibleRequests.map((request) => {
          const employee = request?.employee || {};
          const busy = updatingId === request?.id;
          return (
            <View key={String(request?.id)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.name, { color: colors.text }]}>{getDisplayName(employee)}</Text>
              <Text style={[styles.meta, { color: colors.mutedText }]}>Type: {request?.leaveType || '-'}</Text>
              <Text style={[styles.meta, { color: colors.mutedText }]}>
                Date: {request?.date || request?.startDate || '-'} {request?.endDate ? `to ${request.endDate}` : ''}
              </Text>
              <Text style={[styles.meta, { color: colors.mutedText }]}>Status: {request?.status || '-'}</Text>
              <Text style={[styles.reason, { color: colors.text }]}>Reason: {request?.reason || '-'}</Text>
              {statusTab === 'pending' ? (
                <View style={styles.actions}>
                  <TouchableOpacity disabled={busy} onPress={() => updateStatus(request, 'approved')} style={[styles.actionButton, styles.approveButton]}>
                    <Text style={styles.actionText}>{busy ? 'Updating...' : 'Approve'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={busy} onPress={() => updateStatus(request, 'rejected')} style={[styles.actionButton, styles.rejectButton]}>
                    <Text style={styles.actionText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
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
  name: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  meta: { fontSize: 12, marginTop: 3 },
  reason: { fontSize: 13, marginTop: 8 },
  actions: { flexDirection: 'row', marginTop: 12 },
  actionButton: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  approveButton: { backgroundColor: '#16a34a', marginRight: 8 },
  rejectButton: { backgroundColor: '#dc2626' },
  actionText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
});
