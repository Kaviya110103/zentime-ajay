import { MaterialIcons } from "@expo/vector-icons";
import axios from "axios";
import React, { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppTypography';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LocationTest from '../app/LocationTest';
import { isToday, parse } from "date-fns";
import { EmployeeContext } from "../context/EmployeeContext";
import { buildApiUrl, withClientId } from "../lib/api";
import { useAppTheme } from "../context/AppThemeContext";

interface StartDayProps {
  employeeId: number;
  onDone?: () => void;
  onCancel?: () => void;
}

export default function StartDayComponent({ employeeId, onDone, onCancel }: StartDayProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [dayStarted, setDayStarted] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [canStartDay, setCanStartDay] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');
  const [showTimeoutReasonModal, setShowTimeoutReasonModal] = useState(false);
  const [timeoutReason, setTimeoutReason] = useState('');
  const [missedTimeoutRecordId, setMissedTimeoutRecordId] = useState<number | null>(null);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<'Active' | 'Inactive' | 'Unknown'>('Unknown');
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showLocationRequestModal, setShowLocationRequestModal] = useState(false);
  const [locationRequestReason, setLocationRequestReason] = useState('');
  const { employee } = useContext(EmployeeContext);
  const { isDark, colors } = useAppTheme();
  const companyCode = employee?.companyCode;
  const clientId = employee?.clientId;

  useEffect(() => {
    const fetchAttendanceStatus = async () => {
      try {
        const res = await axios.get(
          buildApiUrl(`/api/attendance/latest-today-or-yesterday/${employeeId}`, { clientId })
        );
        const data = res.data;
        if (data?.found === false) {
          return;
        }
        if (data?.date) {
          const parsedDate = parse(data.date, 'dd/MM/yyyy', new Date());
          const today = isToday(parsedDate);
          if (today && data.attendanceStatus === 'Absent') {
            setAttendanceStatus('Absent');
          } else if (today && data.timeIn) {
            setDayStarted(true);
            // If day already started, notify parent
            onDone?.();
          }
        }
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          console.log("Attendance fetch failed", error?.message);
        }
      } finally {
        setInitialLoading(false);
      }
    };
    
    if (employeeId && companyCode) {
      fetchAttendanceStatus();
    }
  }, [employeeId, companyCode]);

  const isAbsentToday = attendanceStatus === 'Absent';
  const actionCardStyle = {
    backgroundColor: isDark ? '#351153' : colors.surface,
    borderColor: isDark ? 'rgba(255,255,255,0.34)' : colors.border,
  };
  const activeActionColor = isDark ? '#FFFFFF' : colors.primary;

  const closeLocationModal = () => {
    setShowLocationModal(false);
    setShowLocationRequestModal(false);
    setLocationRequestReason('');
  };

  const handleStartDayFlow = () => {
    if (isAbsentToday || dayStarted) return;
    setLocationStatus('Unknown');
    setCanStartDay(false);
    setShowLocationRequestModal(false);
    setLocationRequestReason('');
    setShowLocationModal(true);
  };

  const handleStartDay = async (locationOverride?: string) => {
    if (!currentAddress && !locationOverride) {
      Alert.alert("Error", "Location not detected. Please wait or try again.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.put(
        buildApiUrl(`/api/attendance/start-day`),
        null,
        {
          params: withClientId({
            employeeId,
            location: locationOverride ?? currentAddress,
            latitude: currentCoords?.latitude,
            longitude: currentCoords?.longitude,
          }, clientId)
        }
      );
      
      setDayStarted(true);
      setShowLocationModal(false);
      
      // Small delay to ensure state updates
      setTimeout(() => {
        onDone?.();
      }, 100);
      
    } catch (err: any) {
      const errorData = err?.response?.data;
      
      if (errorData?.missedTimeoutRecordId) {
        setMissedTimeoutRecordId(errorData.missedTimeoutRecordId);
        setShowTimeoutReasonModal(true);
        setShowLocationModal(false);
        setPendingLocation(locationOverride ?? currentAddress);
      } else {
        const message = typeof errorData === 'string' ? errorData : 
                       errorData?.message || "Failed to start day.";
        Alert.alert("Alert", message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTimeoutReason = async () => {
    if (!missedTimeoutRecordId) {
      Alert.alert("Error", "Invalid record");
      return;
    }
    
    if (!timeoutReason.trim()) {
      Alert.alert("Error", "Please enter a reason");
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        buildApiUrl(`/api/attendance/submit-timeout-reason`),
        null,
        {
          params: withClientId({
            recordId: missedTimeoutRecordId,
            reason: timeoutReason.trim(),
          }, clientId)
        }
      );
      
      setShowTimeoutReasonModal(false);
      setTimeoutReason('');
      setMissedTimeoutRecordId(null);
      
      if (pendingLocation) {
        await handleStartDay(pendingLocation);
        setPendingLocation(null);
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || err.message || "Submission failed";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationStatus = (status: 'Active' | 'Inactive' | 'Unknown') => {
    setLocationStatus(status);
    setCanStartDay(status === 'Active');
    if (status === 'Active') {
      setShowLocationRequestModal(false);
    }
  };

  const openLocationRequestModal = () => {
    if (locationStatus !== 'Inactive') return;
    setShowLocationRequestModal(true);
  };

  const submitLocationRequest = async () => {
    if (!currentCoords) {
      Alert.alert("Error", "Current GPS location is required.");
      return;
    }
    if (!locationRequestReason.trim()) {
      Alert.alert("Error", "Please provide a reason.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        buildApiUrl(`/api/location-requests/submit`, { clientId }),
        {
          employeeId,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          currentAddress,
          reason: locationRequestReason.trim(),
        }
      );

      setShowLocationRequestModal(false);
      setShowLocationModal(false);
      setLocationRequestReason('');
      setDayStarted(true);
      setTimeout(() => {
        onDone?.();
      }, 100);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to submit location request.";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (dayStarted) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.centerContainer}>
        <TouchableOpacity
          style={[
            styles.touchIconBox,
            actionCardStyle,
            (isAbsentToday || loading) && styles.disabledContainer
          ]}
          onPress={handleStartDayFlow}
          disabled={loading || isAbsentToday}
          testID="attendance-start-day-button"
          accessibilityLabel={isAbsentToday ? "Take Rest" : "Start Day"}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <MaterialIcons 
                name={isAbsentToday ? "hotel" : "wb-sunny"} 
                size={38} 
                color={isAbsentToday ? "#9CA3AF" : activeActionColor}
              />
              <Text style={[
                styles.dayStartText,
                { color: activeActionColor },
                isAbsentToday && styles.disabledText
              ]}>
                {isAbsentToday ? 'Take Rest' : 'Start Day'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        
        {onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={[styles.cancelText, { color: colors.mutedText }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Start Day Location Modal */}
      <Modal visible={showLocationModal} animationType="slide" onRequestClose={closeLocationModal}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeLocationModal}>
              <MaterialIcons name="close" size={24} color={colors.mutedText} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.mapContainer}>
            <LocationTest
              onStatusChange={handleLocationStatus}
              onAddressChange={setCurrentAddress}
              onCoordsChange={setCurrentCoords}
              inModal
            />
          </View>
          
          <View
            style={[
              styles.modalFooter,
              { paddingBottom: Math.max(insets.bottom, 12) + 10, borderTopColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={[styles.confirmButton, (!canStartDay || loading) && styles.disabledButton]}
              onPress={() => handleStartDay()}
              disabled={!canStartDay || loading}
              testID="attendance-confirm-start-day"
              accessibilityLabel="Confirm Start Day"
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Confirm Start Day</Text>
              )}
            </TouchableOpacity>
            {locationStatus === 'Inactive' && (
              <>
                <TouchableOpacity
                  style={[styles.locationRequestButton, loading && styles.disabledButton]}
                  onPress={openLocationRequestModal}
                  disabled={loading}
                  testID="attendance-location-request"
                  accessibilityLabel="Submit Location Request"
                  accessibilityRole="button"
                >
                  <Text style={styles.buttonText}>Submit Location Request</Text>
                </TouchableOpacity>
                <Text style={styles.inactiveHint}>
                  Status is Inactive. Submit a location request to continue.
                </Text>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Location Request Modal for Inactive status */}
      <Modal visible={showLocationRequestModal} animationType="slide" transparent onRequestClose={() => setShowLocationRequestModal(false)}>
        <View style={styles.overlayContainer}>
          <View style={[styles.requestModalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Location Request</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedText }]}>
              You are outside assigned branch location. Submit reason to mark time-in and notify admin.
            </Text>
            <Text style={[styles.locationPreview, { color: colors.text }]}>
              GPS: {currentCoords ? `${currentCoords.latitude.toFixed(6)}, ${currentCoords.longitude.toFixed(6)}` : 'Detecting...'}
            </Text>
            <TextInput
              style={[styles.reasonInput, { backgroundColor: isDark ? "#0f172a" : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
              placeholderTextColor={isDark ? "#94a3b8" : "#9CA3AF"}
              multiline
              numberOfLines={4}
              placeholder="Reason for marking attendance from different location"
              value={locationRequestReason}
              onChangeText={setLocationRequestReason}
              editable={!loading}
              testID="attendance-location-request-reason"
              accessibilityLabel="Location request reason"
            />
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[styles.cancelRequestButton]}
                onPress={() => {
                  setShowLocationRequestModal(false);
                  setLocationRequestReason('');
                }}
                disabled={loading}
              >
                <Text style={styles.cancelRequestButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, (!locationRequestReason.trim() || !currentCoords || loading) && styles.disabledButton]}
                onPress={submitLocationRequest}
                disabled={!locationRequestReason.trim() || !currentCoords || loading}
                testID="attendance-location-request-submit"
                accessibilityLabel="Submit location request"
                accessibilityRole="button"
              >
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Timeout Reason Modal */}
      <Modal visible={showTimeoutReasonModal} animationType="slide">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                setShowTimeoutReasonModal(false);
                setPendingLocation(null);
              }}>
              <MaterialIcons name="close" size={24} color={colors.mutedText} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Timeout Reason Required</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedText }]}>
                Your previous work session timed out. Please provide a reason.
              </Text>
              
              <TextInput
                style={[styles.reasonInput, { backgroundColor: isDark ? "#0f172a" : "#FFFFFF", borderColor: colors.border, color: colors.text }]}
                placeholderTextColor={isDark ? "#94a3b8" : "#9CA3AF"}
                multiline
                numberOfLines={4}
                placeholder="Enter reason..."
                value={timeoutReason}
                onChangeText={setTimeoutReason}
                editable={!loading}
                testID="attendance-timeout-reason"
                accessibilityLabel="Timeout reason"
              />
              
              <TouchableOpacity
                style={[styles.confirmButton, (!timeoutReason.trim() || loading) && styles.disabledButton]}
                onPress={handleSubmitTimeoutReason}
                disabled={!timeoutReason.trim() || loading}
                testID="attendance-timeout-reason-submit"
                accessibilityLabel="Submit Reason"
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Submit Reason</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  touchIconBox: {
    backgroundColor: "#FFFFFF",
    padding: 28,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    width: 150,
    shadowColor: "#351153",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(53,17,83,0.1)",
  },
  dayStartText: {
    fontSize: 16,
    color: "#351153",
    marginTop: 8,
    fontWeight: "600",
  },
  disabledContainer: {
  },
  disabledText: {
    color: "#9CA3AF",
  },
  cancelButton: {
    marginTop: 16,
    padding: 8,
  },
  cancelText: {
    color: "#6B7280",
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  mapContainer: {
    flex: 1,
    minHeight: 400,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalScroll: {
    flexGrow: 1,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    marginBottom: 20,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
  },
  confirmButton: {
    backgroundColor: '#351153',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  locationRequestButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  inactiveHint: {
    marginTop: 10,
    textAlign: 'center',
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '500',
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  requestModalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  locationPreview: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 10,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelRequestButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginRight: 10,
  },
  cancelRequestButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
});

