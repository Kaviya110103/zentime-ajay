import React, { useContext } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, ImageBackground, useWindowDimensions } from 'react-native';
import { AppText as Text } from '../components/AppTypography';
import { router } from "expo-router";
import { EmployeeContext } from "../context/EmployeeContext";
import { useAppTheme } from "../context/AppThemeContext";

export default function WelcomeBack() {
  const { employee, logout } = useContext(EmployeeContext);
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isNarrow = width < 420;
  const cardMaxWidth = width >= 1200 ? 500 : width >= 900 ? 440 : 380;

  if (!employee) {
    router.replace("/EmployeeLogin");
    return null;
  }

  const displayName =
    [employee.firstName ? String(employee.firstName) : "", employee.lastName ? String(employee.lastName) : ""]
      .join(" ")
      .trim() || employee.username || "Employee";

  const handleGoDashboard = () => {
    router.replace("/MarkAttendance");
  };

  const handleNotYou = async () => {
    await logout();
    router.replace("/EmployeeLogin");
  };

  return (
    <ImageBackground
      source={require("../assets/images/bg1.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={[styles.welcomeBox, { maxWidth: cardMaxWidth, backgroundColor: colors.surface }]}>
            <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome back,</Text>
            <Text style={[styles.welcomeName, { color: colors.primary }, isNarrow && styles.welcomeNameSmall]}>{displayName}!</Text>

            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: colors.primary }]}
              onPress={handleGoDashboard}
            >
              <Text style={styles.buttonText}>Go to Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.primary }]}
              onPress={handleNotYou}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Not you? Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 18, 36, 0.56)",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  welcomeBox: {
    backgroundColor: "#f9f9f9",
    padding: 24,
    width: "100%",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 4,
  },
  welcomeText: {
    fontSize: 20,
    color: "#333",
    marginBottom: 8,
    fontWeight: "600",
  },
  welcomeName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#8f40d1ff",
    marginBottom: 26,
    textAlign: "center",
  },
  welcomeNameSmall: {
    fontSize: 23,
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
    fontWeight: "bold",
    fontSize: 16,
  },
});

