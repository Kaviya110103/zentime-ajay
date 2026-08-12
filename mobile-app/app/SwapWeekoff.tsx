import DateTimePicker from "@react-native-community/datetimepicker";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import React, { useContext, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { AppText as Text, AppTextInput as TextInput } from "../components/AppTypography";
import BottomNavBar from "../components/BottomNavBar";
import { EmployeeContext } from "../context/EmployeeContext";
import { buildApiUrl, withClientId } from "../lib/api";
import { useAppTheme } from "../context/AppThemeContext";

const SwapWeekoff = () => {
  const { employee } = useContext(EmployeeContext);
  const { isDark, colors } = useAppTheme();
  const employeeId = employee?.id;
  const actualWeekoff = String(employee?.weekOff || "").trim() || "Not Set";

  const [swapDate, setSwapDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (date: Date) =>
    `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

  const toWebDateInputValue = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const parseWebDateInput = (raw: string): Date | null => {
    const parsed = new Date(`${raw}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const handleSubmit = async () => {
    if (!employeeId) {
      Alert.alert("Missing Employee", "Employee ID is missing. Please login again.");
      return;
    }
    if (!swapDate) {
      Alert.alert("Missing Information", "Please select the swap weekoff date.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Missing Information", "Please enter the reason for swap weekoff.");
      return;
    }

    setIsSubmitting(true);
    const swapDateText = formatDate(swapDate);

    const payload = {
      leaveType: "Swap Weekoff",
      startDate: swapDateText,
      endDate: swapDateText,
      date: swapDateText,
      reason: reason.trim(),
    };

    try {
      await axios.post(buildApiUrl("/api/leaves/create"), payload, {
        params: withClientId({ employeeId }, employee?.clientId),
      });

      Alert.alert(
        "Success",
        "Swap weekoff request submitted successfully. Waiting for admin approval."
      );
      setSwapDate(null);
      setReason("");
    } catch (error) {
      console.error("Swap weekoff submit failed:", error);
      Alert.alert("Submission Failed", "Unable to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#7726B9", "#5E1D9E"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>Swap Weekoff Request</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="calendar-week" size={28} color={colors.primary} />
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Actual Weekoff Day</Text>
            <View
              style={[
                styles.inputField,
                styles.disabledField,
                { backgroundColor: isDark ? "#1f2937" : "#F3F4F6", borderColor: colors.border },
              ]}
            >
              <Text style={[styles.inputText, styles.selectedText, { color: colors.text }]}>{actualWeekoff}</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputRow}>
          <Feather name="calendar" size={28} color={colors.primary} />
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>
              Swap Day <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS === "web") {
                  const picked = globalThis.prompt?.(
                    "Select swap day (YYYY-MM-DD)",
                    toWebDateInputValue(swapDate || new Date())
                  );
                  if (!picked) return;
                  const parsed = parseWebDateInput(picked.trim());
                  if (!parsed) {
                    Alert.alert("Invalid Date", "Please use YYYY-MM-DD format.");
                    return;
                  }
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  if (parsed < today) {
                    Alert.alert("Invalid Date", "Swap date cannot be in the past.");
                    return;
                  }
                  setSwapDate(parsed);
                  return;
                }
                setShowDatePicker(true);
              }}
              style={[styles.inputField, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.inputText, swapDate && styles.selectedText, swapDate && { color: colors.text }]}>
                {swapDate ? formatDate(swapDate) : "Select swap weekoff date"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={swapDate || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={new Date()}
                onChange={(_, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) setSwapDate(selectedDate);
                }}
              />
            )}
          </View>
        </View>

        <View style={styles.inputRow}>
          <Feather name="file-text" size={28} color={colors.primary} />
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>
              Reason <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.inputField, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Enter reason for swapping weekoff"
              placeholderTextColor={isDark ? "#94a3b8" : "#9CA3AF"}
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
            colors={isSubmitting ? ["#9CA3AF", "#6B7280"] : ["#7726B9", "#5E1D9E"]}
            style={styles.submitGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Feather name="send" size={18} color="#fff" />
            <Text style={styles.submitText}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ flex: 1, paddingBottom: 80 }}>
        <BottomNavBar activeTab="Home" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  container: {
    padding: 12,
    paddingTop: 24,
    marginBottom: 100,
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: 18,
    alignItems: "flex-start",
  },
  inputContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  required: {
    color: "#EF4444",
    fontWeight: "bold",
  },
  inputField: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#F9FAFB",
  },
  disabledField: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },
  inputText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  selectedText: {
    color: "#1F2937",
    fontWeight: "500",
  },
  textArea: {
    minHeight: 100,
  },
  submitButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.8,
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default SwapWeekoff;
