import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AdminPage, EmptyState, ErrorBanner, SegmentButton } from '../components/admin/AdminShared';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppTypography';
import { useAdminSession } from '../context/AdminSessionContext';
import { useAppTheme } from '../context/AppThemeContext';
import { adminRequest, fetchAdminBranches } from '../lib/adminApi';

type HolidayForm = {
  holidayDate: string;
  holidayName: string;
  holidayType: 'FULL' | 'HALF';
  branchScope: string;
};

const emptyForm: HolidayForm = {
  holidayDate: '',
  holidayName: '',
  holidayType: 'FULL',
  branchScope: 'ALL',
};

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    return new Date();
  }
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    return 'Select Date';
  }
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

function confirmDelete(message: string, onConfirm: () => void) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('Delete Holiday', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function AdminHolidays() {
  const router = useRouter();
  const { adminSession, adminReady } = useAdminSession();
  const { colors, isDark } = useAppTheme();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any | null>(null);
  const [form, setForm] = useState<HolidayForm>(emptyForm);

  useEffect(() => {
    if (adminReady && !adminSession) router.replace('/AdminLogin');
  }, [adminReady, adminSession, router]);

  const loadHolidays = useCallback(async () => {
    if (!adminSession?.id) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminRequest<any[]>('/api/admin/holidays', { clientId: adminSession.id });
      setHolidays(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[AdminHolidays] failed', err);
      setHolidays([]);
      setError(err instanceof Error ? err.message : 'Failed to load holidays.');
    } finally {
      setLoading(false);
    }
  }, [adminSession?.id]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  useEffect(() => {
    let active = true;
    const loadBranches = async () => {
      if (!adminSession?.id) {
        if (active) setBranches([]);
        return;
      }
      try {
        const names = await fetchAdminBranches(adminSession.id);
        if (active) setBranches(names);
      } catch (err) {
        console.warn('[AdminHolidays] branches failed', err);
        if (active) setBranches([]);
      }
    };
    loadBranches();
    return () => {
      active = false;
    };
  }, [adminSession?.id]);

  const sortedHolidays = useMemo(
    () => [...holidays].sort((a, b) => String(a?.holidayDate || '').localeCompare(String(b?.holidayDate || ''))),
    [holidays]
  );

  const resetModal = () => {
    setModalVisible(false);
    setDatePickerVisible(false);
    setEditingHoliday(null);
    setForm(emptyForm);
  };

  const closeModal = () => {
    if (saving) return;
    resetModal();
  };

  const openAddModal = () => {
    setError('');
    setSuccess('');
    setEditingHoliday(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEditModal = (holiday: any) => {
    setError('');
    setSuccess('');
    setEditingHoliday(holiday);
    setForm({
      holidayDate: String(holiday?.holidayDate || ''),
      holidayName: String(holiday?.holidayName || ''),
      holidayType: String(holiday?.holidayType || 'FULL').toUpperCase() === 'HALF' ? 'HALF' : 'FULL',
      branchScope: String(holiday?.branchScope || 'ALL'),
    });
    setModalVisible(true);
  };

  const buildPayload = () => ({
    clientId: adminSession?.id,
    holidayDate: form.holidayDate.trim(),
    holidayName: form.holidayName.trim(),
    holidayType: form.holidayType,
    branchScope: form.branchScope || 'ALL',
  });

  const validateForm = () => {
    if (!form.holidayDate.trim() || !form.holidayName.trim()) {
      return 'Holiday name is required.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.holidayDate.trim())) {
      return 'Holiday date must be in yyyy-MM-dd format.';
    }
    return '';
  };

  const saveHoliday = async () => {
    if (!adminSession?.id || saving) return;
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      showAlert('Validation Error', validationError);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const path = editingHoliday?.id ? `/api/admin/holidays/${editingHoliday.id}` : '/api/admin/holidays';
      await adminRequest(path, {
        method: editingHoliday?.id ? 'PUT' : 'POST',
        clientId: adminSession.id,
        body: buildPayload(),
      });
      const message = editingHoliday?.id ? 'Holiday updated.' : 'Holiday added and employees notified.';
      setSuccess(message);
      showAlert('Success', message);
      await loadHolidays();
      resetModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save holiday.';
      setError(message);
      showAlert('Save Failed', message);
    } finally {
      setSaving(false);
    }
  };

  const deleteHoliday = async (holiday: any) => {
    if (!adminSession?.id || !holiday?.id || deletingId) return;
    confirmDelete(`Are you sure you want to delete ${holiday?.holidayName || 'this holiday'}?`, async () => {
      setDeletingId(holiday.id);
      setError('');
      setSuccess('');
      try {
        await adminRequest(`/api/admin/holidays/${holiday.id}`, {
          method: 'DELETE',
          clientId: adminSession.id,
        });
        setSuccess('Holiday deleted.');
        showAlert('Success', 'Holiday deleted.');
        await loadHolidays();
        if (editingHoliday?.id === holiday.id) closeModal();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete holiday.';
        setError(message);
        showAlert('Delete Failed', message);
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <AdminPage title="Holiday Calendar" subtitle={`${holidays.length} holidays`}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadHolidays} tintColor={colors.primary} />}
      >
        <ErrorBanner message={error} />
        {success ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}
        <TouchableOpacity onPress={openAddModal} style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.addButtonText}>Add Holiday</Text>
        </TouchableOpacity>
        {!loading && sortedHolidays.length === 0 ? <EmptyState message="No holidays configured." /> : null}
        {sortedHolidays.map((holiday, index) => (
          <View key={`${holiday?.id || holiday?.holidayDate || index}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.name, { color: colors.text }]}>{holiday?.holidayName || 'Holiday'}</Text>
            <Text style={[styles.meta, { color: colors.mutedText }]}>Start Date: {holiday?.holidayDate || '-'}</Text>
            <Text style={[styles.meta, { color: colors.mutedText }]}>End Date: {holiday?.holidayDate || '-'}</Text>
            <Text style={[styles.meta, { color: colors.mutedText }]}>Type: {holiday?.holidayType || 'FULL'}</Text>
            <Text style={[styles.meta, { color: colors.mutedText }]}>Branch: {holiday?.branchScope && holiday.branchScope !== 'ALL' ? holiday.branchScope : 'All Branches'}</Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => openEditModal(holiday)} style={[styles.actionButton, styles.editButton]}>
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={deletingId === holiday?.id}
                onPress={() => deleteHoliday(holiday)}
                style={[styles.actionButton, styles.deleteButton, deletingId === holiday?.id && styles.disabledAction]}
              >
                <Text style={styles.actionText}>{deletingId === holiday?.id ? 'Deleting...' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</Text>
            <Text style={[styles.label, { color: colors.mutedText }]}>Holiday Date</Text>
            <TouchableOpacity
              onPress={() => setDatePickerVisible(true)}
              style={[styles.dateButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.dateButtonText, { color: form.holidayDate ? colors.text : colors.mutedText }]}>
                {formatDisplayDate(form.holidayDate)}
              </Text>
            </TouchableOpacity>
            {datePickerVisible ? (
              <DateTimePicker
                mode="date"
                value={parseIsoDate(form.holidayDate)}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_event, selectedDate) => {
                  if (Platform.OS !== 'ios') setDatePickerVisible(false);
                  if (selectedDate) {
                    setForm((prev) => ({ ...prev, holidayDate: formatIsoDate(selectedDate) }));
                  }
                }}
              />
            ) : null}
            <Text style={[styles.label, { color: colors.mutedText }]}>Holiday Name</Text>
            <TextInput
              value={form.holidayName}
              onChangeText={(value) => setForm((prev) => ({ ...prev, holidayName: value }))}
              placeholder="Holiday name"
              placeholderTextColor={isDark ? '#94a3b8' : '#9ca3af'}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <Text style={[styles.label, { color: colors.mutedText }]}>Holiday Type</Text>
            <View style={styles.typeRow}>
              <SegmentButton label="Full Day" active={form.holidayType === 'FULL'} onPress={() => setForm((prev) => ({ ...prev, holidayType: 'FULL' }))} />
              <SegmentButton label="Half Day" active={form.holidayType === 'HALF'} onPress={() => setForm((prev) => ({ ...prev, holidayType: 'HALF' }))} />
            </View>
            <Text style={[styles.label, { color: colors.mutedText }]}>Branch</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchRow}>
              <SegmentButton label="All Branches" active={form.branchScope === 'ALL'} onPress={() => setForm((prev) => ({ ...prev, branchScope: 'ALL' }))} />
              {branches.map((branch) => (
                <SegmentButton
                  key={branch}
                  label={branch}
                  active={form.branchScope === branch}
                  onPress={() => setForm((prev) => ({ ...prev, branchScope: branch }))}
                />
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              {editingHoliday?.id ? (
                <TouchableOpacity
                  disabled={saving || deletingId === editingHoliday.id}
                  onPress={() => deleteHoliday(editingHoliday)}
                  style={[styles.modalButton, styles.deleteButton, (saving || deletingId === editingHoliday.id) && styles.disabledAction]}
                >
                  <Text style={styles.actionText}>{deletingId === editingHoliday.id ? 'Deleting...' : 'Delete'}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity disabled={saving} onPress={closeModal} style={[styles.modalButton, styles.cancelButton]}>
                <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={saveHoliday} style={[styles.modalButton, { backgroundColor: colors.primary }, saving && styles.disabledAction]}>
                {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.actionText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  name: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  meta: { fontSize: 12, marginTop: 3 },
  addButton: { borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 14 },
  addButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  successBanner: { backgroundColor: '#dcfce7', borderRadius: 12, padding: 12, marginBottom: 12 },
  successText: { color: '#166534', fontWeight: '700', fontSize: 13 },
  actions: { flexDirection: 'row', marginTop: 12 },
  actionButton: { flex: 1, borderRadius: 10, padding: 11, alignItems: 'center' },
  editButton: { backgroundColor: '#2563eb', marginRight: 8 },
  deleteButton: { backgroundColor: '#dc2626' },
  disabledAction: { opacity: 0.65 },
  actionText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 11, padding: 12, fontSize: 15, marginBottom: 14 },
  dateButton: { borderWidth: 1, borderRadius: 11, padding: 12, marginBottom: 14 },
  dateButtonText: { fontSize: 15 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  branchRow: { marginBottom: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
  modalButton: { minWidth: 82, borderRadius: 10, padding: 12, alignItems: 'center', marginLeft: 8 },
  cancelButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#64748b' },
  cancelText: { fontWeight: 'bold', fontSize: 13 },
});
