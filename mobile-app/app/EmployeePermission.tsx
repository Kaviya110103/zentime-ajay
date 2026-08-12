import DateTimePicker from '@react-native-community/datetimepicker';
import axios from "axios";
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useContext, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppTypography';
import BottomNavBar from "../components/BottomNavBar";
import { EmployeeContext } from "../context/EmployeeContext";
import { router, useLocalSearchParams } from 'expo-router';
import { buildApiUrl, withClientId } from "../lib/api";
import { useAppTheme } from "../context/AppThemeContext";

const EmployeePermission = () => {
  const { recordId } = useLocalSearchParams();
  const { employee } = useContext(EmployeeContext);
  const { colors, isDark } = useAppTheme();
  const employeeId = employee?.id;

  const [leaveType] = useState("permission");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState({ start: false });
  const [showTimePicker, setShowTimePicker] = useState({ start: false, end: false });

  const showWebAwareAlert = (title: string, message: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const formatDate = (date: Date) => {
    return `${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()}`;
  };

  const formatTime = (date: Date) => {
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()).padStart(2, "0")}`;
  };

  const toWebDateInputValue = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const parseWebDateInput = (raw: string): Date | null => {
    const parsed = new Date(`${raw}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const toWebTimeInputValue = (date: Date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  const parseWebTimeInput = (raw: string): Date | null => {
    const match = /^(\d{2}):(\d{2})$/.exec(raw);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
      return null;
    }
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const getTimeDifference = (start: Date, end: Date) => {
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHours}h ${diffMinutes}m`;
  };

  const handleSubmit = async () => {
    if (!leaveType || !startDate || !endDate || !startTime || !endTime) {
      showWebAwareAlert("Missing Information", "Please fill all required fields marked with *");
      return;
    }

    if (endTime <= startTime) {
      showWebAwareAlert("Invalid Time", "End time must be after start time");
      return;
    }

    setIsSubmitting(true);

    const formData = {
      leaveType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      reason,
      date: formatDate(startDate),
      startTime: formatTime(startTime),
      endTime: formatTime(endTime),
    };

    try {
      await axios.post(
        buildApiUrl(`/api/leaves/create`),
        formData,
        {
          params: withClientId({ employeeId }, employee?.clientId),
        }
      );

      showWebAwareAlert(
        "Success",
        "Your permission request has been submitted successfully and is now pending approval."
      );

      setReason("");
      setStartDate(null);
      setEndDate(null);
      setStartTime(null);
      setEndTime(null);

      if (recordId) {
        router.replace(`/MarkTimeOut?recordId=${recordId}`);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      showWebAwareAlert(
        "Submission Failed",
        "Unable to submit your request. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#7726B9', '#5E1D9E']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>Permission Request</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="calendar" size={30} color={colors.primary} />
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Start Date <Text style={styles.required}>*</Text></Text>
            {Platform.OS === "web" ? (
              <View style={[styles.inputField, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}>
                <input
                  type="date"
                  value={startDate ? toWebDateInputValue(startDate) : ""}
                  min={toWebDateInputValue(new Date())}
                  onChange={(event: any) => {
                    const parsed = parseWebDateInput(String(event?.target?.value ?? ""));
                    if (!parsed) return;
                    setStartDate(parsed);
                    setEndDate(parsed);
                  }}
                  style={webPickerInputStyle}
                />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowDatePicker({ start: true })}
                style={[styles.inputField, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}
              >
                <Text style={[styles.inputText, { color: colors.mutedText }, startDate && styles.selectedText, startDate && { color: colors.text }]}>
                  {startDate ? formatDate(startDate) : "Select date"}
                </Text>
              </TouchableOpacity>
            )}
            {showDatePicker.start && Platform.OS !== "web" && (
              <DateTimePicker
                value={startDate || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={new Date()}
                onChange={(_, selectedDate) => {
                  setShowDatePicker({ start: false });
                  if (selectedDate) {
                    setStartDate(selectedDate);
                    setEndDate(selectedDate);
                  }
                }}
              />
            )}
          </View>
        </View>

        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="calendar" size={30} color={colors.primary} />
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.mutedText }]}>End Date <Text style={[styles.autoFilled, { color: colors.primary }]}>(Auto)</Text></Text>
            <View style={[styles.inputField, styles.disabledField, { backgroundColor: isDark ? '#111827' : '#F3F4F6', borderColor: colors.border }]}>
              <Text style={[styles.inputText, { color: colors.mutedText }]}>
                {endDate ? formatDate(endDate) : "Same as start date"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.inputRow}>
          <Feather name="clock" size={30} color={colors.primary} />
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Start Time <Text style={styles.required}>*</Text></Text>
            {Platform.OS === "web" ? (
              <View style={[styles.inputField, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}>
                <input
                  type="time"
                  value={startTime ? toWebTimeInputValue(startTime) : ""}
                  onChange={(event: any) => {
                    const parsed = parseWebTimeInput(String(event?.target?.value ?? ""));
                    if (!parsed) return;
                    setStartTime(parsed);
                  }}
                  style={webPickerInputStyle}
                />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowTimePicker({ ...showTimePicker, start: true })}
                style={[styles.inputField, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}
              >
                <Text style={[styles.inputText, { color: colors.mutedText }, startTime && styles.selectedText, startTime && { color: colors.text }]}>
                  {startTime ? formatTime(startTime) : "Select time"}
                </Text>
              </TouchableOpacity>
            )}
            {showTimePicker.start && Platform.OS !== "web" && (
              <DateTimePicker
                value={startTime || new Date()}
                mode="time"
                display="default"
                onChange={(_, selectedTime) => {
                  setShowTimePicker({ ...showTimePicker, start: false });
                  if (selectedTime) setStartTime(selectedTime);
                }}
              />
            )}
          </View>
        </View>

        <View style={styles.inputRow}>
          <Feather name="clock" size={30} color={colors.primary} />
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>End Time <Text style={styles.required}>*</Text></Text>
            {Platform.OS === "web" ? (
              <View style={[styles.inputField, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}>
                <input
                  type="time"
                  value={endTime ? toWebTimeInputValue(endTime) : ""}
                  onChange={(event: any) => {
                    const parsed = parseWebTimeInput(String(event?.target?.value ?? ""));
                    if (!parsed) return;
                    setEndTime(parsed);
                  }}
                  style={webPickerInputStyle}
                />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowTimePicker({ ...showTimePicker, end: true })}
                style={[styles.inputField, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}
              >
                <Text style={[styles.inputText, { color: colors.mutedText }, endTime && styles.selectedText, endTime && { color: colors.text }]}>
                  {endTime ? formatTime(endTime) : "Select time"}
                </Text>
              </TouchableOpacity>
            )}
            {showTimePicker.end && Platform.OS !== "web" && (
              <DateTimePicker
                value={endTime || new Date()}
                mode="time"
                display="default"
                onChange={(_, selectedTime) => {
                  setShowTimePicker({ ...showTimePicker, end: false });
                  if (selectedTime) setEndTime(selectedTime);
                }}
              />
            )}
          </View>
        </View>

        {startTime && endTime && (
          <View style={[styles.durationRow, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.14)' : '#F5F0FF', borderColor: isDark ? 'rgba(139, 92, 246, 0.32)' : '#E9D5FF' }]}>
            <View style={styles.iconContainer}>
              <Feather name="clock" size={30} color={colors.primary} />
            </View>
            <View style={styles.inputContainer}>
              <Text style={[styles.durationText, { color: isDark ? '#c4b5fd' : '#7726B9' }]}>
                Duration: {getTimeDifference(startTime, endTime)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.inputRow}>
          <Feather name="file-text" size={30} color={colors.primary} />
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Reason <Text style={styles.optional}>(Optional)</Text>  <Text style={[styles.characterCount, { color: colors.mutedText }]}>{reason.length}/500</Text>
            </Text>

            <TextInput
              style={[styles.inputField, styles.textArea, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border, color: colors.text }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Describe the reason for your permission request..."
              placeholderTextColor={colors.mutedText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <LinearGradient
            colors={isSubmitting ? ['#9CA3AF', '#6B7280'] : ['#7726B9', '#5E1D9E']}
            style={styles.submitGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isSubmitting ? (
              <Text style={styles.submitText}>Submitting...</Text>
            ) : (
              <>
                <Feather name="send" size={30} color="white" />
                <Text style={styles.submitText}>Submit Request</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={[styles.helpRow, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.14)' : '#F5F3FF', borderColor: isDark ? 'rgba(139, 92, 246, 0.32)' : '#DDD6FE' }]}>
          <Feather name="check-circle" size={30} color={isDark ? '#86efac' : 'green'} />
          <View style={styles.inputContainer}>
            <Text style={[styles.helpText, { color: isDark ? '#c4b5fd' : '#7726B9' }]}>
              Your permission request will be reviewed by HR and you'll receive a notification once approved.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={{ flex: 1, paddingBottom: 80 }}>
        <BottomNavBar activeTab="Permission" />
      </View>
    </View>
  );
};

const webPickerInputStyle = {
  width: "100%",
  height: 44,
  borderWidth: 0,
  borderStyle: "none",
  outlineStyle: "none",
  backgroundColor: "transparent",
  color: "#1F2937",
  fontSize: 15,
} as const;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    marginTop: 0,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    paddingTop: 13,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  container: {
    padding: 10,
    paddingTop: 28,
    marginBottom: 100,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 18,
    alignItems: 'flex-start',
  },
  durationRow: {
    flexDirection: 'row',
    marginBottom: 18,
    alignItems: 'center',
    backgroundColor: '#F5F0FF',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F3FF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  iconContainer: {
    width: 40,
    alignItems: 'center',
    paddingTop: 0,
  },
  inputContainer: {
    flex: 1,
    marginBottom: 10,
    marginHorizontal: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: 'bold',
  },
  optional: {
    color: '#9CA3AF',
    fontSize: 12,
    fontStyle: 'italic',
  },
  autoFilled: {
    color: '#7726B9',
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  inputField: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#F9FAFB',
  },
  disabledField: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  inputText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  selectedText: {
    color: '#1F2937',
    fontWeight: '500',
  },
  durationText: {
    fontSize: 14,
    color: '#7726B9',
    fontWeight: '600',
  },
  textArea: {
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 7,
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#7726B9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    shadowOpacity: 0.1,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    gap: 8,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 12,
    color: '#7726B9',
    lineHeight: 20,
  },
});

export default EmployeePermission;
