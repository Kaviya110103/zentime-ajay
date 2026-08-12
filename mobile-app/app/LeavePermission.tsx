import DateTimePicker from '@react-native-community/datetimepicker';
import axios from "axios";
import { LinearGradient } from 'expo-linear-gradient';
// import { Calendar, CircleCheck as CheckCircle, Clock, FileText, Send } from 'lucide-react-native';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

import React, { useContext, useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View, KeyboardAvoidingView, SafeAreaView } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppTypography';
import DropDownPicker from "react-native-dropdown-picker";
import BottomNavBar from "../components/BottomNavBar";
import { router, useLocalSearchParams, useRouter } from 'expo-router';
import { EmployeeContext } from "../context/EmployeeContext";
import { buildApiUrl, withClientId } from "../lib/api";
import { APP_FONT_FAMILY } from '../lib/typography';
import { useAppTheme } from '../context/AppThemeContext';

const LeavePermission = () => {

  const router = useRouter();
const { employeeId } = useLocalSearchParams();
const { employee, setEmployee, logout } = useContext(EmployeeContext);
const { colors, isDark } = useAppTheme();
const companyCode = employee?.companyCode;  // 👈 get companyCode here
  // const employeeId = employee?.id;
  const [leaveType, setLeaveType] = useState(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showWebAwareAlert = (title: string, message: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

useEffect(() => {
  if (!employeeId) {
    showWebAwareAlert("Error", "Employee ID is missing.");
      router.replace("/EmployeeLogin"); // Redirect user to login
  }
}, [employeeId]);

  const [openDropdown, setOpenDropdown] = useState(false);
  const [leaveItems, setLeaveItems] = useState([
    { label: "🤒 Sick Leave", value: "Sick Leave" },
    { label: "🏖️ Casual Leave", value: "Casual Leave" },
    { label: "👶 Maternity Leave", value: "Maternity Leave" },
    { label: "💒 Marriage Leave", value: "Marriage Leave" },
  ]);

  const formatDate = (date: Date) => {
    return `${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()}`;
  };

  const toWebDateInputValue = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const parseWebDateInput = (raw: string): Date | null => {
    if (!raw) return null;
    const parsed = new Date(`${raw}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getDaysBetween = (start: Date, end: Date) => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async () => {
    if (!employeeId) {
      showWebAwareAlert("Missing Employee", "Employee ID is missing. Please login again or contact admin.");
      return;
    }
    if (!leaveType || !startDate || !endDate) {
      showWebAwareAlert("Missing Information", "Please fill all required fields marked with *");
      return;
    }
    if (endDate < startDate) {
      showWebAwareAlert("Invalid Dates", "End date cannot be before start date");
      return;
    }

    setIsSubmitting(true);

    const formData = {
      leaveType,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      reason,
      date: formatDate(startDate),
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
        "Your leave request has been submitted successfully and is now pending approval."
      );

      // Reset form
      setLeaveType(null);
      setStartDate(null);
      setEndDate(null);
      setReason("");
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
     <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <LinearGradient
            colors={['#7726B9', '#351153']}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.headerTitle}>Leave Request</Text>
          </LinearGradient>

          {/* DropDownPicker outside ScrollView (IMPORTANT) */}
          <View style={[styles.card, { zIndex: 2000, backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
      <Feather name="file-text" size={25} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Leave Type</Text>
              <Text style={styles.required}>*</Text>
            </View>
            <DropDownPicker
              open={openDropdown}
              value={leaveType}
              items={leaveItems}
              setOpen={setOpenDropdown}
              setValue={setLeaveType}
              setItems={setLeaveItems}
              style={[styles.dropdown, { backgroundColor: isDark ? '#0b1220' : '#ffffff', borderColor: colors.border }]}
              dropDownContainerStyle={[styles.dropdownContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder="Choose your leave type"
              placeholderStyle={[styles.placeholderStyle, { color: colors.mutedText }]}
              textStyle={[styles.dropdownText, { color: colors.text }]}
              listMode="SCROLLVIEW" // Prevent VirtualizedList nesting
            />
          </View>

          {/* Scrollable content */}
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Employee ID Warning */}
            {(!employeeId ) && (
              <View style={[styles.warningBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FFF3CD', borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FFEEBA' }]}>
                <Text style={styles.warningText}>
                  ⚠️ Employee ID is missing. Please login again or contact admin.
                </Text>
              </View>
            )}

            {/* Date Pickers */}
            <View style={styles.dateRow}>
              {/* Start Date */}
              <View style={[styles.card, styles.dateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
<MaterialCommunityIcons name="calendar" size={25} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Start Date</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                {Platform.OS === "web" ? (
                  <View style={styles.dateButton}>
                    <input
                      type="date"
                      value={startDate ? toWebDateInputValue(startDate) : ""}
                      min={toWebDateInputValue(new Date())}
                      onChange={(event: any) => {
                        const parsed = parseWebDateInput(String(event?.target?.value ?? ""));
                        if (!parsed) return;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (parsed < today) {
                          showWebAwareAlert("Invalid Date", "Start date cannot be in the past.");
                          return;
                        }
                        setStartDate(parsed);
                        if (endDate && endDate < parsed) {
                          setEndDate(parsed);
                        }
                      }}
                      style={webPickerInputStyle}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowStartPicker(true)}
                    style={[styles.dateButton, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}
                  >
                    <Text style={[styles.dateText, { color: colors.mutedText }, startDate && styles.dateTextSelected, startDate && { color: colors.text }]}>
                      {startDate ? formatDate(startDate) : "Select date"}
                    </Text>
                  </TouchableOpacity>
                )}
                {showStartPicker && (
                  <DateTimePicker
                    value={startDate || new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "spinner"}
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowStartPicker(false);
                      if (selectedDate) setStartDate(selectedDate);
                    }}
                  />
                )}
              </View>

              {/* End Date */}
              <View style={[styles.card, styles.dateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="calendar" size={25} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>End Date</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                {Platform.OS === "web" ? (
                  <View style={styles.dateButton}>
                    <input
                      type="date"
                      value={endDate ? toWebDateInputValue(endDate) : ""}
                      min={toWebDateInputValue(startDate || new Date())}
                      onChange={(event: any) => {
                        const parsed = parseWebDateInput(String(event?.target?.value ?? ""));
                        if (!parsed) return;
                        const minDate = new Date(startDate || new Date());
                        minDate.setHours(0, 0, 0, 0);
                        if (parsed < minDate) {
                          showWebAwareAlert("Invalid Date", "End date cannot be before start date.");
                          return;
                        }
                        setEndDate(parsed);
                      }}
                      style={webPickerInputStyle}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowEndPicker(true)}
                    style={[styles.dateButton, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border }]}
                  >
                    <Text style={[styles.dateText, { color: colors.mutedText }, endDate && styles.dateTextSelected, endDate && { color: colors.text }]}>
                      {endDate ? formatDate(endDate) : "Select date"}
                    </Text>
                  </TouchableOpacity>
                )}
                {showEndPicker && (
                  <DateTimePicker
                    value={endDate || startDate || new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "spinner"}
                    minimumDate={startDate || new Date()}
                    onChange={(event, selectedDate) => {
                      setShowEndPicker(false);
                      if (selectedDate) setEndDate(selectedDate);
                    }}
                  />
                )}
              </View>
            </View>

            {/* Duration */}
            {startDate && endDate && (
              <View style={[styles.durationCard, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.14)' : '#F3F0FF', borderColor: isDark ? 'rgba(139, 92, 246, 0.32)' : '#D8B4FE' }]}>
                      <Feather name="clock" size={25} color={colors.primary} />

                <Text style={[styles.durationText, { color: isDark ? '#c4b5fd' : '#7726B9' }]}>
                  Duration: {getDaysBetween(startDate, endDate)} day{getDaysBetween(startDate, endDate) > 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {/* Reason */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                 <Feather name="file-text" size={25} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Reason</Text>
                <Text style={styles.optional}>(Optional)</Text>
              </View>
              <TextInput
                style={[styles.textArea, { backgroundColor: isDark ? '#0b1220' : '#F9FAFB', borderColor: colors.border, color: colors.text }]}
                value={reason}
                onChangeText={setReason}
                placeholder="Describe the reason for your leave request..."
                placeholderTextColor={colors.mutedText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={[styles.characterCount, { color: colors.mutedText }]}>{reason.length}/500</Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={isSubmitting ? ['#9CA3AF', '#6B7280'] : ['#7726B9', '#351153']}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSubmitting ? (
                  <Text style={styles.submitText}>Submitting...</Text>
                  
                ) : (
                  <>
                          <Feather name="send" size={25} color="white" />

                    <Text style={styles.submitText}>Submit Request</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Help */}
            <View style={[styles.helpCard, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.14)' : '#F3F0FF', borderColor: isDark ? 'rgba(139, 92, 246, 0.32)' : '#D8B4FE' }]}>
              <Feather name="check-circle" size={25} color={isDark ? '#86efac' : 'green'} />
              <Text style={[styles.helpText, { color: isDark ? '#c4b5fd' : '#7726B9' }]}>
                Your request will be reviewed by Admin and you'll receive a notification once approved.
              </Text>
            </View>
          </ScrollView>

          {/* Bottom nav */}
          <BottomNavBar activeTab="Leave" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    marginTop: 13,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
  container: {
    padding: 15,
    paddingTop: 25,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFEEBA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  warningText: {
    color: '#856404',
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    marginTop:20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
    flex: 1,
  },
  required: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  optional: {
    color: '#9CA3AF',
    fontSize: 12,
    fontStyle: 'italic',
  },
  dropdown: {
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
    minHeight: 50,
  },
  dropdownContainer: {
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  placeholderStyle: {
    color: '#9CA3AF',
    fontSize: 15,
    fontFamily: APP_FONT_FAMILY,
  },
  dropdownText: {
    color: '#1F2937',
    fontSize: 15,
    fontFamily: APP_FONT_FAMILY,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateCard: {
    flex: 1,
  },
  dateButton: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 15,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  dateTextSelected: {
    color: '#1F2937',
    fontWeight: '500',
  },
  durationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F0FF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  durationText: {
    fontSize: 15,
    color: '#7726B9',
    fontWeight: '600',
    marginLeft: 8,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
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
    padding: 18,
    gap: 8,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F0FF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8B4FE',
    marginBottom: 60,

  },
  helpText: {
    fontSize: 12,
    color: '#7726B9',
    marginLeft: 8,
    flex: 1,
    lineHeight:20 }
  });

  export default LeavePermission;


