import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AdminPage, EmptyState, ErrorBanner } from '../components/admin/AdminShared';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppTypography';
import { useAdminSession } from '../context/AdminSessionContext';
import { useAppTheme } from '../context/AppThemeContext';
import { adminRequest, getDisplayName, resolveAssetUrl } from '../lib/adminApi';

export default function AdminEmployees() {
  const router = useRouter();
  const { adminSession, adminReady } = useAdminSession();
  const { colors } = useAppTheme();
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (adminReady && !adminSession) router.replace('/AdminLogin');
  }, [adminReady, adminSession, router]);

  const loadEmployees = useCallback(async () => {
    if (!adminSession?.id) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminRequest<any[]>('/api/employees', { clientId: adminSession.id });
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[AdminEmployees] failed', err);
      setEmployees([]);
      setError(err instanceof Error ? err.message : 'Failed to load employees.');
    } finally {
      setLoading(false);
    }
  }, [adminSession?.id]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((employee) => {
      const value = [
        getDisplayName(employee),
        employee?.employeeCode,
        employee?.branch,
        employee?.mobile,
        employee?.email,
        employee?.position,
      ]
        .join(' ')
        .toLowerCase();
      return value.includes(needle);
    });
  }, [employees, search]);

  return (
    <AdminPage title="Employees" subtitle={`${employees.length} employees`}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadEmployees} tintColor={colors.primary} />}
      >
        <ErrorBanner message={error} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search employee"
          placeholderTextColor={colors.mutedText}
          style={[styles.search, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
        />

        {!loading && filtered.length === 0 ? <EmptyState message="No employees found." /> : null}
        {filtered.map((employee) => {
          const imageUrl = resolveAssetUrl(employee?.profileImage);
          return (
            <TouchableOpacity
              key={String(employee?.id || employee?.employeeCode)}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() =>
                router.push({ pathname: '/AdminEmployeeDetails', params: { id: String(employee?.id || '') } })
              }
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{getDisplayName(employee).slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.text }]}>{getDisplayName(employee)}</Text>
                <Text style={[styles.meta, { color: colors.mutedText }]}>
                  ID: {employee?.id ?? '-'} · {employee?.branch || 'No branch'}
                </Text>
                <Text style={[styles.meta, { color: colors.mutedText }]}>{employee?.mobile || employee?.email || '-'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    fontSize: 15,
  },
  row: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    backgroundColor: '#e5e7eb',
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  meta: { fontSize: 12, marginTop: 2 },
});
