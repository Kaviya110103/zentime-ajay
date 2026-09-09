import BottomNavBar from '../components/BottomNavBar';
import { EmployeeContext } from "../context/EmployeeContext";
import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../components/AppTypography';
import { buildApiUrl, withClientId } from '../lib/api';
import { useAppTheme } from '../context/AppThemeContext';

interface AttendanceReport {
  firstName: string;
  lastName?: string;
  empId: string;
  name: string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  workingHours?: string;
  missedTimes?: string;
  attendanceStatus: string;
  imageIn?: string;
  imageOut?: string;
}

type AttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  weekOff: number;
  holiday: number;
};

const EmployeeAttendanceReport = () => {
  const { employee } = useContext(EmployeeContext);
  const { isDark, colors } = useAppTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [companyCode, setCompanyCode] = useState('');
  const [employeeId, setEmployeeId] = useState(0);
  const [clientId, setClientId] = useState('');
  
  const [reportData, setReportData] = useState<AttendanceReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [printData, setPrintData] = useState<AttendanceReport[]>([]);
  const [client, setClient] = useState<any>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [reportError, setReportError] = useState('');
  const [summary, setSummary] = useState<AttendanceSummary>({
    total: 0,
    present: 0,
    absent: 0,
    weekOff: 0,
    holiday: 0,
  });

  const [employeeDetails, setEmployeeDetails] = useState({
    firstName: '',
    lastName: '',
    branch: '',
    mobile: '',
    position: '',
  });

  const employeeDisplayName =
    [employeeDetails.firstName, employeeDetails.lastName]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ') || 'N/A';
  const summaryCardThemeStyle = isDark
    ? { backgroundColor: '#351153', borderColor: 'rgba(255,255,255,0.28)' }
    : {};
  const summaryValueThemeStyle = { color: isDark ? '#FFFFFF' : '#1F2937' };
  const presentValueThemeStyle = { color: isDark ? '#86EFAC' : '#16A34A' };
  const absentValueThemeStyle = { color: isDark ? '#FCA5A5' : '#DC2626' };
  const weekOffValueThemeStyle = { color: isDark ? '#DDD6FE' : '#7C3AED' };
  const holidayValueThemeStyle = { color: isDark ? '#93C5FD' : '#1976D2' };
  const summaryLabelThemeStyle = { color: isDark ? '#E9D5FF' : '#6B7280' };

  // Initialize employee data
  useEffect(() => {
    if (employee) {
      setCompanyCode(employee?.companyCode || '');
      const normalizedEmployeeId = Number(employee?.id);
      setEmployeeId(Number.isFinite(normalizedEmployeeId) ? normalizedEmployeeId : 0);
      setClientId(String(employee?.clientId || ''));
      setIsLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    const fetchClient = async () => {
      if (!clientId) return;
      
      try {
        const res = await axios.get(buildApiUrl(`/api/clients/${clientId}`));
        setClient(res.data);
      } catch (err) {
        console.error('Error fetching client:', err);
        // Only show alert if this is not the initial silent load
        if (initialLoadComplete) {
          Alert.alert('Error', 'Unable to fetch client details');
        }
      }
    };

    fetchClient();
  }, [clientId, initialLoadComplete]);

  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      if (!employeeId) return;
      
      try {
        const res = await axios.get(buildApiUrl(`/api/employees/${employeeId}`, { clientId }));
        setEmployeeDetails({
          firstName: res.data.firstName || '',
          lastName: res.data.lastName || '',
          branch: res.data.branch || '',
          mobile: res.data.mobile || '',
          position: res.data.position || '',
        });
      } catch (err) {
        console.error('Error fetching employee details:', err);
      }
    };
    
    if (employeeId) {
      fetchEmployeeDetails();
    }
  }, [employeeId, clientId]);

  useEffect(() => {
    if (employeeId) {
      fetchReportData();
    }
  }, [currentDate, employeeId, clientId]);

  const fetchReportData = async () => {
    if (!employeeId) return;
    
    setLoading(true);
    try {
      setReportError('');
      let month = currentDate.getMonth() + 1;
      let year = currentDate.getFullYear();
      
      const normalizeDateLabel = (raw?: string | null) => {
        const value = String(raw || '').trim();
        if (!value) return 'N/A';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [yyyy, mm, dd] = value.split('-');
          return `${dd}/${mm}/${yyyy}`;
        }
        return value;
      };

      const resolveReportDateValue = (item: any) =>
        item?.date ||
        item?.attendanceDate ||
        item?.recordDate ||
        item?.localDate ||
        item?.formattedDate ||
        null;

      const response = await axios.get(
        buildApiUrl('/api/attendance-records/by-employee-month'),
        {
          params: withClientId({ employeeId, month, year }, clientId),
          timeout: 10000,
        }
      );
      let sourceData: any[] = Array.isArray(response.data) ? response.data : [];

      sourceData = sourceData
        .filter((item: any) => isSameReportMonth(resolveReportDateValue(item), month, year))
        .sort((a: any, b: any) => compareReportDates(resolveReportDateValue(a), resolveReportDateValue(b)));

      const formattedData = sourceData.map((item: any) => {
        const employeeInfo = item.employee || {};
        const rowFirstName = item.firstName || employeeInfo.firstName || employeeDetails.firstName || 'N/A';
        const rowLastName = item.lastName || employeeInfo.lastName || employeeDetails.lastName || '';
        const rowFullName = [rowFirstName, rowLastName]
          .map((part) => String(part || '').trim())
          .filter(Boolean)
          .join(' ');
        const status = item.displayStatus || item.attendanceStatus || item.countStatus || 'Absent';
        const missedMinutes =
          item.calculatedMissedMinutes ?? item.missedTimes ?? item.lateMinutes ?? 0;
        return {
          empId: employeeId.toString(),
          firstName: rowFirstName,
          lastName: rowLastName,
          name: rowFullName || item.name || employeeDisplayName,
          date: normalizeDateLabel(resolveReportDateValue(item)),
          timeIn: item.timeIn,
          timeOut: item.timeOut,
          workingHours: formatWorkedMinutes(item.workedMinutes) || formatWorkedHours(item.workedHours) || calculateWorkingHours(item.timeIn, item.timeOut),
          missedTimes: formatMinutesToHours(missedMinutes),
          attendanceStatus: status,
          imageIn: item.imageIn,
          imageOut: item.imageOut
        };
      });

      setReportData(formattedData);
      setPrintData(formattedData);
      setSummary(buildAttendanceSummary(formattedData));
      setInitialLoadComplete(true);
    } catch (error: any) {
      console.warn('Error fetching report data:', error?.message || error);
      setReportData([]);
      setPrintData([]);
      setReportError(
        error?.response?.data?.message ||
          error?.message ||
          'Unable to fetch attendance report. Please try again.'
      );
      
      console.warn('Monthly report background fetch failed:', error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBucket = (record: AttendanceReport) => {
    const normalized = String(record.attendanceStatus || '').toLowerCase().replace(/\s+/g, '');
    if (normalized.includes('present')) return 'Present';
    if (normalized.includes('absent')) return 'Absent';
    if (normalized.includes('weekoff') || normalized.includes('weekendoff')) return 'Week Off';
    if (normalized.includes('holiday')) return 'Holiday';
    return 'Other';
  };

  const buildAttendanceSummary = (items: AttendanceReport[]): AttendanceSummary => ({
    total: items.length,
    present: items.filter((item) => getStatusBucket(item) === 'Present').length,
    absent: items.filter((item) => getStatusBucket(item) === 'Absent').length,
    weekOff: items.filter((item) => getStatusBucket(item) === 'Week Off').length,
    holiday: items.filter((item) => getStatusBucket(item) === 'Holiday').length,
  });

  const parseReportDate = (raw?: string | null): Date | null => {
    const value = String(raw || '').trim();
    if (!value) return null;
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    const isoDateTime = /^(\d{4})-(\d{2})-(\d{2})[T\s]/.exec(value);
    if (isoDateTime) {
      return new Date(
        Number(isoDateTime[1]),
        Number(isoDateTime[2]) - 1,
        Number(isoDateTime[3])
      );
    }
    return null;
  };

  const isSameReportMonth = (raw: any, month: number, year: number) => {
    const parsed = parseReportDate(raw);
    return !!parsed && parsed.getMonth() + 1 === month && parsed.getFullYear() === year;
  };

  const compareReportDates = (left: any, right: any) => {
    const leftDate = parseReportDate(left)?.getTime() ?? 0;
    const rightDate = parseReportDate(right)?.getTime() ?? 0;
    return leftDate - rightDate;
  };

  const formatMinutesToHours = (minutes: any) => {
    // Handle null/undefined
    if (minutes === null || minutes === undefined || minutes === '') {
      return '0h 0m';
    }
    
    // Handle string that might already be formatted
    if (typeof minutes === 'string') {
      // Check if it's already in "Xh Ym" format
      if (minutes.includes('h') || minutes.includes('m')) {
        return minutes;
      }
      
      // Try to parse as number
      const minsNum = Number.parseInt(minutes, 10);
      if (!Number.isNaN(minsNum)) {
        const hours = Math.floor(minsNum / 60);
        const mins = minsNum % 60;
        return `${hours}h ${mins}m`;
      }
    }
    
    // Handle number
    if (typeof minutes === 'number') {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    
    // Default fallback
    return '0h 0m';
  };

  const calculateWorkingHours = (timeIn?: string, timeOut?: string) => {
    if (!timeIn || !timeOut) return '0h 0m';
    
    try {
      const inTime = new Date(timeIn);
      const outTime = new Date(timeOut);
      
      // Check if dates are valid
      if (Number.isNaN(inTime.getTime()) || Number.isNaN(outTime.getTime())) {
        return '0h 0m';
      }
      
      const diffMs = outTime.getTime() - inTime.getTime();
      
      if (diffMs < 0) return 'Invalid';
      
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(diffMins / 60);
      const minutes = diffMins % 60;
      
      return `${hours}h ${minutes}m`;
    } catch {
      return '0h 0m';
    }
  };

  const formatTime = (dateTimeString?: string) => {
    if (!dateTimeString) return '--:--';
    try {
      const date = new Date(dateTimeString);
      if (Number.isNaN(date.getTime())) return '--:--';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '--:--';
    }
  };

  const getPeriodString = () => {
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const getPDFFileName = () =>
    `Attendance_Report_${employeeId}_${getPeriodString().replace(/\s+/g, '_')}.pdf`;

  const formatWorkedHours = (hours: any) => {
    const numeric = Number(hours);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';
    const wholeHours = Math.floor(numeric);
    const minutes = Math.round((numeric - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  const formatWorkedMinutes = (minutes: any) => {
    const numeric = Number(minutes);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';
    const hours = Math.floor(numeric / 60);
    const mins = Math.round(numeric % 60);
    return `${hours}h ${mins}m`;
  };

  const shiftMonth = (delta: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  const generatePDFHtml = () => {
    const tableRows = reportData.map(item => {
      let statusColor = 'color: #FF9800;';
      if (item.attendanceStatus === 'Present') {
        statusColor = 'color: #4CAF50;';
      } else if (item.attendanceStatus === 'Absent') {
        statusColor = 'color: #F44336;';
      }
      return `
      <tr>
        <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: center;">${item.date}</td>
        <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: center;">${formatTime(item.timeIn)}</td>
        <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: center;">${formatTime(item.timeOut)}</td>
        <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: center;">${item.workingHours}</td>
        <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: center;">${item.missedTimes}</td>
        <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: center; ${statusColor} font-weight: 500;">
          ${item.attendanceStatus}
        </td>
      </tr>
    `;
    }).join('');

    const totalPresent = summary.present;
    const totalAbsent = summary.absent;
    const totalRecords = summary.total;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Attendance Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #7726B9;
              padding-bottom: 20px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #7726B9;
              margin-bottom: 10px;
            }
            .report-title {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #333;
            }
            .report-period {
              font-size: 16px;
              color: #666;
              margin-bottom: 5px;
            }
            .employee-info {
              font-size: 14px;
              color: #666;
              margin: 2px 0;
            }
            .table-container {
              margin: 20px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              background-color: white;
            }
            th {
              background-color: #f5f5f5;
              padding: 10px;
              border: 1px solid #e0e0e0;
              text-align: center;
              font-weight: bold;
              color: #333;
            }
            td {
              padding: 10px;
              border: 1px solid #e0e0e0;
              text-align: center;
              color: #333;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            .summary {
              margin: 20px 0;
            }
            .no-data {
              text-align: center;
              padding: 40px;
              color: #666;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">${client?.companyName || employee?.companyCode || 'Company'}</div>
            <div class="report-title">Monthly Attendance Report</div>
            <div class="report-period">${getPeriodString()}</div>
            <div class="employee-info">Employee ID: ${employeeId}</div>
            <div class="employee-info">Name: ${employeeDisplayName}</div>
            <div class="employee-info">Branch: ${employeeDetails.branch}</div>
            <div class="employee-info">Mobile: ${employeeDetails.mobile}</div>
            <div class="employee-info">Position: ${employeeDetails.position}</div>
          </div>

          <div class="summary">
            <table>
              <tr>
                <th>Total Days</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Week Off</th>
                <th>Holiday</th>
                <th>Attendance Rate</th>
              </tr>
              <tr>
                <td>${totalRecords}</td>
                <td style="color: #4CAF50; font-weight: bold;">${totalPresent}</td>
                <td style="color: #F44336; font-weight: bold;">${totalAbsent}</td>
                <td style="color: #7C3AED; font-weight: bold;">${summary.weekOff}</td>
                <td style="color: #1976D2; font-weight: bold;">${summary.holiday}</td>
                <td style="color: #7726B9; font-weight: bold;">${totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : 0}%</td>
              </tr>
            </table>
          </div>

          <div class="table-container">
            ${reportData.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Working Hours</th>
                    <th>Missed Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
            ` : `
              <div class="no-data">
                No attendance records found for ${getPeriodString()}
              </div>
            `}
          </div>

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p>This is a system-generated report. No signature required.</p>
          </div>
        </body>
      </html>
    `;
  };

  const createPDFFile = async () => {
    const htmlContent = generatePDFHtml();
    return Print.printToFileAsync({ html: htmlContent, base64: true });
  };

  const downloadPDF = async () => {
    try {
      setPdfLoading(true);
      const { uri, base64 } = await createPDFFile();
      const fileName = getPDFFileName();
      
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = uri;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        Alert.alert('Success', 'PDF downloaded successfully!');
        return;
      }

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          Alert.alert('Download cancelled', 'Please choose a folder to save the PDF.');
          return;
        }

        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/pdf'
        );
        const pdfBase64 =
          base64 ||
          (await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          }));
        await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, pdfBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        Alert.alert('Downloaded', `PDF saved as ${fileName}`);
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Save Attendance Report',
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF ready', `Report generated: ${uri}`);
      }
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', error?.message || 'Failed to download PDF report');
    } finally {
      setPdfLoading(false);
    }
  };

  // Show loading screen
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#7726B9" />
        <Text style={[styles.loadingText, { color: colors.primary }]}>Loading employee data...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.contentWrapper}>
        <LinearGradient
          colors={['#7726B9', '#5E1D9E']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.headerTitle}>Monthly Attendance Report</Text>
        </LinearGradient>
        
        <View style={[styles.printContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.printHeader}>
            <View style={styles.periodRow}>
              <TouchableOpacity style={[styles.periodButton, isDark && { backgroundColor: '#1f2937', borderColor: colors.border }]} onPress={() => shiftMonth(-1)}>
                <Feather name="chevron-left" size={18} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.printSubtitle, { color: colors.text }]}>{getPeriodString()}</Text>
              <TouchableOpacity style={[styles.periodButton, isDark && { backgroundColor: '#1f2937', borderColor: colors.border }]} onPress={() => shiftMonth(1)}>
                <Feather name="chevron-right" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.employeeName, { color: colors.mutedText }]}>{employeeDisplayName}</Text>
          </View>
          
          <ScrollView style={styles.printScroll}>
            {reportError ? (
              <View style={[styles.errorContainer, { borderColor: colors.border }]}>
                <Text style={styles.errorTitle}>Unable to load report</Text>
                <Text style={[styles.errorText, { color: colors.mutedText }]}>{reportError}</Text>
              </View>
            ) : (
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryCard, summaryCardThemeStyle]}>
                  <Text style={[styles.summaryValue, summaryValueThemeStyle]}>{summary.total}</Text>
                  <Text style={[styles.summaryLabel, summaryLabelThemeStyle]}>Total Records</Text>
                </View>
                <View style={[styles.summaryCard, summaryCardThemeStyle]}>
                  <Text style={[styles.summaryValue, presentValueThemeStyle]}>{summary.present}</Text>
                  <Text style={[styles.summaryLabel, summaryLabelThemeStyle]}>Present</Text>
                </View>
                <View style={[styles.summaryCard, summaryCardThemeStyle]}>
                  <Text style={[styles.summaryValue, absentValueThemeStyle]}>{summary.absent}</Text>
                  <Text style={[styles.summaryLabel, summaryLabelThemeStyle]}>Absent</Text>
                </View>
                <View style={[styles.summaryCard, summaryCardThemeStyle]}>
                  <Text style={[styles.summaryValue, weekOffValueThemeStyle]}>{summary.weekOff}</Text>
                  <Text style={[styles.summaryLabel, summaryLabelThemeStyle]}>Week Off</Text>
                </View>
                <View style={[styles.summaryCard, summaryCardThemeStyle]}>
                  <Text style={[styles.summaryValue, holidayValueThemeStyle]}>{summary.holiday}</Text>
                  <Text style={[styles.summaryLabel, summaryLabelThemeStyle]}>Holiday</Text>
                </View>
              </View>
            )}

            {reportError ? null : reportData.length === 0 ? (
              <View style={styles.noDataContainer}>
                <Text style={[styles.noDataText, { color: colors.mutedText }]}>No attendance records found for {getPeriodString()}</Text>
              </View>
            ) : (
              <View style={styles.printTable}>
                <View style={[styles.printTableHeader, isDark && { backgroundColor: '#1f2937', borderColor: colors.border }]}>
                  <Text style={styles.printHeaderCell}>Date</Text>
                  <Text style={styles.printHeaderCell}>Time In</Text>
                  <Text style={styles.printHeaderCell}>Time Out</Text>
                  <Text style={styles.printHeaderCell}>Working Hours</Text>
                  <Text style={styles.printHeaderCell}>Missed Time</Text>
                  <Text style={styles.printHeaderCell}>Status</Text>
                </View>
                
                {printData.map((item) => {
                  let statusStyle = styles.printOtherStatus;
                  if (item.attendanceStatus === 'Present') {
                    statusStyle = styles.printPresentStatus;
                  } else if (item.attendanceStatus === 'Absent') {
                    statusStyle = styles.printAbsentStatus;
                  }
                  return (
                  <View key={item.date} style={[styles.printTableRow, { borderColor: colors.border }]}>
                    <Text style={[styles.printCell, { color: colors.text }]}>{item.date}</Text>
                    <Text style={[styles.printCell, { color: colors.text }]}>{formatTime(item.timeIn)}</Text>
                    <Text style={[styles.printCell, { color: colors.text }]}>{formatTime(item.timeOut)}</Text>
                    <Text style={[styles.printCell, { color: colors.text }]}>{item.workingHours}</Text>
                    <Text style={[styles.printCell, { color: colors.text }]}>{item.missedTimes}</Text>
                    <Text style={[styles.printCell, statusStyle]}>
                      {item.attendanceStatus}
                    </Text>
                  </View>
                );
                })}
              </View>
            )}
          </ScrollView>
          
          <View style={styles.printFooter}>
            <Text style={[styles.printFooterText, { color: colors.mutedText }]}>Generated on {new Date().toLocaleDateString()}</Text>
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.downloadButton}
              onPress={downloadPDF}
              disabled={pdfLoading || reportData.length === 0}
            >
              {pdfLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Feather name="download" size={20} color="white" />
                  <Text style={styles.downloadButtonText}>Download PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.8)' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.primary }]}>Loading attendance data...</Text>
        </View>
      )}
      
      <BottomNavBar activeTab="" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    marginTop: 0,
  },
  contentWrapper: {
    flex: 1,
    paddingBottom: 78,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7726B9',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  printContainer: {
    flex: 1,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  printHeader: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 16,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  periodButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D8B4FE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F0FF',
  },
  printSubtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#4a6da7',
    marginTop: 8,
    fontWeight: 'bold',
  },
  employeeName: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginTop: 4,
  },
  printScroll: {
    flex: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 92,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#F8F5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#351153',
  },
  summaryLabel: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
  },
  presentValue: {
    color: '#16A34A',
  },
  absentValue: {
    color: '#DC2626',
  },
  weekOffValue: {
    color: '#7C3AED',
  },
  holidayValue: {
    color: '#1976D2',
  },
  errorContainer: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#FFF1F2',
  },
  errorTitle: {
    color: '#BE123C',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  printTable: {
    marginBottom: 20,
  },
  printTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  printHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#333',
    fontSize: 12,
  },
  printTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    paddingVertical: 10,
  },
  printCell: {
    flex: 1,
    textAlign: 'center',
    color: '#333',
    fontSize: 12,
  },
  printPresentStatus: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  printAbsentStatus: {
    color: '#F44336',
    fontWeight: '500',
  },
  printOtherStatus: {
    color: '#FF9800',
    fontWeight: '500',
  },
  printFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  printFooterText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 12,
  },
  modalButtons: {
    marginTop: 16,
  },
  downloadButton: {
    backgroundColor: '#7726B9',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  downloadButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default EmployeeAttendanceReport;

