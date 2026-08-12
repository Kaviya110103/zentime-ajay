import React, { useContext, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, ImageBackground } from 'react-native';
import { AppText as Text } from '../components/AppTypography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Feather,
  MaterialCommunityIcons,
  MaterialIcons,
} from '@expo/vector-icons';

import AttendanceActivity from '../components/AttendanceActivity';
import EmployeeInfo from '../components/EmployeeInfo';
import Clockrow from '../components/ClockRow';
import Testback from '../components/Testback';
import { EmployeeContext } from '../context/EmployeeContext';
import BottomNavBar from '../components/BottomNavBar';
import { router } from 'expo-router';
import { useAppTheme } from '../context/AppThemeContext';

const MarkAttendance = () => {
  const { employee } = useContext(EmployeeContext);
  const { isDark, colors } = useAppTheme();
  const employeeId = employee?.id;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!employeeId) {
      router.replace('/EmployeeLogin');
    }
  }, [employeeId]);

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: 90 + Math.max(insets.bottom, 8) },
        ]}
      >
        <ImageBackground
          source={require('../assets/images/bg.png')}
          style={styles.timeCard}
          imageStyle={{ borderRadius: 0 }}
        >
          <View style={styles.Empinfo}>
            <EmployeeInfo employeeId={employeeId} />
          </View>

          <View>
            {employeeId ? (
              <Testback />
            ) : (
              <Text style={{ color: 'red' }}>Employee not logged in</Text>
            )}
          </View>

          <Clockrow employeeId={employeeId} />

          <View style={[styles.botoombox, { backgroundColor: colors.surface }]}>
            <View style={[styles.gridIcons, { backgroundColor: colors.surface }]}>
              {[
                [MaterialIcons, 'home', 'Status', '#FF6B6B'],
                [Feather, 'calendar', 'Calendar', '#4ECDC4'],
                [MaterialIcons, 'campaign', 'Announcement', '#45B7D1'],
                [MaterialCommunityIcons, 'file-document-outline', 'Report', '#A78BFA'],
              ].map(([Icon, iconName, label, iconColor], index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.iconItem}
                  onPress={() => {
                    if (label === 'Calendar') {
                      router.push({
                        pathname: '/EmployeeCalendar',
                        params: { employeeId: employeeId.toString() }
                      });
                    } else if (label === 'Status') {
                      router.push({
                        pathname: '/EmployeeLeavePermission',
                        params: { employeeId: String(employeeId) },
                      });
                    } else if (label === 'Report') {
                      router.push({
                        pathname: '/Calendarprinting',
                        params: { employeeId: employeeId.toString() }
                      });
                    } else if (label === 'Announcement') {
                      router.push('/AllAnnouncements');
                    } else {
                      console.log(label + ' pressed');
                    }
                  }}
                >
                  <View style={[styles.iconWrap, isDark && { backgroundColor: '#1f2937' }]}>
                    {React.createElement(Icon as React.ComponentType<any>, {
                      name: iconName,
                      size: 22,
                      color: iconColor,
                    })}
                  </View>
                  <Text style={[styles.iconLabel, { color: colors.text }]}>{typeof label === 'string' ? label : ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.activityContainer}>
              <AttendanceActivity employeeId={employeeId} />
            </View>
          </View>
        </ImageBackground>
      </ScrollView>
      <BottomNavBar activeTab="Home" />
    </View>
  );
};

export default MarkAttendance;

const styles = StyleSheet.create({
  mainContainer: {
    marginTop: 0,
    flex: 1,
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
  },
  container: {
    display: 'flex',
    marginTop: 0,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  timeCard: {
    borderRadius: 0,
    marginBottom: 18,
    width: '100%',
    overflow: 'hidden',
  },
  Empinfo: {
    marginTop: 25,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  clockSection: {
    marginBottom: 16,
  },
  clockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eee',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  clockInfo: {
    flex: 1,
    marginLeft: 10,
  },
  clockTitle: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  clockTime: {
    alignItems: 'flex-end',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    marginTop: 12,
  },
  navItem: {
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 10,
    color: '#333',
  },
  activeNavLabel: {
    color: 'redorange',
    fontWeight: 'bold',
  },
  gridIcons: {
    paddingHorizontal: 12,
    paddingTop: 4,
    borderBlockColor: 'blue',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 108,
  },
  iconItem: {
    width: '24%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderColor: 'transparent',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 4,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  iconLabel: {
    fontSize: 8,
    lineHeight: 10,
    color: '#333',
    marginTop: 3,
    textAlign: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
  },
  botoombox: {
    paddingVertical: 18,
    borderRadius: 20,
    minHeight: 500,
  },
  activityContainer: {
    width: '100%',
  },
});

