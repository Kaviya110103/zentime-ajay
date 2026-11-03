import BottomNavBar from "../components/BottomNavBar";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { AppText as Text } from "../components/AppTypography";
import { EmployeeContext } from "../context/EmployeeContext";
import { useAppTheme } from "../context/AppThemeContext";
import { buildApiUrl } from "../lib/api";

type RequestTab = "leave" | "permission" | "weekoff" | "overtime";
type StatusTab = "pending" | "approved" | "rejected";

interface LeaveRequest {
  id?: number;
  date?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
}

interface OvertimeRequest {
  id?: number;
  date?: string;
  overtimeHours?: number;
  reason?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface StatusItem {
  id: string;
  type: RequestTab;
  title: string;
  status: StatusTab;
  primaryDate: string;
  secondaryDate?: string;
  detail?: string;
  submittedOn?: string;
}

const REQUEST_TABS: Array<{ key: RequestTab; label: string }> = [
  { key: "leave", label: "Leave" },
  { key: "permission", label: "Permission" },
  { key: "weekoff", label: "Weekoff" },
  { key: "overtime", label: "Overtime" },
];

const STATUS_TABS: Array<{ key: StatusTab; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const EmployeeLeavePermission = () => {
  const { employee } = useContext(EmployeeContext);
  const { colors, isDark } = useAppTheme();
  const employeeId = employee?.id;
  const clientId = employee?.clientId;

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [requestTab, setRequestTab] = useState<RequestTab>("leave");
  const [statusTab, setStatusTab] = useState<StatusTab>("pending");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = async () => {
    if (!employeeId || !clientId) {
      setLeaveRequests([]);
      setOvertimeRequests([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [leaveRes, overtimeRes] = await Promise.all([
        axios.get<LeaveRequest[]>(buildApiUrl(`/api/leaves/employee/${employeeId}`, { clientId })),
        axios.get<OvertimeRequest[]>(
          buildApiUrl("/api/overtime-requests", { clientId, query: { employeeId } })
        ),
      ]);

      setLeaveRequests(Array.isArray(leaveRes.data) ? leaveRes.data : []);
      setOvertimeRequests(Array.isArray(overtimeRes.data) ? overtimeRes.data : []);
    } catch (err) {
      setError("Failed to fetch request status. Please try again later.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [employeeId, clientId]);

  const statusItems = useMemo<StatusItem[]>(() => {
    const leaveItems = leaveRequests
      .map(toLeaveStatusItem)
      .filter((item): item is StatusItem => Boolean(item));
    const overtimeItems = overtimeRequests.map(toOvertimeStatusItem);
    return [...leaveItems, ...overtimeItems];
  }, [leaveRequests, overtimeRequests]);

  const counts = useMemo(() => {
    const next = createEmptyCounts();
    statusItems.forEach((item) => {
      next[item.type][item.status] += 1;
    });
    return next;
  }, [statusItems]);

  const filteredItems = useMemo(
    () => statusItems.filter((item) => item.type === requestTab && item.status === statusTab),
    [statusItems, requestTab, statusTab]
  );

  const activeTypeLabel =
    REQUEST_TABS.find((tab) => tab.key === requestTab)?.label ?? "request";
  const activeStatusLabel =
    STATUS_TABS.find((tab) => tab.key === statusTab)?.label.toLowerCase() ?? "selected";

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#7726B9", "#5E1D9E"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>Request Status</Text>
        <Text style={styles.headerSubtitle}>
          Leave, permission, weekoff and overtime updates
        </Text>
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>
            Loading requests...
          </Text>
        </View>
      ) : error ? (
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: isDark ? "rgba(239, 68, 68, 0.16)" : "#FEE2E2" },
          ]}
        >
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.requestTabsScroller}
            contentContainerStyle={styles.requestTabs}
          >
            {REQUEST_TABS.map((tab) => {
              const isActive = requestTab === tab.key;
              const total = totalForType(counts[tab.key]);
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.requestTab,
                    {
                      backgroundColor: isActive ? colors.primary : colors.surface,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setRequestTab(tab.key)}
                  activeOpacity={0.86}
                >
                  <Text
                    style={[
                      styles.requestTabText,
                      { color: isActive ? "#FFFFFF" : colors.text },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  <View
                    style={[
                      styles.countPill,
                      { backgroundColor: isActive ? "rgba(255,255,255,0.22)" : colors.background },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countPillText,
                        { color: isActive ? "#FFFFFF" : colors.mutedText },
                      ]}
                    >
                      {total}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[styles.statusTabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {STATUS_TABS.map((tab) => {
              const isActive = statusTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.statusTab,
                    { backgroundColor: isActive ? colors.primary : "transparent" },
                  ]}
                  onPress={() => setStatusTab(tab.key)}
                  activeOpacity={0.86}
                >
                  <Text
                    style={[
                      styles.statusTabText,
                      { color: isActive ? "#FFFFFF" : colors.mutedText },
                    ]}
                  >
                    {tab.label} ({counts[requestTab][tab.key]})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
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
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No {activeStatusLabel} {activeTypeLabel.toLowerCase()} requests
                </Text>
                <Text style={[styles.emptySubText, { color: colors.mutedText }]}>
                  Pull down to refresh
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <StatusCard item={item} colors={colors} />
            )}
            contentContainerStyle={
              filteredItems.length === 0 ? styles.emptyListContent : styles.listContent
            }
          />
        </View>
      )}

      <BottomNavBar activeTab="" />
    </View>
  );
};

const StatusCard = ({ item, colors }: { item: StatusItem; colors: any }) => {
  const badgeColor = statusColor(item.status);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.cardTitleGroup}>
          <Text style={[styles.typeLabel, { color: colors.mutedText }]}>
            {labelForType(item.type)}
          </Text>
          <Text style={[styles.typeText, { color: colors.text }]}>{item.title}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.mutedText }]}>Date</Text>
        <Text style={[styles.detailValue, { color: colors.text }]}>{item.primaryDate}</Text>
      </View>

      {item.secondaryDate ? (
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.mutedText }]}>To</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{item.secondaryDate}</Text>
        </View>
      ) : null}

      {item.detail ? (
        <View style={styles.reasonContainer}>
          <Text style={[styles.reasonLabel, { color: colors.mutedText }]}>Details</Text>
          <Text style={[styles.reasonText, { color: colors.text }]}>{item.detail}</Text>
        </View>
      ) : null}

      {item.submittedOn ? (
        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.submittedText, { color: colors.mutedText }]}>
            Submitted on {item.submittedOn}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const toLeaveStatusItem = (item: LeaveRequest): StatusItem | null => {
  const type = requestTypeForLeave(item.leaveType);
  if (!type) {
    return null;
  }

  const fallbackId = [
    item.startDate,
    item.endDate,
    item.leaveType,
    item.status,
    item.date,
  ].filter(Boolean).join("-");

  return {
    id: `${type}-${item.id ?? fallbackId}`,
    type,
    title: item.leaveType || labelForType(type),
    status: normalizeStatus(item.status),
    primaryDate: joinDateTime(item.startDate, item.startTime),
    secondaryDate: joinDateTime(item.endDate, item.endTime),
    detail: item.reason || "Not specified",
    submittedOn: item.date,
  };
};

const toOvertimeStatusItem = (item: OvertimeRequest): StatusItem => {
  const fallbackId = [item.date, item.status, item.overtimeHours, item.createdAt]
    .filter(Boolean)
    .join("-");

  return {
    id: `overtime-${item.id ?? fallbackId}`,
    type: "overtime",
    title: "Overtime Request",
    status: normalizeStatus(item.status),
    primaryDate: item.date || "-",
    detail: `${formatHours(item.overtimeHours)}${item.reason ? ` - ${item.reason}` : ""}`,
    submittedOn: formatDateTime(item.createdAt),
  };
};

const requestTypeForLeave = (leaveType?: string): RequestTab | null => {
  const normalized = (leaveType || "").trim().toLowerCase();
  if (!normalized) {
    return "leave";
  }
  if (normalized === "swap weekoff" || normalized.includes("weekoff") || normalized.includes("week off")) {
    return "weekoff";
  }
  if (normalized.includes("permission")) {
    return "permission";
  }
  return "leave";
};

const normalizeStatus = (status?: string): StatusTab => {
  const normalized = (status || "").trim().toLowerCase();
  if (normalized === "approved") {
    return "approved";
  }
  if (normalized === "rejected") {
    return "rejected";
  }
  return "pending";
};

const createEmptyCounts = () =>
  REQUEST_TABS.reduce((acc, tab) => {
    acc[tab.key] = { pending: 0, approved: 0, rejected: 0 };
    return acc;
  }, {} as Record<RequestTab, Record<StatusTab, number>>);

const totalForType = (statusCounts: Record<StatusTab, number>) =>
  statusCounts.pending + statusCounts.approved + statusCounts.rejected;

const labelForType = (type: RequestTab) => {
  switch (type) {
    case "permission":
      return "Permission";
    case "weekoff":
      return "Weekoff";
    case "overtime":
      return "Overtime";
    default:
      return "Leave";
  }
};

const statusColor = (status: StatusTab) => {
  switch (status) {
    case "approved":
      return "#10B981";
    case "rejected":
      return "#EF4444";
    default:
      return "#F59E0B";
  }
};

const joinDateTime = (date?: string, time?: string) => {
  const safeDate = date || "-";
  return time ? `${safeDate} at ${time}` : safeDate;
};

const formatHours = (hours?: number) => {
  const value = Number(hours || 0);
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)} hr${value === 1 ? "" : "s"}`;
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return undefined;
  }
  return value.replace("T", " ").slice(0, 16);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    marginBottom: 70,
  },
  header: {
    paddingTop: 32,
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.84)",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 16,
    alignItems: "center",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "500",
  },
  requestTabs: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 10,
    alignItems: "center",
  },
  requestTabsScroller: {
    maxHeight: 66,
    flexGrow: 0,
  },
  requestTab: {
    minWidth: 118,
    height: 52,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  requestTabText: {
    fontSize: 14,
    fontWeight: "700",
  },
  countPill: {
    minWidth: 28,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  countPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusTabs: {
    marginHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    flexDirection: "row",
    marginBottom: 12,
  },
  statusTab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  statusTabText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  emptySubText: {
    fontSize: 14,
    textAlign: "center",
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    marginHorizontal: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    paddingBottom: 12,
    gap: 12,
  },
  cardTitleGroup: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  typeText: {
    fontSize: 16,
    fontWeight: "700",
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "capitalize",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    width: 74,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  reasonContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  submittedText: {
    fontSize: 12,
    fontStyle: "italic",
  },
});

export default EmployeeLeavePermission;
