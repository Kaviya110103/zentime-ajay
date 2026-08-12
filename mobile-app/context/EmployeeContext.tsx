import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Employee {
  username: string | undefined;
  weekOff: string;
  salary: number;
  dateOfJoining: string | number;
  address: string | number;
  gender: string | number;
  dob: string | number;
  alternativeMobile: string | number;
  mobile: string | number;
  profileImage: string;
  branch: string;
  position: string;
  lastName: ReactNode;
  firstName: ReactNode;
  email: string | number;
  id: string;
  name?: string;
  clientId?: number;
  clientEmployeeId?: number;
  companyCode?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
}

interface AdminClient {
  id: number;
  username?: string;
  clientName?: string;
  companyName?: string;
  companyCode?: string;
  employeeCount?: number;
  emailAddress?: string;
  mobileNumber?: string;
  provisioningStatus?: string;
}

interface EmployeeContextType {
  employee: Employee | null;
  adminClient: AdminClient | null;
  sessionType: 'employee' | 'admin' | null;
  authReady: boolean;
  setEmployee: (emp: Employee | null) => Promise<void>;
  setAdminClient: (admin: AdminClient | null) => Promise<void>;
  logout: () => Promise<void>;
}

export const EmployeeContext = createContext<EmployeeContextType>({
  employee: null,
  adminClient: null,
  sessionType: null,
  authReady: false,
  setEmployee: async () => {},
  setAdminClient: async () => {},
  logout: async () => {},
});

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employee, setEmployeeState] = useState<Employee | null>(null);
  const [adminClient, setAdminClientState] = useState<AdminClient | null>(null);
  const [sessionType, setSessionType] = useState<'employee' | 'admin' | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const [storedEmployee, storedAdminClient, storedSessionType] = await AsyncStorage.multiGet([
          'employee',
          'adminClient',
          'sessionType',
        ]);
        const employeeRaw = storedEmployee?.[1];
        const adminRaw = storedAdminClient?.[1];
        const storedType = storedSessionType?.[1];

        if (storedType === 'admin' && adminRaw) {
          setAdminClientState(JSON.parse(adminRaw));
          setEmployeeState(null);
          setSessionType('admin');
        } else if (employeeRaw) {
          setEmployeeState(JSON.parse(employeeRaw));
          setAdminClientState(null);
          setSessionType('employee');
        } else {
          setEmployeeState(null);
          setAdminClientState(null);
          setSessionType(null);
        }
      } finally {
        setAuthReady(true);
      }
    };
    loadSession();
  }, []);

  const setEmployee = useCallback(async (emp: Employee | null) => {
    if (emp) {
      await AsyncStorage.multiSet([
        ['employee', JSON.stringify(emp)],
        ['sessionType', 'employee'],
      ]);
      await AsyncStorage.removeItem('adminClient');
      setSessionType('employee');
      setAdminClientState(null);
    } else {
      await AsyncStorage.removeItem('employee');
      if (sessionType === 'employee') {
        setSessionType(null);
      }
    }
    setEmployeeState(emp);
  }, [sessionType]);

  const setAdminClient = useCallback(async (admin: AdminClient | null) => {
    if (admin) {
      setSessionType('admin');
      setEmployeeState(null);
      setAdminClientState(admin);
      try {
        await AsyncStorage.multiRemove(['employee', 'employeeCredentials']);
        await AsyncStorage.multiSet([
          ['adminClient', JSON.stringify(admin)],
          ['sessionType', 'admin'],
        ]);
      } catch (error) {
        console.warn('Failed to persist admin session:', error);
      }
    } else {
      if (sessionType === 'admin') {
        setSessionType(null);
      }
      setAdminClientState(null);
      try {
        await AsyncStorage.removeItem('adminClient');
      } catch (error) {
        console.warn('Failed to clear admin session:', error);
      }
    }
  }, [sessionType]);

  const logout = useCallback(async () => {
    setEmployeeState(null);
    setAdminClientState(null);
    setSessionType(null);
    try {
      await AsyncStorage.multiRemove(['employee', 'adminClient', 'sessionType', 'employeeCredentials']);
    } catch (error) {
      console.warn('Failed to clear auth storage on logout:', error);
    }
  }, []);

  const contextValue = useMemo(
    () => ({ employee, adminClient, sessionType, authReady, setEmployee, setAdminClient, logout }),
    [employee, adminClient, sessionType, authReady, setEmployee, setAdminClient, logout]
  );

  return (
    <EmployeeContext.Provider value={contextValue}>
      {children}
    </EmployeeContext.Provider>
  );
};
