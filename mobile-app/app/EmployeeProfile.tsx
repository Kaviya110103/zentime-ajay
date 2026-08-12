import BottomNavBar from "../components/BottomNavBar";
// @ts-ignore - expo/vector-icons type declarations issue
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useContext, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppTypography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmployeeContext } from "../context/EmployeeContext";
import { buildApiUrl, resolveAssetUrl } from "../lib/api";
import { useAppTheme } from "../context/AppThemeContext";

const { width, height } = Dimensions.get("window");
const isDesktop = width >= 768;
const PROFILE_IMAGE_MAX_WIDTH = 900;
const PROFILE_IMAGE_QUALITY = 0.65;

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  mobile: string;
  gender: string;
  position: string;
  branch: string;
  username: string;
  password: string;
  dob: string;
  email: string;
  profileImage: string | null;
  address: string;
  alternativeMobile: string;
  dateOfJoining: string;
  resetToken: string | null;
  salary: number | null;
  weekOff: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  leavePolicyType: string | null;
  casualLeaveBalance: number | null;
  employeeCode: string | null;
  clientId: number;
  companyCode: string;
  additionalWorkingDays?: EmployeeAdditionalWorkingDay[];
}

interface EmployeeAdditionalWorkingDay {
  id: number;
  dayType: string;
  timeIn: string | null;
  timeOut: string | null;
}

const Employee = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const { employee, setEmployee, logout } = useContext(EmployeeContext);
  const { colors, isDark } = useAppTheme();
  const companyCode = employee?.companyCode;
  const employeeId = employee?.id;
  const clientId = employee?.clientId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  useEffect(() => {
    if (!employeeId) {
      router.replace("/EmployeeLogin");
    }
  }, [employeeId, router]);

  const fetchAdditionalWorkingDays = useCallback(async () => {
    if (!employeeId) return [];
    const response = await fetch(buildApiUrl(`/api/employees/${employeeId}/additional-working-days`, { clientId }));
    if (!response.ok) {
      return [];
    }
    const data = await response.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  }, [employeeId, clientId]);

  const fetchEmployeeData = useCallback(async () => {
    if (!employeeId) return;

    try {
      setError(null);
      if (!employee) {
        setLoading(true);
      }
      const response = await fetch(buildApiUrl(`/api/employees/${employeeId}`, { clientId }));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const additionalWorkingDays = await fetchAdditionalWorkingDays();
      const employeeData = {
        ...data,
        additionalWorkingDays,
      };
      setEmployee(employeeData);
      setFormData((prev) => ({
        ...(employeeData as Partial<Employee>),
        password: prev.password ?? "",
      }));
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      Alert.alert("Error", "Failed to fetch employee data");
    }
  }, [employeeId, clientId, setEmployee, employee, fetchAdditionalWorkingDays]);

  useFocusEffect(
    useCallback(() => {
      fetchEmployeeData();
    }, [fetchEmployeeData])
  );

  const handleLogout = async () => {
    await logout();
    router.replace("/EmployeeLogin");
  };

  const handleInputChange = useCallback((field: keyof Employee, value: string) => {
    setFormData(prev => {
      let fieldValue: any = value;
      if (field === "salary" || field === "casualLeaveBalance") {
        fieldValue = value === "" ? null : Number(value);
      }
      return {
        ...prev,
        [field]: fieldValue
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!employeeId || !companyCode) return;

    try {
      setSaving(true);
      const requestedNewPassword = formData.password ? String(formData.password).trim() : "";

      if (requestedNewPassword) {
        const hasMinLength = requestedNewPassword.length >= 8;
        const hasLetter = /[A-Za-z]/.test(requestedNewPassword);
        const hasNumber = /\d/.test(requestedNewPassword);
        const hasSpecialChar = /[^A-Za-z0-9]/.test(requestedNewPassword);

        if (!hasMinLength || !hasLetter || !hasNumber || !hasSpecialChar) {
          setSaving(false);
          Alert.alert(
            "Invalid Password",
            "Password must be at least 8 characters and include letters, numbers, and at least one special character."
          );
          return;
        }
      }

      const payload: Partial<Employee> = { ...formData };
      // Password is updated through dedicated endpoint to avoid silent misses.
      delete payload.password;

      const response = await fetch(buildApiUrl(`/api/employees/update/${employeeId}`, { clientId }), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Profile update failed. status: ${response.status}`);
      }

      const updatedEmployee = await response.json();

      if (requestedNewPassword) {
        const changePasswordResponse = await fetch(
          buildApiUrl(`/api/employees/${employeeId}/change-password`, { clientId }),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newPassword: requestedNewPassword }),
          }
        );
        if (!changePasswordResponse.ok) {
          // Fallback for older backend deployments: retry via legacy update API with password.
          if (changePasswordResponse.status === 404 || changePasswordResponse.status === 405) {
            const legacyPasswordResponse = await fetch(
              buildApiUrl(`/api/employees/update/${employeeId}`, { clientId }),
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...payload,
                  password: requestedNewPassword,
                }),
              }
            );
            if (!legacyPasswordResponse.ok) {
              const legacyErrText = await legacyPasswordResponse.text();
              throw new Error(legacyErrText || `Password update failed. status: ${legacyPasswordResponse.status}`);
            }
          } else {
            const errText = await changePasswordResponse.text();
            throw new Error(errText || `Password change failed. status: ${changePasswordResponse.status}`);
          }
        }
      }

      setEmployee(updatedEmployee);
      setFormData({
        ...(updatedEmployee as Partial<Employee>),
        password: "",
      }); // clear password field after save
      setIsEditing(false);
      setSaving(false);
      Alert.alert("Success", requestedNewPassword ? "Profile and password updated successfully" : "Profile updated successfully");
    } catch (err: any) {
      setSaving(false);
      Alert.alert("Error", err?.message || "Failed to update profile");
      console.error("Update error:", err);
    }
  }, [employeeId, formData, setEmployee, companyCode]);

  const toggleEditMode = useCallback(() => {
    if (!isEditing && employee) {
      // When entering edit mode, ensure formData is current
      setFormData({
        ...(employee as unknown as Partial<Employee>),
        password: "",
      });
    }
    setIsEditing(!isEditing);
    setMenuVisible(false);
  }, [isEditing, employee]);

  const handleCancel = useCallback(() => {
    // Reset form data to original employee data
    if (employee) {
      setFormData({
        ...(employee as unknown as Partial<Employee>),
        password: "",
      });
    }
    setIsEditing(false);
  }, [employee]);

  const pickImageAndUpload = useCallback(async () => {
    if (!employeeId) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Permission to access gallery is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: PROFILE_IMAGE_QUALITY,
    });

    if (!result.canceled && result.assets.length > 0) {
      const selectedAsset = result.assets[0];

      try {
        const compressedImage = await ImageManipulator.manipulateAsync(
          selectedAsset.uri,
          [{ resize: { width: PROFILE_IMAGE_MAX_WIDTH } }],
          {
            compress: PROFILE_IMAGE_QUALITY,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        const uploadForm = new FormData();
        const fileName = `profile-${employeeId}-${Date.now()}.jpg`;

        uploadForm.append("file", {
          uri: compressedImage.uri,
          name: fileName,
          type: "image/jpeg",
        } as any);

        const response = await fetch(
          buildApiUrl(`/api/employees/${employeeId}/upload-image`, { clientId }),
          {
            method: "PUT",
            body: uploadForm,
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          const isTooLarge = response.status === 413 || /413|too large|request entity/i.test(errText);
          const updatedAfterFailure = await fetch(
            buildApiUrl(`/api/employees/${employeeId}`, { clientId })
          ).catch(() => null);
          if (updatedAfterFailure?.ok) {
            const updatedData = await updatedAfterFailure.json();
            const oldImage = String(employee?.profileImage || "").trim();
            const newImage = String(updatedData?.profileImage || "").trim();
            if (newImage && newImage !== oldImage) {
              const additionalWorkingDays = await fetchAdditionalWorkingDays();
              const employeeData = {
                ...updatedData,
                additionalWorkingDays,
              };
              setEmployee(employeeData);
              setFormData((prev) => ({
                ...(employeeData as Partial<Employee>),
                password: prev.password ?? "",
              }));
              Alert.alert("Success", "Image uploaded successfully");
              return;
            }
          }
          throw new Error(
            isTooLarge
              ? "Image is still too large. Please choose a smaller photo."
              : errText || "Failed to upload image"
          );
        }

        Alert.alert("Success", "Image uploaded successfully");

        // Refresh employee data to keep context and admin panel data in sync.
        const updatedResponse = await fetch(
          buildApiUrl(`/api/employees/${employeeId}`, { clientId })
        );
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json();
          const additionalWorkingDays = await fetchAdditionalWorkingDays();
          const employeeData = {
            ...updatedData,
            additionalWorkingDays,
          };
          setEmployee(employeeData);
          setFormData((prev) => ({
            ...(employeeData as Partial<Employee>),
            password: prev.password ?? "",
          }));
        }
      } catch (err: any) {
        console.error(err);
        Alert.alert("Error", err?.message || "An error occurred during image upload.");
      }
    }
  }, [employeeId, clientId, employee?.profileImage, setEmployee, fetchAdditionalWorkingDays]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !employee) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || "No employee data found"}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={isDark ? [colors.background, colors.background] : ["#ffffff", "#f8fafc"]} style={styles.background}>
        {/* Header */}
        <LinearGradient
          colors={['#7726B9', '#5E1D9E']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.headerTitle}>Employee Profile</Text>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
          >
            <Ionicons name="menu" size={24} color="#ffffff" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Menu Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={menuVisible}
          onRequestClose={() => setMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          >
            <View style={[styles.modalContainer, isDesktop && styles.desktopModalContainer]}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }, isDesktop && styles.desktopModalContent]}>
                <TouchableOpacity style={styles.menuItem} onPress={toggleEditMode}>
                  <Ionicons name={isEditing ? "close" : "create"} size={20} color={colors.mutedText} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>
                    {isEditing ? "Cancel Editing" : "Edit Profile"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  setMenuVisible(false);
                  router.push("/MarkAttendance");
                }}>
                  <Ionicons name="calendar" size={20} color={colors.mutedText} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Mark Attendance</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuItem, styles.logoutMenuItem]} onPress={handleLogout}>
                  <Ionicons name="log-out" size={20} color="#ef4444" />
                  <Text style={[styles.menuItemText, styles.logoutText]}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100 + Math.max(insets.bottom, 8) },
            isDesktop && styles.desktopScrollContent,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Image Section */}
          <View style={styles.profileImageSection}>
            <View style={styles.profileImageContainer}>
              <Image
                source={{ 
                  uri: resolveAssetUrl(employee.profileImage) || 'https://via.placeholder.com/100'
                }}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  resizeMode: 'cover',
                  backgroundColor: '#f0f0f0'
                }}
              />
              {isEditing && (
                <TouchableOpacity style={styles.editImageButton} onPress={pickImageAndUpload}>
                  <Ionicons name="camera" size={20} color="white" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.nameContainer}>
              <Text style={[styles.employeeName, { color: colors.text }]}>
                {employee.firstName} {employee.lastName}
              </Text>
              <Text style={[styles.employeePosition, { color: colors.mutedText }]}>{employee.position}</Text>
            </View>
          </View>

          {/* Personal Information */}
          <ProfileSection title="Personal Information">
            {isEditing ? (
              <>
                <EditableInfoRow
                  icon={<Ionicons name="person" size={18} color="#64748b" />}
                  label="First Name"
                  field="firstName"
                  value={formData.firstName || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="person" size={18} color="#64748b" />}
                  label="Last Name"
                  field="lastName"
                  value={formData.lastName || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="mail" size={18} color="#64748b" />}
                  label="Email"
                  field="email"
                  value={formData.email || ""}
                  keyboardType="email-address"
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="call" size={18} color="#64748b" />}
                  label="Mobile"
                  field="mobile"
                  value={formData.mobile || ""}
                  keyboardType="phone-pad"
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="call" size={18} color="#64748b" />}
                  label="Alt Mobile"
                  field="alternativeMobile"
                  value={formData.alternativeMobile || ""}
                  keyboardType="phone-pad"
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="calendar" size={18} color="#64748b" />}
                  label="Date of Birth"
                  field="dob"
                  value={formData.dob || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="male-female" size={18} color="#64748b" />}
                  label="Gender"
                  field="gender"
                  value={formData.gender || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="home" size={18} color="#64748b" />}
                  label="Address"
                  field="address"
                  value={formData.address || ""}
                  onChangeText={handleInputChange}
                />
              </>
            ) : (
              <>
                <InfoRow
                  icon={<Ionicons name="mail" size={18} color="#64748b" />}
                  label="Email"
                  value={employee.email}
                />
                <InfoRow
                  icon={<Ionicons name="call" size={18} color="#64748b" />}
                  label="Mobile"
                  value={employee.mobile}
                />
                <InfoRow
                  icon={<Ionicons name="call" size={18} color="#64748b" />}
                  label="Alt Mobile"
                  value={employee.alternativeMobile}
                />
                <InfoRow
                  icon={<Ionicons name="calendar" size={18} color="#64748b" />}
                  label="Date of Birth"
                  value={employee.dob}
                />
                <InfoRow
                  icon={<Ionicons name="male-female" size={18} color="#64748b" />}
                  label="Gender"
                  value={employee.gender}
                />
                <InfoRow
                  icon={<Ionicons name="home" size={18} color="#64748b" />}
                  label="Address"
                  value={employee.address}
                />
              </>
            )}
          </ProfileSection>

          {/* Employment Information */}
          <ProfileSection title="Employment Information">
            {isEditing ? (
              <>
                <EditableInfoRow
                  icon={<FontAwesome5 name="building" size={16} color="#64748b" />}
                  label="Branch"
                  field="branch"
                  value={formData.branch || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<MaterialIcons name="work" size={18} color="#64748b" />}
                  label="Position"
                  field="position"
                  value={formData.position || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="calendar" size={18} color="#64748b" />}
                  label="Joining Date"
                  field="dateOfJoining"
                  value={formData.dateOfJoining || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<MaterialIcons name="currency-rupee" size={18} color="#64748b" />}
                  label="Salary"
                  field="salary"
                  value={formData.salary || ""}
                  keyboardType="numeric"
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<FontAwesome5 name="calendar-day" size={16} color="#64748b" />}
                  label="Week Off"
                  field="weekOff"
                  value={formData.weekOff || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="time-outline" size={18} color="#64748b" />}
                  label="Shift Start"
                  field="shiftStartTime"
                  value={formData.shiftStartTime || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="time-outline" size={18} color="#64748b" />}
                  label="Shift End"
                  field="shiftEndTime"
                  value={formData.shiftEndTime || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="briefcase-outline" size={18} color="#64748b" />}
                  label="Leave Policy"
                  field="leavePolicyType"
                  value={formData.leavePolicyType || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="wallet-outline" size={18} color="#64748b" />}
                  label="Casual Leave Balance"
                  field="casualLeaveBalance"
                  value={formData.casualLeaveBalance ?? ""}
                  keyboardType="numeric"
                  onChangeText={handleInputChange}
                />
              </>
            ) : (
              <>
                <InfoRow
                  icon={<FontAwesome5 name="building" size={16} color="#64748b" />}
                  label="Branch"
                  value={employee.branch || ""}
                />
                <InfoRow
                  icon={<MaterialIcons name="work" size={18} color="#64748b" />}
                  label="Position"
                  value={employee.position || ""}
                />
                <InfoRow
                  icon={<Ionicons name="calendar" size={18} color="#64748b" />}
                  label="Joining Date"
                  value={employee.dateOfJoining}
                />
                <InfoRow
                  icon={<MaterialIcons name="currency-rupee" size={18} color="#64748b" />}
                  label="Salary"
                  value={`₹${(employee.salary ?? 0).toLocaleString('en-IN')}`}
                />
                <InfoRow
                  icon={<FontAwesome5 name="calendar-day" size={16} color="#64748b" />}
                  label="Week Off"
                  value={employee.weekOff ?? ""}
                />
                <InfoRow
                  icon={<Ionicons name="time-outline" size={18} color="#64748b" />}
                  label="Shift Start"
                  value={employee.shiftStartTime ?? "--"}
                />
                <InfoRow
                  icon={<Ionicons name="time-outline" size={18} color="#64748b" />}
                  label="Shift End"
                  value={employee.shiftEndTime ?? "--"}
                />
                <InfoRow
                  icon={<Ionicons name="briefcase-outline" size={18} color="#64748b" />}
                  label="Leave Policy"
                  value={String(formData.leavePolicyType ?? "--")}
                />
                <InfoRow
                  icon={<Ionicons name="wallet-outline" size={18} color="#64748b" />}
                  label="Casual Leave Balance"
                  value={formData.casualLeaveBalance ?? 0}
                />
              </>
            )}
          </ProfileSection>

          <ProfileSection title="Login Credentials">
            {isEditing ? (
              <>
                <InfoRow
                  icon={<Ionicons name="person-circle-outline" size={18} color="#64748b" />}
                  label="Employee ID"
                  value={employee.id}
                />
                <InfoRow
                  icon={<Ionicons name="card-outline" size={18} color="#64748b" />}
                  label="Employee Code"
                  value={String(formData.employeeCode ?? '--')}
                />
                <EditableInfoRow
                  icon={<Ionicons name="at" size={18} color="#64748b" />}
                  label="Username"
                  field="username"
                  value={formData.username || ""}
                  onChangeText={handleInputChange}
                />
                <EditableInfoRow
                  icon={<Ionicons name="lock-closed-outline" size={18} color="#64748b" />}
                  label="Password"
                  field="password"
                  value={formData.password || ""}
                  onChangeText={handleInputChange}
                />
                <InfoRow
                  icon={<Ionicons name="business-outline" size={18} color="#64748b" />}
                  label="Company Code"
                  value={employee.companyCode || '--'}
                />
                <InfoRow
                  icon={<Ionicons name="id-card-outline" size={18} color="#64748b" />}
                  label="Client ID"
                  value={employee.clientId}
                />
              </>
            ) : (
              <>
                <InfoRow
                  icon={<Ionicons name="person-circle-outline" size={18} color="#64748b" />}
                  label="Employee ID"
                  value={employee.id}
                />
                <InfoRow
                  icon={<Ionicons name="card-outline" size={18} color="#64748b" />}
                  label="Employee Code"
                  value={String(formData.employeeCode ?? '--')}
                />
                <InfoRow
                  icon={<Ionicons name="at" size={18} color="#64748b" />}
                  label="Username"
                  value={employee.username || '--'}
                />
                <InfoRow
                  icon={<Ionicons name="lock-closed-outline" size={18} color="#64748b" />}
                  label="Password"
                  value={formData.password ? '********' : '--'}
                />
                <InfoRow
                  icon={<Ionicons name="business-outline" size={18} color="#64748b" />}
                  label="Company Code"
                  value={employee.companyCode || '--'}
                />
                <InfoRow
                  icon={<Ionicons name="id-card-outline" size={18} color="#64748b" />}
                  label="Client ID"
                  value={employee.clientId}
                />
              </>
            )}
          </ProfileSection>

          <ProfileSection title="Additional Working Days">
            {formData.additionalWorkingDays && formData.additionalWorkingDays.length > 0 ? (
              formData.additionalWorkingDays.map((day) => (
                <View key={day.dayType || String(day.id)} style={styles.additionalDayRow}>
                  <Text style={styles.additionalDayType}>{day.dayType || '--'}</Text>
                  <Text style={styles.additionalDayTime}>
                    {day.timeIn || '--:--'} - {day.timeOut || '--:--'}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noAttendanceText}>No additional working days configured.</Text>
            )}
          </ProfileSection>

          {isEditing && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.cancelButton]} 
                onPress={handleCancel}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.saveButton]} 
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        
        {/* Bottom Nav Bar */}
        <BottomNavBar activeTab="Profile" />
      </LinearGradient>
    </View>
  );
};

// Component definitions moved outside of Employee component
const ProfileSection = React.memo<{ title: string; children: React.ReactNode }>(({ title, children }) => {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }, Dimensions.get('window').width >= 768 && styles.desktopSection]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
});

const InfoRow = React.memo<{ icon: React.ReactNode; label: string; value: string | number }>(({
  icon,
  label,
  value,
}) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        {icon}
        <Text style={[styles.infoLabelText, { color: colors.mutedText }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
        {value}
      </Text>
    </View>
  );
});

const EditableInfoRow = React.memo<{
  icon: React.ReactNode;
  label: string;
  field: keyof Employee;
  value: string | number | null;
  keyboardType?: string;
  onChangeText: (field: keyof Employee, value: string) => void;
}>(({ icon, label, field, value, keyboardType = "default", onChangeText }) => {
  const { colors, isDark } = useAppTheme();
  return (
    <View style={styles.editableInfoRow}>
      <View style={styles.infoLabel}>
        {icon}
        <Text style={[styles.infoLabelText, { color: colors.mutedText }]}>{label}</Text>
      </View>
      <TextInput
        style={[styles.editInput, { backgroundColor: isDark ? '#0b1220' : '#f9fafb', borderColor: colors.border, color: colors.text }]}
        value={value === null ? "" : String(value)}
        onChangeText={(text) => onChangeText(field, text)}
        keyboardType={keyboardType as any}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor={colors.mutedText}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 0,
    backgroundColor: '#ffffff',
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
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
  menuButton: {
    padding: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  saveButton: {
    backgroundColor: "#3b82f6",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#e5e7eb",
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  profileImageSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 16,
  },
  editImageButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#3b82f6",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  nameContainer: {
    alignItems: "center",
  },
  employeeName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  employeePosition: {
    fontSize: 14,
    color: "#6b7280",
  },
  section: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  desktopSection: {
    marginHorizontal: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  sectionContent: {
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  infoLabelText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
    textAlign: "right",
  },
  editableInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  editInput: {
    flex: 1,
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    fontSize: 14,
    color: "#1f2937",
    backgroundColor: "#f9fafb",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  desktopScrollContent: {
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  modalContainer: {
    marginTop: 60,
    marginRight: 16,
  },
  desktopModalContainer: {
    marginRight: 32,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  desktopModalContent: {
    minWidth: 250,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: "#334155",
    fontWeight: "500",
  },
  logoutMenuItem: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  logoutText: {
    color: "#ef4444",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    textAlign: "center",
  },
  additionalDayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  additionalDayType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  additionalDayTime: {
    fontSize: 13,
    color: "#475569",
  },
  noAttendanceText: {
    color: "#64748b",
    fontSize: 14,
    paddingVertical: 6,
  },
});

export default Employee;


