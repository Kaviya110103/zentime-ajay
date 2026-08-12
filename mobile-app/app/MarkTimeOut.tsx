import AntDesign from "@expo/vector-icons/AntDesign";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { BlurView } from 'expo-blur';
import { CameraMode, CameraType, CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState, useContext, useEffect } from "react";
import { Alert, Dimensions, Modal, Platform, StyleSheet, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { AppText as Text } from '../components/AppTypography';
import * as ImageManipulator from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { EmployeeContext } from "../context/EmployeeContext";
import { buildApiUrl } from "../lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MarkTimeOutScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef<CameraView>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [mode] = useState<CameraMode>("picture");
  const [facing, setFacing] = useState<CameraType>("front");
  const [flashOn, setFlashOn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { employee } = useContext(EmployeeContext);
  const companyCode = employee?.companyCode;
  const clientId = employee?.clientId;
  const { recordId } = useLocalSearchParams();
  const [cameraReady, setCameraReady] = useState(false);
  const [overtimeReason, setOvertimeReason] = useState("");
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const reasonResolver = useRef<((reason: string | null) => void) | null>(null);
  const showWebAwareAlert = (title: string, body: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(`${title}\n\n${body}`);
      return;
    }
    Alert.alert(title, body);
  };

  useEffect(() => {
    // Request permissions on mount
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <LinearGradient colors={['#ffffff', '#f8f8f8']} style={styles.permissionGradient}>
          <View style={styles.permissionContent}>
            <View style={styles.permissionIconContainer}>
              <AntDesign name="camera" size={48} color="#351153" />
            </View>
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionText}>
              To mark your attendance, we need access to your camera for facial verification
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#351153', '#4a1a7a']} style={styles.permissionButtonGradient}>
                <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraReady) {
      showWebAwareAlert("Error", "Camera is not ready yet. Please wait.");
      return;
    }

    try {
      const photo = await ref.current?.takePictureAsync({
        quality: Platform.OS === "web" ? 0.6 : 0.8,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        showWebAwareAlert("Error", "Failed to capture image");
        return;
      }

      // Compress image
      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: Platform.OS === "web" ? 768 : 1024 } }],
        {
          compress: Platform.OS === "web" ? 0.6 : 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      setUri(compressed.uri);
    } catch (error) {
      showWebAwareAlert("Error", "Failed to capture or compress image.");
      console.error("Capture error:", error);
    }
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  const toggleFlash = () => {
    setFlashOn(prev => !prev);
  };

  const uploadPhoto = async () => {
    if (!uri) {
      showWebAwareAlert("Error", "Please capture an image first");
      return;
    }

    if (!recordId) {
      showWebAwareAlert("Error", "Invalid record ID");
      return;
    }
    if (!employee?.id) {
      showWebAwareAlert("Error", "Employee session missing. Please login again.");
      return;
    }

    setUploading(true);

    try {
      const checkResponse = await fetch(
        buildApiUrl(`/api/attendance/check-record`, {
          clientId,
          query: {
            employeeId: employee.id,
            recordId: recordId.toString(),
          },
        })
      );
      if (!checkResponse.ok) {
        showWebAwareAlert("Error", "Attendance record expired. Please refresh and try again.");
        router.replace("/MarkAttendance");
        return;
      }

      const formData = new FormData();
      formData.append("recordId", recordId.toString());

      const shiftEndMinutes = parseTimeStringToMinutes(employee?.shiftEndTime);
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const effectiveShiftEndMinutes = shiftEndMinutes ?? (19 * 60);
      const isAfterShiftEnd = currentMinutes > effectiveShiftEndMinutes;
      let overtimeRequested = false;
      let submittedOvertimeReason = "";

      if (isAfterShiftEnd) {
        overtimeRequested = await askOvertimeConfirmation();
        if (overtimeRequested) {
          const reason = await askOvertimeReason();
          if (!reason) {
            return;
          }
          submittedOvertimeReason = reason;
        }
      }

      formData.append("overtimeRequested", String(overtimeRequested));
      if (submittedOvertimeReason) {
        formData.append("overtimeReason", submittedOvertimeReason);
      }
      
      // Get file info
      const filename = uri.split('/').pop() || `timeout_${Date.now()}.jpg`;
      if (Platform.OS === "web") {
        const imageBlob = await fetch(uri).then((res) => res.blob());
        formData.append("imageOut", imageBlob, filename);
      } else {
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        // @ts-ignore - React Native FormData typing issue
        formData.append("imageOut", {
          uri,
          name: filename,
          type,
        });
      }

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000);
      let response: Response;
      try {
        response = await fetch(buildApiUrl(`/api/attendance/mark-time-out`, { clientId }), {
          method: "POST",
          body: formData,
          signal: abortController.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const responseText = await response.text();
      
      if (response.ok) {
        setUri(null);
        router.replace("/MarkAttendance");
      } else {
        throw new Error(responseText || "Upload failed");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      if (error?.name === "AbortError") {
        showWebAwareAlert("Timeout", "Upload is taking too long. Please retry.");
      } else {
        showWebAwareAlert("Error", "Upload failed: " + (error.message || "Please try again"));
      }
    } finally {
      setUploading(false);
    }
  };

  const askOvertimeConfirmation = () =>
    new Promise<boolean>((resolve) => {
      if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.confirm === "function") {
        const accepted = window.confirm("Overtime Request\n\nDo you want to apply for overtime?");
        resolve(accepted);
        return;
      }
      Alert.alert(
        "Overtime Request",
        "Do you want to apply for overtime?",
        [
          { text: "No", style: "cancel", onPress: () => resolve(false) },
          { text: "Yes", onPress: () => resolve(true) },
        ],
        { cancelable: false }
      );
    });

  const askOvertimeReason = () =>
    new Promise<string | null>((resolve) => {
      setOvertimeReason("");
      reasonResolver.current = resolve;
      setReasonModalVisible(true);
    });

  const closeReasonModal = (reason: string | null) => {
    setReasonModalVisible(false);
    const resolve = reasonResolver.current;
    reasonResolver.current = null;
    resolve?.(reason);
  };

  const parseTimeStringToMinutes = (timeString?: string | null): number | null => {
    if (!timeString) return null;
    const parts = String(timeString).split(":");
    if (parts.length < 2) return null;
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const renderPicture = () => (
    <View style={styles.previewContainer}>
      <LinearGradient colors={['#ffffff', '#f8f8f8']} style={styles.previewGradient}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>Verify Your Attendance</Text>
          <Text style={styles.previewSubtitle}>Please confirm your time-out photo</Text>
        </View>

        <View style={styles.imageContainer}>
          <Image
            source={{ uri: uri! }}
            contentFit="cover"
            style={styles.capturedImage}
            transition={200}
          />
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.actionButton, styles.retakeButton]}
            onPress={() => setUri(null)}
            disabled={uploading}
          >
            <Feather name="refresh-ccw" size={20} color="#351153" />
            <Text style={styles.retakeButtonText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, uploading && styles.disabledButton]}
            onPress={uploadPhoto}
            disabled={uploading}
          >
            <LinearGradient
              colors={uploading ? ['#9CA3AF', '#6B7280'] : ['#351153', '#4a1a7a']}
              style={styles.submitButtonGradient}
            >
              {uploading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <AntDesign name="check-circle" size={20} color="white" />
                  <Text style={styles.submitButtonText}>Upload</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  const renderCamera = () => (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        ref={ref}
        mode={mode}
        facing={facing}
        enableTorch={flashOn}
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Face guide overlay */}
      <View style={styles.faceGuideOverlay}>
        <View style={styles.faceGuideContainer}>
          <View style={styles.faceGuide} />
          <Text style={styles.faceGuideText}>Align your face within the frame</Text>
        </View>
      </View>

      {/* Top controls */}
      <View style={styles.topControlsContainer}>
        <BlurView intensity={30} style={styles.topControlsBlur}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
            <Feather name={flashOn ? "zap" : "zap-off"} size={24} color="#351153" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleFacing}>
            <FontAwesome6 name="camera-rotate" size={24} color="#351153" />
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControlsContainer}>
        <BlurView intensity={30} style={styles.bottomControlsBlur}>
          <View style={styles.shutterContainer}>
            <TouchableOpacity
              style={styles.shutterButton}
              onPress={takePicture}
              disabled={!cameraReady}
            >
              <LinearGradient
                colors={['#351153', '#4a1a7a']}
                style={styles.shutterOuter}
              >
                <View style={styles.shutterInner} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </View>
  );

  return (
    <>
      {uri ? renderPicture() : renderCamera()}
      <Modal visible={reasonModalVisible} transparent animationType="fade" onRequestClose={() => closeReasonModal(null)}>
        <View style={styles.reasonOverlay}>
          <View style={styles.reasonCard}>
            <Text style={styles.reasonTitle}>Overtime Reason</Text>
            <Text style={styles.reasonHelp}>Enter the reason for working after your shift end time.</Text>
            <TextInput
              style={styles.reasonInput}
              value={overtimeReason}
              onChangeText={setOvertimeReason}
              placeholder="Enter overtime reason"
              multiline
              maxLength={500}
            />
            <View style={styles.reasonActions}>
              <TouchableOpacity style={styles.reasonCancel} onPress={() => closeReasonModal(null)}>
                <Text style={styles.reasonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reasonSubmit, !overtimeReason.trim() && styles.disabledButton]}
                disabled={!overtimeReason.trim()}
                onPress={() => closeReasonModal(overtimeReason.trim())}
              >
                <Text style={styles.reasonSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  reasonOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  reasonCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  reasonTitle: {
    color: '#351153',
    fontSize: 20,
    fontWeight: '700',
  },
  reasonHelp: {
    color: '#555',
    marginTop: 8,
    marginBottom: 14,
    lineHeight: 20,
  },
  reasonInput: {
    minHeight: 100,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(53, 17, 83, 0.3)',
    borderRadius: 10,
    textAlignVertical: 'top',
  },
  reasonActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  reasonCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  reasonCancelText: {
    color: '#351153',
    fontWeight: '600',
  },
  reasonSubmit: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#351153',
  },
  reasonSubmitText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  // Permission Screen Styles
  permissionContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  permissionGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  permissionContent: {
    width: '100%',
    alignItems: 'center',
  },
  permissionIconContainer: {
    backgroundColor: 'rgba(53, 17, 83, 0.1)',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: 'rgba(53, 17, 83, 0.3)',
  },
  permissionTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#351153',
    marginBottom: 15,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  permissionButton: {
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#351153',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  permissionButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Camera Screen Styles
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  faceGuideOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 20,
  },
  faceGuideContainer: {
    width: SCREEN_WIDTH - 80,
    aspectRatio: 0.7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: '90%',
    height: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 15,
  },
  faceGuideText: {
    position: 'absolute',
    bottom: -40,
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  topControlsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  topControlsBlur: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(53, 17, 83, 0.1)',
  },
  bottomControlsContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  bottomControlsBlur: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 30,
    paddingVertical: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(53, 17, 83, 0.1)',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterContainer: {
    alignItems: 'center',
  },
  shutterButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#351153',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(53, 17, 83, 0.2)',
    borderWidth: 2,
    borderColor: '#351153',
  },

  // Preview Screen Styles
  previewContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  previewGradient: {
    flex: 1,
    padding: 20,
  },
  previewHeader: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: 30,
  },
  previewTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#351153',
    letterSpacing: 0.5,
  },
  previewSubtitle: {
    fontSize: 16,
    color: '#555',
    marginTop: 8,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  capturedImage: {
    width: '90%',
    aspectRatio: 3/4,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(53, 17, 83, 0.1)',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: Platform.OS === 'ios' ? 50 : 30,
    gap: 12,
  },
  actionButton: {
    borderRadius: 30,
    overflow: 'hidden',
    flex: 1,
  },
  retakeButton: {
    backgroundColor: 'rgba(53, 17, 83, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(53, 17, 83, 0.5)',
    paddingVertical: 15,
    paddingHorizontal: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 25,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    justifyContent: 'center',
  },
  retakeButtonText: {
    color: '#351153',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

