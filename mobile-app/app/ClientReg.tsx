import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppTypography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildApiUrl } from '../lib/api';

interface FormState {
  clientName: string;
  companyName: string;
  companyCode: string;
  mobileNumber: string;
  emailAddress: string;
  address: string;
  employeeCount: string;
  registeredDate: string;
  workingHours: string;
  username: string;
  password: string;
}

export default function ClientRegistration() {
  const [form, setForm] = useState<FormState>({
    clientName: '',
    companyName: '',
    companyCode: '',
    mobileNumber: '',
    emailAddress: '',
    address: '',
    employeeCount: '',
    registeredDate: '',
    workingHours: '',
    username: '',
    password: '',
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const validateForm = (): boolean => {
    if (!form.clientName.trim()) {
      Alert.alert('Error', 'Client name is required');
      return false;
    }
    if (!form.companyName.trim()) {
      Alert.alert('Error', 'Company name is required');
      return false;
    }
    if (!form.emailAddress.trim()) {
      Alert.alert('Error', 'Email address is required');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.emailAddress)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(buildApiUrl('/api/clients-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          employeeCount: form.employeeCount ? parseInt(form.employeeCount, 10) : 0,
          registeredDate: form.registeredDate || new Date().toISOString().split('T')[0],
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Client registered successfully');
        setForm({
          clientName: '',
          companyName: '',
          companyCode: '',
          mobileNumber: '',
          emailAddress: '',
          address: '',
          employeeCount: '',
          registeredDate: '',
          workingHours: '',
          username: '',
          password: '',
        });
      } else {
        const errorText = await response.text();
        Alert.alert('Error', errorText || 'Failed to register client');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formFields = [
    { field: 'clientName', label: 'Client Name', placeholder: 'Enter client full name' },
    { field: 'companyName', label: 'Company Name', placeholder: 'Enter company name' },
    { field: 'companyCode', label: 'Company Code',  placeholder: 'Enter company code' },
    { field: 'mobileNumber', label: 'Mobile Number',  placeholder: '+1 (555) 123-4567', keyboardType: 'phone-pad' },
    { field: 'emailAddress', label: 'Email Address',  placeholder: 'client@company.com', keyboardType: 'email-address' },
    { field: 'address', label: 'Address',  placeholder: 'Enter full address', multiline: true },
    { field: 'employeeCount', label: 'Employee Count',  placeholder: 'Number of employees', keyboardType: 'numeric' },
    { field: 'registeredDate', label: 'Registered Date',  placeholder: 'YYYY-MM-DD' },
    { field: 'workingHours', label: 'Working Hours',  placeholder: '9:00 AM - 5:00 PM' },
    { field: 'username', label: 'Username',  placeholder: 'Choose a username' },
    { field: 'password', label: 'Password', placeholder: 'Create a secure password', secureTextEntry: true },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Client Registration</Text>
            <Text style={styles.subtitle}>Register a new client with complete details</Text>
          </View>

          <View style={styles.formCard}>
            {formFields.map((item, index) => (
              <View key={item.field} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{item.label}</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === item.field && styles.inputFocused,
                    item.multiline && styles.inputMultiline
                  ]}
                  value={form[item.field as keyof FormState]}
                  onChangeText={(text) => handleChange(item.field as keyof FormState, text)}
                  placeholder={item.placeholder}
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={item.secureTextEntry || false}
                  keyboardType={item.keyboardType as any}
                  multiline={item.multiline || false}
                  onFocus={() => setFocusedField(item.field)}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            ))}

            <TouchableOpacity 
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Registering...' : 'Register Client'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    backgroundColor: '#351153',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#E2D8E6',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  inputFocused: {
    borderColor: '#351153',
    backgroundColor: '#FFFFFF',
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#351153',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#6B7280',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

