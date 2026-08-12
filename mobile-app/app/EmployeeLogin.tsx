import { EmployeeContext } from "../context/EmployeeContext";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, ImageBackground, Platform, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppTypography';
import { buildApiUrl } from "../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "../context/AppThemeContext";
import { notifyEmployeeLogin } from "../lib/employeeNotifications";

const WALKTHROUGH_DONE_KEY = 'walkthroughCompleted';

const EmployeeLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("#4CAF50");
  const [isLoading, setIsLoading] = useState(false);
  const [companyCode, setCompanyCode] = useState("");

  const router = useRouter();
  const { employee, setEmployee, logout } = useContext(EmployeeContext);
  const { isDark, colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const placeholderColor = isDark ? "#94a3b8" : "#999";
  const isNarrow = width < 420;
  const cardMaxWidth = width >= 1200 ? 520 : width >= 900 ? 460 : 420;

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "Exit App",
          "Are you sure you want to exit?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Exit", onPress: () => BackHandler.exitApp() },
          ],
          { cancelable: true }
        );
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => backHandler.remove();
    }, [])
  );

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const showMessage = (text: string, color: string) => {
    setMessage(text);
    setMessageColor(color);
  };

  const showWebAwareAlert = (title: string, body: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(`${title}\n\n${body}`);
      return;
    }
    Alert.alert(title, body);
  };

  const handleLogin = async (
    inputUsername?: string,
    inputPassword?: string,
    silent?: boolean
  ) => {
    const uname = inputUsername ?? username;
    const pwd = inputPassword ?? password;
    const normalizedCompanyCode = companyCode.trim().toLowerCase();

    if (!uname.trim() || !pwd.trim()) {
      if (!silent) {
        showMessage("Please enter both username and password.", "#DC2626");
        showWebAwareAlert("Error", "Please enter both username and password");
      }
      return;
    }

    if (!normalizedCompanyCode) {
      if (!silent) {
        showMessage("Please enter company code.", "#DC2626");
        showWebAwareAlert("Error", "Please enter company code");
      }
      return;
    }

    setIsLoading(true);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let loginUrl = "";
    try {
      const pushToken = await AsyncStorage.getItem("expoPushToken");
      loginUrl = buildApiUrl(`/api/employees/login`);
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000);
      console.log("[EmployeeLogin] POST", loginUrl);
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: uname.trim(),
          password: pwd,
          companyCode: normalizedCompanyCode,
          pushToken: pushToken || undefined,
        }),
        signal: controller.signal,
      });
      console.log("[EmployeeLogin] Response", response.status);

      const rawText = await response.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (response.ok) {
        if (data && data.id) {
          await AsyncStorage.setItem(WALKTHROUGH_DONE_KEY, 'true');
          await setEmployee(data);
          await notifyEmployeeLogin(data);
          showMessage("Login successful!", "#16A34A");
          router.replace("/WelcomeBack");
        } else {
          if (!silent) showInvalidCredentialsAlert();
        }
      } else {
        if (!silent) {
          if (response.status === 401) {
            showInvalidCredentialsAlert();
          } else {
            const backendMessage =
              (data && (data.error || data.message)) ||
              `Login failed (HTTP ${response.status})`;
            showMessage(String(backendMessage), "#DC2626");
            showWebAwareAlert("Login Failed", String(backendMessage));
          }
        }
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[EmployeeLogin] Request failed", { loginUrl, detail, err });
      if (!silent) {
        const networkMessage = `Could not reach the login server.\n${loginUrl}\n\n${detail}`;
        showMessage("Could not reach the login server.", "#DC2626");
        showWebAwareAlert("Network error", networkMessage);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const showInvalidCredentialsAlert = () => {
    showMessage("Invalid username or password. Please try again.", "#DC2626");
    showWebAwareAlert(
      "Invalid Credentials",
      "The username or password you entered is incorrect. Please try again."
    );
    setPassword("");
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleLogout = async () => {
    await logout();
    setUsername("");
    setPassword("");
    setMessage("");
  };

  const handleOpenAdminLogin = () => {
    router.push("/AdminLogin");
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../assets/images/bg1.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={[styles.overlay, isDark && styles.darkOverlay]}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.formShell, { maxWidth: cardMaxWidth }]}>
            <Text style={[styles.heading, isNarrow && styles.headingSmall]}>Employee Login</Text>
            {employee ? (
              <View style={[styles.welcomeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome back,</Text>
                <Text style={[styles.welcomeName, { color: colors.primary }]}>
                  {employee.name || employee.username || "Employee"}
                </Text>
                <TouchableOpacity
                  style={[styles.loginButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.replace("/MarkAttendance")}
                >
                  <Text style={styles.buttonText}>Go to Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.primary }]} onPress={handleLogout}>
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Logout</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.primary }]} onPress={handleOpenAdminLogin}>
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Login as Admin</Text>
                </TouchableOpacity>
                {message ? (
                  <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
                ) : null}
              </View>
            ) : (
              <View style={[styles.loginBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.mutedText }]}>Username*</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#fff", color: colors.text }]}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Enter your username"
                  placeholderTextColor={placeholderColor}
                />

                <Text style={[styles.label, { color: colors.mutedText }]}>Password*</Text>
                <View style={[styles.passwordContainer, { borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#fff" }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: colors.text }]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    placeholder="Enter your password"
                    placeholderTextColor={placeholderColor}
                  />
                  <TouchableOpacity
                    style={styles.showPasswordButton}
                    onPress={toggleShowPassword}
                  >
                    <Text style={[styles.showPasswordText, { color: colors.primary }]}>
                      {showPassword ? "Hide" : "Show"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.label, { color: colors.mutedText }]}>Company Code*</Text>
                <View style={[styles.passwordContainer, { borderColor: colors.border, backgroundColor: isDark ? "#0f172a" : "#fff" }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: colors.text }]}
                    value={companyCode}
                    onChangeText={setCompanyCode}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Enter your company code"
                    placeholderTextColor={placeholderColor}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.loginButton, { backgroundColor: colors.primary }, isLoading && { opacity: 0.7 }]}
                  onPress={() => handleLogin()}
                  disabled={isLoading}
                >
                  <Text style={styles.buttonText}>LOGIN</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.primary }]} onPress={handleOpenAdminLogin}>
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Login as Admin</Text>
                </TouchableOpacity>

                {message ? (
                  <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
                ) : null}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 18, 36, 0.56)",
  },
  darkOverlay: {
    backgroundColor: "rgba(2, 6, 23, 0.72)",
  },
  whiteBackground: {
    backgroundColor: "transparent",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: "center",
  },
  formShell: {
    width: "100%",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  heading: {
    fontSize: 28,
    color: "#ffffff",
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  headingSmall: {
    fontSize: 24,
  },
  loginBox: {
    backgroundColor: "#ffffff",
    padding: 22,
    borderRadius: 20,
    width: "100%",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 4,
  },
  welcomeBox: {
    backgroundColor: "#f9f9f9",
    padding: 24,
    width: "100%",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 4,
  },
  welcomeText: {
    fontSize: 22,
    color: "#333",
    marginBottom: 10,
    fontWeight: "600",
  },
  welcomeName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#8f40d1ff",
    marginBottom: 30,
    textAlign: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: "#7c25c4ff",
    padding: 14,
    borderRadius: 13,
    width: "100%",
    alignItems: "center",
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    color: "white",
  },
  secondaryButton: {
    padding: 14,
    borderRadius: 13,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#7c25c4ff",
    marginBottom: 15,
  },
  secondaryButtonText: {
    color: "#7c25c4ff",
    fontSize: 16,
    fontWeight: "500",
  },
  label: {
    color: "#555",
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "500",
  },
  input: {
    width: "100%",
    padding: 12,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 15,
    marginBottom: 16,
    backgroundColor: "#fff",
    color: "#333",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: "#333",
  },
  showPasswordButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  showPasswordText: {
    fontSize: 14,
    color: "#2a52be",
    fontWeight: "500",
  },
  message: {
    textAlign: "center",
    marginTop: 2,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default EmployeeLogin;

