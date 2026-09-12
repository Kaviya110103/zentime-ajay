// import { Feather } from '@expo/vector-icons';
// import axios from 'axios';
// import { useRouter } from 'expo-router';
// import React, { ReactNode, useEffect, useState } from 'react';
// import {
//   ActivityIndicator,
//   Image,
//   Pressable,
//   StyleSheet,
//   Text,
//   View,
// } from 'react-native';
// import * as Notifications from 'expo-notifications';
// import { useNotificationSetup } from '../useNotificationSetup'; // ✅ make sure the path is correct

// interface Employee {
//   position: ReactNode;
//   id: number;
//   username: string;
//   profileImage?: string;
// }

// type EmployeeInfoProps = {
//   employeeId: string;
// };

// const EmployeeInfo: React.FC<EmployeeInfoProps> = ({ employeeId }) => {
//   const [employee, setEmployee] = useState<Employee | null>(null);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [currentTime, setCurrentTime] = useState<string>('');
//   const [currentDate, setCurrentDate] = useState<string>('');
//   const [formattedDate, setFormattedDate] = useState<string>('');
//   const [attendanceStatus, setAttendanceStatus] = useState<string>('');
//   const [showNotification, setShowNotification] = useState<boolean>(false);
//   const router = useRouter();

// const expoPushToken = useNotificationSetup(); // ✅ gets the token

//   const showNotificationLocal = async (title: string, message: string) => {
//     await Notifications.scheduleNotificationAsync({
//       content: { title, body: message },
//       trigger: null,
//     });
//   };
// const sendPushNotification = async (title: string, message: string) => {
//   if (!expoPushToken) {
//     console.log('Expo Push Token not ready');
//     return;
//   }

//   await fetch('https://exp.host/--/api/v2/push/send', {
//     method: 'POST',
//     headers: {
//       Accept: 'application/json',
//       'Accept-encoding': 'gzip, deflate',
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({
//       to: expoPushToken,
//       title,
//       body: message,
//       sound: 'default',
//     }),
//   });
// };
// useEffect(() => {
//   const subscription = Notifications.addNotificationResponseReceivedListener(response => {
//     console.log('🔔 Notification tapped:', response);
//     // Optional: router.push('/MarkAttendance')
//   });

//   return () => subscription.remove();
// }, []);

//   useEffect(() => {
//     const fetchEmployee = async () => {
//       try {
//         const res = await axios.get<Employee>(buildApiUrl(`/api/employees/${employeeId}`));
//         setEmployee(res.data);
//       } catch (err) {
//         console.error('Failed to load employee:', err);
//         setEmployee(null);
//       } finally {
//         setLoading(false);
//       }
//     };

//     if (employeeId) fetchEmployee();
//   }, [employeeId]);

//   useEffect(() => {
//     const updateTime = () => {
//       const now = new Date();
//       const timeStr = now.toLocaleTimeString([], {
//         hour: '2-digit',
//         minute: '2-digit',
//       });
//       const dateStr = now.toLocaleDateString(undefined, {
//         weekday: 'long',
//         day: '2-digit',
//         month: 'long',
//         year: 'numeric',
//       });

//       const dd = String(now.getDate()).padStart(2, '0');
//       const mm = String(now.getMonth() + 1).padStart(2, '0');
//       const yyyy = now.getFullYear();
//       const formatted = `${dd}/${mm}/${yyyy}`;

//       setCurrentTime(timeStr);
//       setCurrentDate(dateStr);
//       setFormattedDate(formatted);
//     };

//     updateTime();
//     const interval = setInterval(updateTime, 1000);
//     return () => clearInterval(interval);
//   }, []);

//   useEffect(() => {
//     const checkAttendanceStatus = async () => {
//       try {
//         const response = await axios.get(buildApiUrl(`/api/attendance-records/check-today-attendance`));
//         const status = response.data;
//         setAttendanceStatus(status);
//         setShowNotification(status !== "Attendance complete for today.");

//         if (status.includes("Time-Out not posted")) {
//           await showNotificationLocal("Time-Out Reminder", "Please complete your Time-Out for today!");
//         }
//       } catch (error) {
//         console.error('Error checking attendance:', error);
//         setAttendanceStatus('Error checking attendance');
//         setShowNotification(true);
//         await showNotificationLocal("Error", "Failed to check attendance status.");
//       }
//     };

//     checkAttendanceStatus();
//     const interval = setInterval(checkAttendanceStatus, 300000);
//     return () => clearInterval(interval);
//   }, [employeeId]);

// const handleBellPress = async () => {
//   try {
//     const response = await axios.get(buildApiUrl(`/api/attendance-records/check-today-attendance`));
//     const status = response.data;

//     if (status === "Attendance complete for today.") {
//       await showNotificationLocal("Attendance", "Your attendance is complete for today.");
//       await sendPushNotification("Attendance", "Your attendance is complete for today.");
//       setShowNotification(false);
//     } else {
//       await showNotificationLocal("Incomplete Attendance", status);
//       await sendPushNotification("Time-Out Reminder", status);
//       setShowNotification(true);
//     }
//   } catch (error) {
//     console.error('Error checking attendance:', error);
//     await showNotificationLocal("Error", "Failed to check attendance status");
//     await sendPushNotification("Error", "Failed to check attendance status");
//   }
// };

//   if (loading) return <ActivityIndicator size="large" color="blue" />;
//   if (!employee) return <Text style={styles.noData}>No employee data found.</Text>;

//   const profileImageSource = employee.profileImage
//     ? { uri: employee.profileImage }
//     : require('../assets/images/empimage.jpg');

//   return (
//     <Pressable onPress={() => router.push('/EmployeeProfile')}>
//       <View style={styles.employeeContainer}>
//         <View style={styles.employeeInfo}>
//           <Image source={profileImageSource} style={styles.profileImage} />
//           <View style={styles.employeeText}>
//             <Text style={styles.employeeName}>{employee.username}</Text>
//             <Text style={styles.employeeTitle}>{employee.position}</Text>
//           </View>
//           <Pressable onPress={handleBellPress}>
//             <View style={styles.bellWrapper}>
//               <Feather name="bell" size={24} color="white" />
//               {showNotification && <View style={styles.greenDot} />}
//             </View>
//           </Pressable>
//         </View>
//         <View style={styles.dateTime}>
//           <Text style={styles.time}>{currentTime}</Text>
//           <Text style={styles.date}>{currentDate}</Text>
//         </View>
//       </View>
//     </Pressable>
//   );
// };

// const styles = StyleSheet.create({
//   employeeContainer: { padding: 10 },
//   employeeInfo: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: 'transparent',
//     padding: 10,
//     borderRadius: 8,
//   },
//   profileImage: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     marginRight: 10,
//     backgroundColor: '#fff',
//     borderWidth: 2,
//     borderColor: '#ffffff',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//     elevation: 5,
//     overflow: 'hidden',
//   },
//   employeeText: { flex: 1 },
//   employeeName: { fontWeight: 'bold', fontSize: 18, color: 'white' },
//   employeeTitle: { fontSize: 14, color: 'white', fontWeight: '400' },
//   bellWrapper: { position: 'relative', padding: 5 },
//   greenDot: {
//     position: 'absolute',
//     top: 2,
//     right: 2,
//     width: 10,
//     height: 10,
//     borderRadius: 5,
//     backgroundColor: 'limegreen',
//   },
//   dateTime: { marginTop: 10, alignItems: 'center', backgroundColor: 'transparent' },
//   time: { fontSize: 24, fontWeight: 'bold', color: 'white' },
//   date: { fontSize: 15, color: 'white' },
//   noData: { textAlign: 'center', color: 'gray' },
// });

// export default EmployeeInfo;


import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { ReactNode, useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { AppText as Text } from './AppTypography';
import { EmployeeContext } from '../context/EmployeeContext';
import { buildApiUrl, resolveAssetUrl, withClientId } from '../lib/api';

interface Employee {
  position: ReactNode;
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  profileImage?: string;
  
}

type EmployeeInfoProps = {
  employeeId?: string | number;
};

const EmployeeInfo: React.FC<EmployeeInfoProps> = ({ employeeId }) => {
  const { employee, logout } = useContext(EmployeeContext);
  const [employees, setEmployees] = useState<Employee | null>(() => {
    if (!employee) return null;
    return {
      id: Number(employee.id),
      username: String(employee.username || employee.firstName || '').trim(),
      firstName: employee.firstName ? String(employee.firstName) : undefined,
      lastName: employee.lastName ? String(employee.lastName) : undefined,
      name: employee.name ? String(employee.name) : undefined,
      position: employee.position ? String(employee.position) : undefined,
      profileImage: employee.profileImage ? String(employee.profileImage) : undefined,
    };
  });
  const [loading, setLoading] = useState<boolean>(!employee);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [formattedDate, setFormattedDate] = useState<string>('');
  const [attendanceStatus, setAttendanceStatus] = useState<string>('');
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const drawerTranslateX = useRef(new Animated.Value(-330)).current;
  const router = useRouter();
  const companyCode = employee?.companyCode;
  const clientId = employee?.clientId;
  useEffect(() => {
    const fetchEmployee = async () => {
      if (!employeeId || !clientId) {
        setEmployees(null);
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get<Employee>(
          buildApiUrl(`/api/employees/${employeeId}`, { clientId })
        );
        setEmployees(res.data);
      } catch (err) {
        console.error('Failed to load employee:', err);
        setEmployees(null);
      } finally {
        setLoading(false);
      }
    };

    if (!employees || !employees.position || !employees.profileImage) {
      fetchEmployee();
      return;
    }

    setLoading(false);
  }, [employeeId, clientId, employees]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const dateStr = now.toLocaleDateString(undefined, {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      // Format for backend API: dd/MM/yyyy
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const formatted = `${dd}/${mm}/${yyyy}`;

      setCurrentTime(timeStr);
      setCurrentDate(dateStr);
      setFormattedDate(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkAttendanceStatus = async () => {
      if (!employeeId || !clientId) {
        setAttendanceStatus('');
        setShowNotification(false);
        return;
      }

      try {
        const response = await axios.get(
          buildApiUrl(`/api/attendance-records/check-today-attendance`),
          { params: withClientId({ employeeId }, clientId) }
        );
        const status = response.data;
        setAttendanceStatus(status);
        
        // Show notification dot if attendance is not complete
        setShowNotification(status !== "Attendance complete for today.");
      } catch (error) {
        console.error('Error checking attendance:', error);
        setAttendanceStatus('');
        setShowNotification(false);
      }
    };

    // Check every 5 minutes (300000 ms)
    checkAttendanceStatus();
    const interval = setInterval(checkAttendanceStatus, 300000);
    return () => clearInterval(interval);
  }, [employeeId, clientId]);

  const handleBellPress = async () => {
    if (!employeeId || !clientId) {
      return;
    }

    try {
      const response = await axios.get(
        buildApiUrl(`/api/attendance-records/check-today-attendance`),
        { params: withClientId({ employeeId }, clientId) }
      );
      const status = response.data;
      
      if (status === "Attendance complete for today.") {
        Alert.alert('Attendance Status', 'Your attendance is complete for today!');
        setShowNotification(false);
      } else {
        Alert.alert('Attendance Status', status);
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Error checking attendance:', error);
      Alert.alert('Error', 'Failed to check attendance status');
    }
  };

  const closeMenu = () => setMenuVisible(false);

  useEffect(() => {
    if (menuVisible) {
      drawerTranslateX.setValue(-330);
      Animated.timing(drawerTranslateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [drawerTranslateX, menuVisible]);

  const navigateFromMenu = (
    path:
      | '/EmployeeProfile'
      | '/Calendarprinting'
      | '/EmployeeCalendar'
      | '/LeavePermission'
      | '/EmployeePermission'
      | '/SwapWeekoff'
      | '/EmployeeSupportRequest'
  ) => {
    closeMenu();
    if ((path === '/LeavePermission' || path === '/EmployeePermission') && employeeId) {
      router.push({ pathname: path, params: { employeeId: String(employeeId) } });
      return;
    }
    router.push(path);
  };

  const handleLogout = async () => {
    closeMenu();
    await logout();
    router.replace('/EmployeeLogin');
  };

  if (loading) return <ActivityIndicator size="large" color="blue" />;
  if (!employees)
    return <Text style={styles.noData}>No employee data found.</Text>;

  const profileImageSource = employees.profileImage
    ? { uri: resolveAssetUrl(employees.profileImage) }
    : require('../assets/images/empimage.jpg');
  const employeeDisplayName =
    [employees.firstName, employees.lastName]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ') ||
    String(employees.name || '').trim() ||
    employees.username;

  return (
    <>
      <View style={styles.employeeContainer}>
        <View style={styles.employeeInfo}>
          <Pressable
            style={styles.menuButton}
            onPress={(event) => {
              event.stopPropagation();
              setMenuVisible(true);
            }}
          >
            <Feather name="menu" size={24} color="white" />
          </Pressable>
          <View style={styles.employeeText}>
            <Text style={styles.employeeName}>Hello {employeeDisplayName}</Text>
            <Text style={styles.employeeTitle}>{employees.position}</Text>
          </View>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              handleBellPress();
            }}
          >
            <View style={styles.bellWrapper}>
              <Feather name="bell" size={24} color="white" />
              {showNotification && (
                <View style={styles.greenDot} />
              )}
            </View>
          </Pressable>
        </View>

        <View style={styles.dateTime}>
          <Text style={styles.time}>{currentTime}</Text>
          <Text style={styles.date}>{currentDate}</Text>
        </View>
      </View>
    <Modal
      visible={menuVisible}
      transparent
      animationType="none"
      onRequestClose={closeMenu}
    >
      <Pressable style={styles.menuOverlay} onPress={closeMenu}>
        <Animated.View style={[styles.sideNav, { transform: [{ translateX: drawerTranslateX }] }]}>
        <Pressable style={styles.sideNavInner} onPress={() => {}}>
          <View style={styles.sideNavHeader}>
            <TouchableOpacity
              style={styles.sideNavAvatar}
              onPress={() => navigateFromMenu('/EmployeeProfile')}
            >
              <Image source={profileImageSource} style={styles.sideNavAvatarImage} />
            </TouchableOpacity>
            <View style={styles.sideNavEmployee}>
              <Text style={styles.sideNavName}>{employeeDisplayName}</Text>
              <Text style={styles.sideNavRole}>{employees.position}</Text>
            </View>
            <TouchableOpacity style={styles.sideNavClose} onPress={closeMenu}>
              <Feather name="x" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.sideNavContent}>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigateFromMenu('/LeavePermission')}>
            <View style={styles.menuIconBox}>
              <Feather name="file-text" size={17} color="#351153" />
            </View>
            <Text style={styles.menuItemText}>Apply Leave</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigateFromMenu('/EmployeePermission')}>
            <View style={styles.menuIconBox}>
              <Feather name="clock" size={17} color="#351153" />
            </View>
            <Text style={styles.menuItemText}>Apply Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigateFromMenu('/Calendarprinting')}>
            <View style={styles.menuIconBox}>
              <Feather name="bar-chart-2" size={17} color="#351153" />
            </View>
            <Text style={styles.menuItemText}>Monthly Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigateFromMenu('/SwapWeekoff')}>
            <View style={styles.menuIconBox}>
              <Feather name="refresh-cw" size={17} color="#351153" />
            </View>
            <Text style={styles.menuItemText}>Swap Weekoff</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigateFromMenu('/EmployeeSupportRequest')}>
            <View style={styles.menuIconBox}>
              <Feather name="message-circle" size={17} color="#351153" />
            </View>
            <Text style={styles.menuItemText}>Support Request</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, styles.logoutMenuItem]} onPress={handleLogout}>
            <View style={[styles.menuIconBox, styles.logoutIconBox]}>
              <Feather name="log-out" size={17} color="#DC2626" />
            </View>
            <Text style={[styles.menuItemText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
          </View>
        </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  employeeContainer: {
    padding: 10,
  },
  employeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 10,
    borderRadius: 8,
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  employeeText: {
    flex: 1,
  },
  employeeName: {
    fontWeight: 'bold',
    fontSize: 18,
    color: 'white',
  },
  employeeTitle: {
    fontSize: 14,
    color: 'white',
    fontWeight: '400',
  },
  bellWrapper: {
    position: 'relative',
    padding: 5,
  },
  greenDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'limegreen',
  },
  dateTime: {
    marginTop: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  time: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  date: {
    fontSize: 15,
    color: 'white',
  },
  noData: {
    textAlign: 'center',
    color: 'gray',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sideNav: {
    width: '72%',
    maxWidth: 310,
    height: '100%',
  },
  sideNavInner: {
    flex: 1,
    backgroundColor: '#351153',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 16,
  },
  sideNavHeader: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideNavAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sideNavAvatarImage: {
    width: '100%',
    height: '100%',
  },
  sideNavEmployee: {
    flex: 1,
    marginLeft: 12,
  },
  sideNavName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sideNavRole: {
    color: '#E9D5FF',
    fontSize: 13,
    marginTop: 3,
  },
  sideNavClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  sideNavContent: {
    flex: 1,
    backgroundColor: '#351153',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 11,
    borderRadius: 12,
    marginBottom: 7,
    backgroundColor: '#351153',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1E7FF',
    marginRight: 10,
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutMenuItem: {
    marginTop: 10,
    backgroundColor: '#351153',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  logoutIconBox: {
    backgroundColor: '#FEE2E2',
  },
  logoutText: {
    color: '#DC2626',
  },
});

export default EmployeeInfo;
