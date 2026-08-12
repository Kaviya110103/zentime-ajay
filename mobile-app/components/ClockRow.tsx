import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppTypography';
import { EmployeeContext } from '../context/EmployeeContext';
import { buildApiUrl } from '../lib/api';

interface AttendanceRecord {
  timeIn: string | null;
  timeOut: string | null;
  attendanceStatus: string;
  date: string;
}

type EmployeeInfoProps = {
  employeeId: string;
};

const ClockInfoRow: React.FC<EmployeeInfoProps> = ({ employeeId }) => {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { employee } = useContext(EmployeeContext);
  const companyCode = employee?.companyCode;
  const clientId = employee?.clientId;
  const isToday = (dateString: string): boolean => {
    const [day, month, year] = dateString.split('/').map(Number);
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() + 1 &&
      year === today.getFullYear()
    );
  };

  const formatDateToDDMMYYYY = (date: Date): string => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await axios.get<AttendanceRecord | string>(
          buildApiUrl(`/api/attendance/latest-today-or-yesterday/${employeeId}`, { clientId })
        );

        if (typeof res.data === 'string' || (res.data as any)?.found === false) {
          setAttendance(null);
        } else {
          setAttendance(res.data);
        }
      } catch (err) {
        setAttendance(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [employeeId, clientId]);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  const formatTime = (dateTimeStr: string | null): string => {
    if (!dateTimeStr) return '--:--';
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateWorkingHours = (timeInStr: string | null, timeOutStr: string | null): string => {
    if (!timeInStr || !timeOutStr) return '--h--m';
    const timeIn = new Date(timeInStr);
    const timeOut = new Date(timeOutStr);
    const diffMs = timeOut.getTime() - timeIn.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHrs}h${diffMins.toString().padStart(2, '0')}m`;
  };

  if (!attendance) {
    return (
      <View style={styles.clockRow}>
        {[...Array(3)].map((_, index) => (
          <View style={styles.timeEntry} key={index}>
            <View style={styles.iconCircle}>
              <Feather name="clock" size={25} color="#ffffff" />
            </View>
            <Text style={styles.timeText}>--:--</Text>
            <Text style={styles.timeLabel}>No Data</Text>
          </View>
        ))}
      </View>
    );
  }

  const isAbsentToday =
    attendance.attendanceStatus === 'Absent' &&
    isToday(attendance.date);

  if (isAbsentToday) {
    return (
      <View style={styles.absentContainer}>
        <Feather name="alert-octagon" size={20} color="#AA4A44" />
        <Text style={styles.absentText}>
          Absent - {attendance.date}
        </Text>
      </View>
    );
  }

  const clockData = [
    { time: formatTime(attendance.timeIn), label: 'Clock-In' },
    { time: formatTime(attendance.timeOut), label: 'Clock-Out' },
    { time: calculateWorkingHours(attendance.timeIn, attendance.timeOut), label: 'Working Hrs' },
  ];

  return (
    <View style={styles.clockRow}>
      {clockData.map((entry, index) => (
        <View style={styles.timeEntry} key={index}>
          <View style={styles.iconCircle}>
            <Feather name="clock" size={25} color="#ffffff" />
          </View>
          <Text style={styles.timeText}>{entry.time}</Text>
          <Text style={styles.timeLabel}>{entry.label}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  clockRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 5,
    marginBottom: 10,
  },
  timeEntry: {
    alignItems: 'center',
  },
  iconCircle: {
    borderRadius: 20,
    padding: 6,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  timeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  timeLabel: {
    fontSize: 10,
    color: '#ffffff',
  },
  absentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  absentText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 14,
  },
});

export default ClockInfoRow;


