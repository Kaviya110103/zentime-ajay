import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useContext, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import BottomNavBar from '../components/BottomNavBar';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppTypography';
import { EmployeeContext } from '../context/EmployeeContext';
import { buildApiUrl } from '../lib/api';
import { useAppTheme } from '../context/AppThemeContext';

type SupportTab = 'attendance' | 'general';

export default function EmployeeSupportRequest() {
  const { employee } = useContext(EmployeeContext);
  const { colors, isDark } = useAppTheme();
  const [activeTab, setActiveTab] = useState<SupportTab>('attendance');
  const [attendanceDate, setAttendanceDate] = useState('');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<'in' | 'out' | null>(null);

  const showAlert = (title: string, body: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(`${title}\n\n${body}`);
      return;
    }
    Alert.alert(title, body);
  };

  const ensureSession = () => {
    if (employee?.id) return true;
    showAlert('Session expired', 'Please login again.');
    router.replace('/EmployeeLogin');
    return false;
  };

  const normalizeDateForApi = (raw: string) => {
    const value = raw.trim();
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    return value;
  };

  const formatDisplayDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const formatDisplayTime = (date: Date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const selectedDateValue = () => {
    const normalized = normalizeDateForApi(attendanceDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const parsed = new Date(`${normalized}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  };

  const selectedTimeValue = (value: string) => {
    const date = new Date();
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (match) {
      date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    }
    return date;
  };

  const submitAttendanceSupport = async () => {
    if (!ensureSession()) return;
    if (!attendanceDate.trim() || !timeIn.trim() || !timeOut.trim() || !reason.trim()) {
      showAlert('Missing details', 'Please enter date, time in, time out and reason.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizeDateForApi(attendanceDate))) {
      showAlert('Invalid date', 'Use date format YYYY-MM-DD or DD/MM/YYYY.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(timeIn.trim()) || !/^\d{2}:\d{2}$/.test(timeOut.trim())) {
      showAlert('Invalid time', 'Use time format HH:mm, for example 09:30.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(buildApiUrl('/api/attendance-support', { clientId: employee?.clientId }), {
        employeeId: Number(employee?.id),
        requestType: 'Attendance Support',
        attendanceDate: normalizeDateForApi(attendanceDate),
        timeIn: timeIn.trim(),
        timeOut: timeOut.trim(),
        reason: reason.trim(),
      });
      setAttendanceDate('');
      setTimeIn('');
      setTimeOut('');
      setReason('');
      showAlert('Submitted', 'Your attendance support request has been sent to admin.');
    } catch (error: any) {
      console.error('Attendance support request failed:', error);
      showAlert('Submission failed', error?.response?.data?.message || error?.response?.data || 'Unable to submit attendance support request.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitGeneralSupport = async () => {
    if (!ensureSession()) return;
    if (!message.trim()) {
      showAlert('Message required', 'Please enter your support message.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(buildApiUrl('/api/attendance-support', { clientId: employee?.clientId }), {
        employeeId: Number(employee?.id),
        requestType: 'General Support',
        message: message.trim(),
      });
      setMessage('');
      showAlert('Submitted', 'Your general support request has been sent to admin.');
    } catch (error: any) {
      console.error('General support request failed:', error);
      showAlert('Submission failed', error?.response?.data?.message || error?.response?.data || 'Unable to submit general support request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#7726B9', '#351153']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support Request</Text>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.tabs, { backgroundColor: isDark ? '#1f2937' : '#EDE9FE' }]}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'attendance' && styles.activeTab]}
              onPress={() => setActiveTab('attendance')}
            >
              <Text style={[styles.tabText, { color: colors.mutedText }, activeTab === 'attendance' && styles.activeTabText]}>Attendance Support</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'general' && styles.activeTab]}
              onPress={() => setActiveTab('general')}
            >
              <Text style={[styles.tabText, { color: colors.mutedText }, activeTab === 'general' && styles.activeTabText]}>General Support</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.18)' : '#F3E8FF' }]}>
                <Feather name={activeTab === 'attendance' ? 'clock' : 'message-circle'} size={24} color={colors.primary} />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{activeTab === 'attendance' ? 'Attendance Support' : 'General Support'}</Text>
                <Text style={[styles.cardSubtitle, { color: colors.mutedText }]}>
                  {activeTab === 'attendance'
                    ? 'Request correction for attendance time in/out.'
                    : 'Send a message to your admin team.'}
                </Text>
              </View>
            </View>

            {activeTab === 'attendance' ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Date</Text>
                {Platform.OS === 'web' ? (
                  <View style={[styles.input, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}>
                    <input
                      type="date"
                      value={normalizeDateForApi(attendanceDate)}
                      onChange={(event: any) => setAttendanceDate(String(event?.target?.value || ''))}
                      style={webInputStyle}
                    />
                  </View>
                ) : (
                <TouchableOpacity
                  style={[styles.input, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}
                  onPress={() => setShowDatePicker(true)}
                  disabled={submitting}
                >
                  <Text style={[styles.inputValue, { color: colors.text }, !attendanceDate && styles.placeholderText, !attendanceDate && { color: colors.mutedText }]}>
                    {attendanceDate || 'Choose date'}
                  </Text>
                </TouchableOpacity>
                )}
                {showDatePicker && Platform.OS !== 'web' && (
                  <DateTimePicker
                    value={selectedDateValue()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(_, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) setAttendanceDate(formatDisplayDate(selectedDate));
                    }}
                  />
                )}

                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={[styles.label, { color: colors.text }]}>Time In</Text>
                    {Platform.OS === 'web' ? (
                      <View style={[styles.input, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}>
                        <input
                          type="time"
                          value={timeIn}
                          onChange={(event: any) => setTimeIn(String(event?.target?.value || ''))}
                          style={webInputStyle}
                        />
                      </View>
                    ) : (
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}
                      onPress={() => setShowTimePicker('in')}
                      disabled={submitting}
                    >
                      <Text style={[styles.inputValue, { color: colors.text }, !timeIn && styles.placeholderText, !timeIn && { color: colors.mutedText }]}>
                        {timeIn || 'Choose'}
                      </Text>
                    </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.timeField}>
                    <Text style={[styles.label, { color: colors.text }]}>Time Out</Text>
                    {Platform.OS === 'web' ? (
                      <View style={[styles.input, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}>
                        <input
                          type="time"
                          value={timeOut}
                          onChange={(event: any) => setTimeOut(String(event?.target?.value || ''))}
                          style={webInputStyle}
                        />
                      </View>
                    ) : (
                    <TouchableOpacity
                      style={[styles.input, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}
                      onPress={() => setShowTimePicker('out')}
                      disabled={submitting}
                    >
                      <Text style={[styles.inputValue, { color: colors.text }, !timeOut && styles.placeholderText, !timeOut && { color: colors.mutedText }]}>
                        {timeOut || 'Choose'}
                      </Text>
                    </TouchableOpacity>
                    )}
                  </View>
                </View>
                {showTimePicker && Platform.OS !== 'web' && (
                  <DateTimePicker
                    value={selectedTimeValue(showTimePicker === 'in' ? timeIn : timeOut)}
                    mode="time"
                    display="default"
                    onChange={(_, selectedTime) => {
                      const target = showTimePicker;
                      setShowTimePicker(null);
                      if (!selectedTime || !target) return;
                      const formatted = formatDisplayTime(selectedTime);
                      if (target === 'in') setTimeIn(formatted);
                      if (target === 'out') setTimeOut(formatted);
                    }}
                  />
                )}

                <Text style={[styles.label, { color: colors.text }]}>Reason</Text>
                <TextInput
                  style={[styles.messageInput, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border, color: colors.text }]}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reason for attendance correction..."
                  placeholderTextColor={colors.mutedText}
                  multiline
                  numberOfLines={5}
                  maxLength={500}
                  editable={!submitting}
                  textAlignVertical="top"
                />
                <Text style={[styles.counter, { color: colors.mutedText }]}>{reason.length}/500</Text>

                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.disabledButton]}
                  onPress={submitAttendanceSupport}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator color="#FFFFFF" /> : <SubmitLabel />}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Message</Text>
                <TextInput
                  style={[styles.messageInput, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border, color: colors.text }]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Type your support request..."
                  placeholderTextColor={colors.mutedText}
                  multiline
                  numberOfLines={6}
                  maxLength={1000}
                  editable={!submitting}
                  textAlignVertical="top"
                />
                <Text style={[styles.counter, { color: colors.mutedText }]}>{message.length}/1000</Text>

                <TouchableOpacity
                  style={[styles.submitButton, (!message.trim() || submitting) && styles.disabledButton]}
                  onPress={submitGeneralSupport}
                  disabled={!message.trim() || submitting}
                >
                  {submitting ? <ActivityIndicator color="#FFFFFF" /> : <SubmitLabel />}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomNavBar activeTab="" />
    </View>
  );
}

const SubmitLabel = () => (
  <>
    <Feather name="send" size={19} color="#FFFFFF" />
    <Text style={styles.submitText}>Submit Request</Text>
  </>
);

const webInputStyle = {
  width: '100%',
  height: 44,
  borderWidth: 0,
  borderStyle: 'none',
  outlineStyle: 'none',
  backgroundColor: 'transparent',
  color: '#111827',
  fontSize: 15,
} as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : 34,
    paddingBottom: 22,
    paddingHorizontal: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginRight: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 110,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#EDE9FE',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  activeTab: {
    backgroundColor: '#351153',
  },
  tabText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#351153',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    marginRight: 12,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 3,
  },
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F9FAFB',
    color: '#111827',
    fontSize: 15,
    marginBottom: 14,
    justifyContent: 'center',
  },
  inputValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  messageInput: {
    minHeight: 140,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#F9FAFB',
    color: '#111827',
    fontSize: 15,
  },
  counter: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  submitButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#351153',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
