import React, { useContext, useRef, useState } from "react";
import { Alert, ImageBackground, Platform, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppTypography';
import { useRouter } from "expo-router";
import { buildApiUrl } from "../lib/api";
import { EmployeeContext } from "../context/EmployeeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppTheme } from "../context/AppThemeContext";

const WALKTHROUGH_DONE_KEY = 'walkthroughCompleted';

export default function AdminLogin() {
  const router = useRouter();
  const { setAdminClient } = useContext(EmployeeContext);
  const { isDark, colors } = useAppTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("#DC2626");
  const { width } = useWindowDimensions();
  const placeholderColor = isDark ? "#94a3b8" : "#999";
  const isNarrow = width < 420;
  const cardMaxWidth = width >= 1200 ? 500 : width >= 900 ? 460 : 420;

  const showWebAwareAlert = (title: string, body: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(`${title}\n\n${body}`);
      return;
    }
    Alert.alert(title, body);
  };

  const handleLogin = async () => {
    if (submitLockRef.current) {
      return;
    }

    if (!username.trim() || !password.trim()) {
      setMessageColor("#DC2626");
      setMessage("Please enter username and password.");
      showWebAwareAlert("Missing fields", "Please enter username and password.");
      return;
    }

    console.time("admin-login-total");
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let loginUrl = "";
    let loginApiTimerActive = false;
    try {
      submitLockRef.current = true;
      setIsSubmitting(true);
      setMessage("");
      loginUrl = buildApiUrl("/api/clients/login");
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000);
      console.log("[AdminLogin] POST", loginUrl);
      console.time("login-api");
      loginApiTimerActive = true;
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
        signal: controller.signal,
      });
      console.timeEnd("login-api");
      loginApiTimerActive = false;
      console.log("[AdminLogin] Response", response.status);

      if (!response.ok) {
        const failureMessage =
          response.status === 401
            ? "Invalid admin credentials."
            : `Login server rejected the request (HTTP ${response.status}).`;
        setMessageColor("#DC2626");
        setMessage(failureMessage);
        showWebAwareAlert("Login failed", failureMessage);
        return;
      }

      const data = await response.json();
      if (!data?.id) {
        const failureMessage = "Login server returned an invalid admin session.";
        setMessageColor("#DC2626");
        setMessage(failureMessage);
        showWebAwareAlert("Login failed", failureMessage);
        return;
      }

      console.time("admin-session-storage");
      setAdminClient(data)
        .catch((storageError) => {
          console.warn("[AdminLogin] Failed to persist admin session", storageError);
        })
        .finally(() => {
          console.timeEnd("admin-session-storage");
        });

      console.time("walkthrough-storage");
      AsyncStorage.setItem(WALKTHROUGH_DONE_KEY, 'true').catch((storageError) => {
        console.warn("[AdminLogin] Failed to persist walkthrough state", storageError);
      }).finally(() => {
        console.timeEnd("walkthrough-storage");
      });
      setMessageColor("#16A34A");
      setMessage("Login successful!");
      console.time("navigation");
      router.replace("/AdminDashboard");
    } catch (error) {
      if (loginApiTimerActive) {
        console.timeEnd("login-api");
      }
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[AdminLogin] Request failed", { loginUrl, detail, error });
      const isTimeout = error instanceof Error && error.name === "AbortError";
      const networkMessage = isTimeout
        ? `Login request timed out.\n${loginUrl}\n\nPlease check your internet connection and try again.`
        : `Could not reach the login server.\n${loginUrl}\n\n${detail}`;
      setMessageColor("#DC2626");
      setMessage(isTimeout ? "Login request timed out." : "Could not reach the login server.");
      showWebAwareAlert(isTimeout ? "Login timeout" : "Network error", networkMessage);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      submitLockRef.current = false;
      setIsSubmitting(false);
      console.timeEnd("admin-login-total");
    }
  };

  return (
    <ImageBackground
      source={require("../assets/images/bg1.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={[styles.shell, { maxWidth: cardMaxWidth }]}>
            <Text style={[styles.heading, isNarrow && styles.headingSmall]}>Admin Login</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.label, { color: colors.mutedText }]}>Username*</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: isDark ? "#0f172a" : "#fff",
                  color: colors.text,
                },
              ]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter admin username"
              placeholderTextColor={placeholderColor}
            />

            <Text style={[styles.label, { color: colors.mutedText }]}>Password*</Text>
            <View
              style={[
                styles.passwordContainer,
                {
                  borderColor: colors.border,
                  backgroundColor: isDark ? "#0f172a" : "#fff",
                },
              ]}
            >
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                placeholder="Enter password"
                placeholderTextColor={placeholderColor}
              />
              <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                <Text style={[styles.showText, { color: colors.primary }]}>{showPassword ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
                isSubmitting && styles.disabledButton,
              ]}
              disabled={isSubmitting}
              onPress={handleLogin}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? "Logging in..." : "Login"}
              </Text>
            </TouchableOpacity>
            {message ? (
              <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.primary }]}
              onPress={() => router.replace("/EmployeeLogin")}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Back to Employee Login</Text>
            </TouchableOpacity>
          </View>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 18, 36, 0.56)",
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: "center",
  },
  shell: {
    width: "100%",
  },
  heading: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  headingSmall: {
    fontSize: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 4,
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 15,
  },
  passwordContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  showText: {
    color: "#351153",
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#351153",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  message: {
    textAlign: "center",
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#351153",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryButtonText: {
    color: "#351153",
    fontWeight: "600",
  },
});

