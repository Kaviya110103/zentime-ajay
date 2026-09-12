import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppTypography';
import { useAdminSession } from '../context/AdminSessionContext';
import { useAppTheme } from '../context/AppThemeContext';
import { adminRequest, API_BASE_URL } from '../lib/adminApi';

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function AdminLogin() {
  const router = useRouter();
  const { setAdminSession } = useAdminSession();
  const { colors, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const cardMaxWidth = width >= 900 ? 460 : 420;
  const placeholderColor = isDark ? '#94a3b8' : '#9ca3af';

  const handleLogin = async () => {
    if (loading) return;
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setMessage('Please enter username and password.');
      return;
    }

    setLoading(true);
    setMessage('Connecting to server...');

    try {
      const data = await adminRequest<any>('/api/clients/login', {
        method: 'POST',
        body: { username: cleanUsername, password: cleanPassword },
        timeoutMs: 10000,
      });

      const clientId = Number(data?.id);
      if (!Number.isFinite(clientId) || clientId <= 0) {
        throw new Error('Invalid admin login response.');
      }

      await setAdminSession({
        id: clientId,
        username: data?.username || cleanUsername,
        clientName: data?.clientName,
        companyName: data?.companyName,
        companyCode: data?.companyCode,
        employeeCount: data?.employeeCount,
        loggedInAt: new Date().toISOString(),
      });
      await AsyncStorage.removeItem('employee');
      setMessage('');
      router.replace('/AdminDashboard');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const safeMessage =
        /network request failed/i.test(detail)
          ? `Unable to reach TEST backend: ${API_BASE_URL}`
          : detail || 'Admin login failed. Please try again.';
      setMessage(safeMessage);
      showAlert('Admin Login Failed', safeMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground source={require('../assets/images/bg1.png')} style={styles.background} resizeMode="cover">
      <View style={[styles.overlay, isDark && styles.darkOverlay]}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={[styles.formShell, { maxWidth: cardMaxWidth }]}>
            <Text style={styles.heading}>Admin Login</Text>
            <View style={[styles.loginBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.mutedText }]}>Username*</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                placeholder="Enter admin username"
                placeholderTextColor={placeholderColor}
              />

              <Text style={[styles.label, { color: colors.mutedText }]}>Password*</Text>
              <View style={[styles.passwordContainer, { borderColor: colors.border }]}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.passwordInput, { color: colors.text }]}
                  placeholder="Enter password"
                  placeholderTextColor={placeholderColor}
                />
                <TouchableOpacity onPress={() => setShowPassword((value) => !value)} style={styles.showButton}>
                  <Text style={[styles.showText, { color: colors.primary }]}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              {message ? (
                <Text style={[styles.message, { color: message === 'Connecting to server...' ? colors.mutedText : '#dc2626' }]}>
                  {message}
                </Text>
              ) : null}

              <TouchableOpacity
                disabled={loading}
                onPress={handleLogin}
                style={[styles.loginButton, { backgroundColor: colors.primary }, loading && styles.disabledButton]}
              >
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Login</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                disabled={loading}
                onPress={() => router.replace('/EmployeeLogin')}
                style={[styles.secondaryButton, { borderColor: colors.primary }]}
              >
                <Text style={[styles.secondaryText, { color: colors.primary }]}>Back to Employee Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(10, 18, 36, 0.56)' },
  darkOverlay: { backgroundColor: 'rgba(2, 6, 23, 0.72)' },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
    alignItems: 'center',
  },
  formShell: { width: '100%' },
  heading: {
    fontSize: 28,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  loginBox: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 4,
  },
  label: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  input: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 14,
  },
  passwordInput: { flex: 1, padding: 12, fontSize: 15 },
  showButton: { paddingHorizontal: 12, paddingVertical: 10 },
  showText: { fontSize: 14, fontWeight: 'bold' },
  message: { marginBottom: 12, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  loginButton: {
    padding: 15,
    borderRadius: 13,
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  disabledButton: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  secondaryButton: {
    padding: 14,
    borderRadius: 13,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryText: { fontSize: 15, fontWeight: 'bold' },
});
