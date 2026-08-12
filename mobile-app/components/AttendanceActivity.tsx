import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppTypography';
import axios from 'axios';
import { Feather } from '@expo/vector-icons';
import { EmployeeContext } from '../context/EmployeeContext';
import { buildApiUrl, withClientId } from '../lib/api';
import { useAppTheme } from '../context/AppThemeContext';

type AttendanceData = {
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  attendanceStatus?: string;
  workedHours?: number | string | null;
};

type EmployeeInfoProps = {
  employeeId?: string | number;
};

const AttendanceActivity: React.FC<EmployeeInfoProps> = ({ employeeId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendances, setAttendances] = useState<AttendanceData[]>([]);
  const { employee } = useContext(EmployeeContext);
  const { colors, isDark } = useAppTheme();
  const companyCode = employee?.companyCode;
  const clientId = employee?.clientId;

  const formatDateForApi = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!employeeId || !clientId) {
        setAttendances([]);
        setError(null);
        setLoading(false);
        return;
      }

      if (!companyCode) {
        setAttendances([]);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const today = new Date();
        const promises: Promise<AttendanceData | null>[] = [];

        // Fetch today through the previous 4 days.
        for (let i = 0; i < 5; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const formatted = formatDateForApi(d); // dd/MM/yyyy

          promises.push(
            axios
              .get<AttendanceData | null>(
                buildApiUrl('/api/attendance/getByDateAndEmployee'),
                { params: withClientId({ date: formatted, employeeId }, clientId) }
              )
              .then((res) => {
                if (!res.data || (res.data as any).found === false) return null;
                return { ...res.data, date: formatted };
              })
              .catch((err) => {
                if (err?.response?.status !== 404) {
                  console.log(`Error fetching ${formatted}:`, err.message);
                }
                return null;
              })
          );
        }

        const results = await Promise.all(promises);
        
        // Filter out null results and deduplicate
        const validResults = results.filter((result): result is AttendanceData => 
          result?.date !== undefined
        );
        
        // Sort by date (newest first)
        validResults.sort((a, b) => {
          const dateA = new Date(a.date.split('/').reverse().join('-'));
          const dateB = new Date(b.date.split('/').reverse().join('-'));
          return dateB.getTime() - dateA.getTime();
        });

        setAttendances(validResults);
      } catch (err: any) {
        console.error('Error fetching attendance:', err);
        setError('Failed to load attendance data');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [employeeId, companyCode, clientId]);

  // getDayName is defined here but not used - keeping for potential future use
  const getShortDayName = (dateStr: string) => {
    try {
      const [day, month, year] = dateStr.split('/');
      const date = new Date(`${year}-${month}-${day}`);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } catch (err) {
      console.error('Error parsing date in getShortDayName:', err);
      return '???';
    }
  };

  const formatTime = (timeValue: string | null) => {
    if (!timeValue) return '--:--';
    try {
      return new Date(timeValue).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (err) {
      console.error('Error formatting time:', err);
      return '??:??';
    }
  };

  const getAttendanceStatus = (attendance: AttendanceData) => {
    const rawStatus = String(attendance.attendanceStatus || '').toLowerCase();
    if (rawStatus.includes('week')) return 'weekoff';
    if (rawStatus.includes('holiday')) return 'holiday';
    if (rawStatus.includes('absent')) return 'absent';
    if (rawStatus.includes('present')) return 'present';
    if (attendance.timeIn) return 'present';
    return 'no-data';
  };

  if (loading) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading attendance...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Feather name="alert-circle" size={48} color="#dc3545" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Generate today and the previous 4 days, newest first.
  const last5Days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return formatDateForApi(d);
  });

  // Create a map of attendance data by date for easy lookup
  const attendanceMap = new Map<string, AttendanceData>();
  attendances.forEach(att => attendanceMap.set(att.date, att));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.text }]}>Attendance Activity</Text>

      <View style={styles.table}>
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.headerCell, styles.dayCell]}>
              <Text style={[styles.headerText, { color: colors.mutedText }]}>Day</Text>
            </View>
            <View style={[styles.headerCell, styles.statusCell]}>
              <Text style={[styles.headerText, { color: colors.mutedText }]}>Status</Text>
            </View>
            <View style={[styles.headerCell, styles.timeCell]}>
              <Text style={[styles.headerText, { color: colors.mutedText }]}>In</Text>
            </View>
            <View style={[styles.headerCell, styles.timeCell]}>
              <Text style={[styles.headerText, { color: colors.mutedText }]}>Out</Text>
            </View>
            <View style={[styles.headerCell, styles.totalCell]}>
              <Text style={[styles.headerText, { color: colors.mutedText }]}>Total</Text>
            </View>
          </View>

          {last5Days.map((date) => {
            const attendance = attendanceMap.get(date) || {
              date,
              timeIn: null,
              timeOut: null,
              attendanceStatus: undefined
            };
            
            const status = getAttendanceStatus(attendance);
            const dayName = getShortDayName(date);
            const [day, month] = date.split('/');
            const formattedDate = `${day}/${month}`;

            const getStatusConfig = (status: string) => {
              switch (status) {
                case 'absent':
                  return {
                    label: 'Absent',
                    color: isDark ? '#fca5a5' : '#dc3545',
                    bgColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#ffe6e6',
                  };
                case 'present':
                  return {
                    label: 'Present',
                    color: isDark ? '#86efac' : '#28a745',
                    bgColor: isDark ? 'rgba(34, 197, 94, 0.16)' : '#e6ffed',
                  };
                case 'weekoff':
                  return {
                    label: 'Week Off',
                    color: isDark ? '#c4b5fd' : '#6d28d9',
                    bgColor: isDark ? 'rgba(139, 92, 246, 0.18)' : '#ede9fe',
                  };
                case 'holiday':
                  return {
                    label: 'Holiday',
                    color: isDark ? '#fde68a' : '#b45309',
                    bgColor: isDark ? 'rgba(245, 158, 11, 0.16)' : '#fef3c7',
                  };
                case 'no-data':
                default:
                  return {
                    label: 'No Data',
                    color: colors.mutedText,
                    bgColor: isDark ? 'rgba(148, 163, 184, 0.14)' : '#f8f9fa',
                  };
              }
            };
            
            const statusConfig = getStatusConfig(status);

            // Calculate total hours
            let totalHours = '--:--';
            const workedHoursNumber = Number(attendance.workedHours);
            if (Number.isFinite(workedHoursNumber) && workedHoursNumber > 0) {
              const hours = Math.floor(workedHoursNumber);
              const minutes = Math.round((workedHoursNumber - hours) * 60);
              totalHours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            } else if (attendance.timeIn && attendance.timeOut) {
              try {
                const diffMs = new Date(attendance.timeOut).getTime() - new Date(attendance.timeIn).getTime();
                const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                totalHours = `${diffHrs.toString().padStart(2, '0')}:${diffMins.toString().padStart(2, '0')}`;
              } catch (err) {
                console.error('Error calculating total hours:', err);
                totalHours = '??:??';
              }
            } else if (attendance.timeIn) {
              totalHours = 'In Progress';
            }

            // Determine total hours style
            let totalHoursStyle = styles.totalAbsent;
            if (totalHours === 'In Progress') {
              totalHoursStyle = styles.totalPartial;
            } else if (totalHours !== '--:--') {
              totalHoursStyle = styles.totalPresent;
            }

            const totalHoursColor =
              totalHours === 'In Progress'
                ? (isDark ? '#fdba74' : '#ff9800')
                : totalHours !== '--:--'
                  ? (isDark ? '#93c5fd' : '#007bff')
                  : colors.mutedText;
            const totalHoursBg =
              totalHours === 'In Progress'
                ? (isDark ? 'rgba(249, 115, 22, 0.16)' : '#fff3e0')
                : totalHours !== '--:--'
                  ? (isDark ? 'rgba(59, 130, 246, 0.16)' : '#e6f2ff')
                  : (isDark ? 'rgba(148, 163, 184, 0.14)' : '#f5f5f5');

            return (
              <View key={date} style={[styles.row, { borderBottomColor: colors.border }]}>
                {/* Day Column */}
                <View style={[styles.dataCell, styles.dayCell]}>
                  <Text style={[styles.dayName, { color: colors.mutedText }]}>{dayName}</Text>
                  <Text style={[styles.dateNumber, { color: colors.text }]}>{formattedDate}</Text>
                </View>

                {/* Status Column */}
                <View style={[styles.dataCell, styles.statusCell]}>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Clock-In Column */}
                <View style={[styles.dataCell, styles.timeCell]}>
                  <View style={styles.timeContainer}>
                    <Text style={[
                      styles.timeText, 
                      attendance.timeIn ? styles.timePresent : styles.timeAbsent,
                      { color: attendance.timeIn ? colors.text : colors.mutedText }
                    ]}>
                      {formatTime(attendance.timeIn)}
                    </Text>
                  </View>
                </View>

                {/* Clock-Out Column */}
                <View style={[styles.dataCell, styles.timeCell]}>
                  <View style={styles.timeContainer}>
                    <Text style={[
                      styles.timeText, 
                      attendance.timeOut ? styles.timePresent : styles.timeAbsent,
                      { color: attendance.timeOut ? colors.text : colors.mutedText }
                    ]}>
                      {formatTime(attendance.timeOut)}
                    </Text>
                  </View>
                </View>

                {/* Total Hours Column */}
                <View style={[styles.dataCell, styles.totalCell]}>
                  <Text style={[styles.totalText, totalHoursStyle, { color: totalHoursColor, backgroundColor: totalHoursBg }]}>
                    {totalHours}
                  </Text>
                </View>
              </View>
            );
          })}
      </View>
    </View>
  );
};

export default AttendanceActivity;

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 430,
    borderWidth: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    minHeight: 200,
    borderWidth: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#dc3545',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#999',
  },
  table: {
    width: '100%',
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
    marginBottom: 2,
  },
  headerCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dataCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    width: '16%',
  },
  statusCell: {
    width: '25%',
  },
  timeCell: {
    width: '18%',
  },
  totalCell: {
    width: '23%',
  },
  dayName: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  dateNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 12,
    minWidth: 66,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'center',
  },
  timePresent: {
    color: '#333',
  },
  timeAbsent: {
    color: '#999',
  },
  totalText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 54,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: 8,
  },
  totalPresent: {
    color: '#007bff',
    backgroundColor: '#e6f2ff',
  },
  totalPartial: {
    color: '#ff9800',
    backgroundColor: '#fff3e0',
    fontSize: 10,
  },
  totalAbsent: {
    color: '#999',
    backgroundColor: '#f5f5f5',
  },
});

