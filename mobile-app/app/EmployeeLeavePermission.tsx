import BottomNavBar from "../components/BottomNavBar";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import React, { useContext, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppTypography';
import { EmployeeContext } from "../context/EmployeeContext";
import { buildApiUrl } from "../lib/api";
import { useAppTheme } from "../context/AppThemeContext";

interface LeaveRequest {
  date: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  startTime: string;
  endTime: string;
}

// interface Props {
//   employeeId: number;
// }

const EmployeeLeavePermission = () => {
   const {  employee, setEmployee } = useContext(EmployeeContext);
  const { colors, isDark } = useAppTheme();
    const employeeId = employee?.id;
// const { employee, setEmployee, logout } = useContext(EmployeeContext);
const companyCode = employee?.companyCode;  // 👈 get companyCode here
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(buildApiUrl(`/api/leaves/employee/${employeeId}`, { clientId: employee?.clientId }));
      setLeaves(res.data || []);
    } catch (err: any) {
      setError("Failed to fetch leave/permission data. Please try again later.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [employeeId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaves();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
         <LinearGradient
              colors={['#7726B9', '#5E1D9E']}
              style={styles.header}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.headerTitle}>Leave & Permission Status</Text>
              {/* <Text style={styles.headerSubtitle}>Submit your time-off permission</Text> */}
            </LinearGradient>
      {/* <View style={styles.headerContainer}>
        <Text style={styles.headerTitles}>Leave & Permission Historly</Text>
        <View style={styles.headerLine} />
      </View> */}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading requests...</Text>
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2' }]}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : (
                    <View style={styles.bottomcontainer}>

        <FlatList
          data={leaves}
          keyExtractor={(_, idx) => idx.toString()}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedText }]}>No leave or permission requests found</Text>
              <Text style={[styles.emptySubText, { color: colors.mutedText }]}>Pull down to refresh</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.typeText, { color: colors.text }]}>{item.leaveType}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              
              <View style={styles.dateContainer}>
                <Text style={[styles.dateLabel, { color: colors.mutedText }]}>From:</Text>
                <Text style={[styles.dateValue, { color: colors.text }]}>{item.startDate} at {item.startTime}</Text>
              </View>
              
              <View style={styles.dateContainer}>
                <Text style={[styles.dateLabel, { color: colors.mutedText }]}>To:</Text>
                <Text style={[styles.dateValue, { color: colors.text }]}>{item.endDate} at {item.endTime}</Text>
              </View>
              
              <View style={styles.reasonContainer}>
                <Text style={[styles.reasonLabel, { color: colors.mutedText }]}>Reason:</Text>
                <Text style={[styles.reasonText, { color: colors.text }]}>{item.reason || "Not specified"}</Text>
              </View>
              
              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <Text style={[styles.submittedText, { color: colors.mutedText }]}>Submitted on {item.date}</Text>
              </View>
            </View>
                         

          )}
          contentContainerStyle={leaves.length === 0 ? styles.emptyListContent : styles.listContent}
        />
         </View>
      )}
            <BottomNavBar activeTab="" />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    // paddingHorizontal: 1,
    paddingTop: 0,
    // marginBottom: 100,
  },
  bottomcontainer: {
    flex: 1,  
    marginBottom: 70,
  
  },
  headerContainer: {
    marginBottom: 24,
  },
  headerTitles: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerLine: {
    height: 2,
    backgroundColor: '#E5E7EB',
    width: '40%',
    alignSelf: 'center',
  },
  header: {
    
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 16,
  },
  headerTitle: {
    paddingTop: 13,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginVertical: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginHorizontal: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
  },
  typeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  dateContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 50,
  },
  dateValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  reasonContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  reasonLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  submittedText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});

export default EmployeeLeavePermission;

