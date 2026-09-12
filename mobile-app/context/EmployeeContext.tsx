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

interface EmployeeContextType {
  employee: Employee | null;
  authReady: boolean;
  setEmployee: (emp: Employee | null) => Promise<void>;
  logout: () => Promise<void>;
}

export const EmployeeContext = createContext<EmployeeContextType>({
  employee: null,
  authReady: false,
  setEmployee: async () => {},
  logout: async () => {},
});

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employee, setEmployeeState] = useState<Employee | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const [storedEmployee] = await AsyncStorage.multiGet(['employee']);
        const employeeRaw = storedEmployee?.[1];

        if (employeeRaw) {
          setEmployeeState(JSON.parse(employeeRaw));
        } else {
          setEmployeeState(null);
        }
        await AsyncStorage.multiRemove(['adminClient', 'sessionType']);
      } finally {
        setAuthReady(true);
      }
    };
    loadSession();
  }, []);

  const setEmployee = useCallback(async (emp: Employee | null) => {
    if (emp) {
      await AsyncStorage.setItem('employee', JSON.stringify(emp));
    } else {
      await AsyncStorage.removeItem('employee');
    }
    setEmployeeState(emp);
  }, []);

  const logout = useCallback(async () => {
    setEmployeeState(null);
    try {
      await AsyncStorage.multiRemove(['employee', 'adminClient', 'sessionType', 'employeeCredentials']);
    } catch (error) {
      console.warn('Failed to clear auth storage on logout:', error);
    }
  }, []);

  const contextValue = useMemo(
    () => ({ employee, authReady, setEmployee, logout }),
    [employee, authReady, setEmployee, logout]
  );

  return (
    <EmployeeContext.Provider value={contextValue}>
      {children}
    </EmployeeContext.Provider>
  );
};
