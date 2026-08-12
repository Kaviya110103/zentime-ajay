import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { ActivityIndicator, Alert, AppState, BackHandler, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../components/AppTypography';
import { EmployeeContext } from "../context/EmployeeContext";
import { buildApiUrl } from "../lib/api";
import { useAppTheme } from "../context/AppThemeContext";

type AttendanceSummary = {
  totalEmployees?: number;
  presentToday?: number;
  onTimeToday?: number;
  absentToday?: number;
  lateArrivalsToday?: number;
};

type EmployeeRow = {
  id?: number;
  employeeId?: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  branch?: string;
  mobile?: string;
  position?: string;
  timeIn?: string;
  lateMinutes?: number;
};

type LeaveRequest = {
  id: number;
  leaveType?: string;
  status?: string;
  reason?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  employee?: {
    id?: number;
    firstName?: string;
    lastName?: string;
    branch?: string;
  };
};

type MissedTimeout = {
  attendanceId: number;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  branch?: string;
  position?: string;
  date?: string;
  timeoutReason?: string;
};

type ModuleKey =
  | "dashboard"
  | "attendance"
  | "employees"
  | "ontime"
  | "absent"
  | "late"
  | "leavePermission"
  | "clockout";

type DashboardDataKey =
  | "summary"
  | "employees"
  | "present"
  | "absent"
  | "late"
  | "leaves"
  | "clockout";

const AUTO_LOGOUT_MS = 5 * 60 * 1000;
const DASHBOARD_API_TIMEOUT_MS = 9000;

const INITIAL_DASHBOARD_LOADING: Record<DashboardDataKey, boolean> = {
  summary: false,
  employees: false,
  present: false,
  absent: false,
  late: false,
  leaves: false,
  clockout: false,
};

function formatLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function isTodayDDMMYYYY(value?: string): boolean {
  if (!value) return false;
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return false;
  const today = new Date();
  return day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
}

function getGreetingLabel(hour: number): string {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function getApiErrorMessage(error: any, fallback: string): string {
  const responseData = error?.response?.data;
  if (typeof responseData === "string" && responseData.trim().length > 0) {
    return responseData.trim();
  }
  if (responseData?.message) {
    return String(responseData.message);
  }
  if (error?.message) {
    return String(error.message);
  }
  return fallback;
}

function formatPersonName(
  person?: { firstName?: string; lastName?: string; name?: string } | null,
  fallback = "Employee"
): string {
  const fullName = [person?.firstName, person?.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
  return fullName || String(person?.name || "").trim() || fallback;
}

export default function AdminDashboard() {
  const router = useRouter();
  const params = useLocalSearchParams<{ adminSession?: string | string[] }>();
  const { adminClient, sessionType, authReady, logout, setAdminClient } = useContext(EmployeeContext);
  const { isDark, colors } = useAppTheme();
  const routeAdminClient = useMemo(() => {
    const rawParam = Array.isArray(params.adminSession) ? params.adminSession[0] : params.adminSession;
    if (!rawParam) return null;
    try {
      const parsed = JSON.parse(rawParam);
      return parsed?.id ? parsed : null;
    } catch (error) {
      console.warn("Failed to parse admin session from route params:", error);
      return null;
    }
  }, [params.adminSession]);
  const effectiveAdminClient = adminClient || routeAdminClient;
  const clientId = effectiveAdminClient?.id;
  const isAdminSession = (sessionType === "admin" && Boolean(adminClient)) || Boolean(routeAdminClient?.id);

  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] =
    useState<Record<DashboardDataKey, boolean>>(INITIAL_DASHBOARD_LOADING);
  const [refreshing, setRefreshing] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleKey>("dashboard");

  const [summary, setSummary] = useState<AttendanceSummary>({});
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [presentRows, setPresentRows] = useState<EmployeeRow[]>([]);
  const [absentRows, setAbsentRows] = useState<EmployeeRow[]>([]);
  const [lateRows, setLateRows] = useState<EmployeeRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [missedTimeouts, setMissedTimeouts] = useState<MissedTimeout[]>([]);

  const [leaveTab, setLeaveTab] = useState<"leave" | "permission">("leave");
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<"pending" | "approved" | "rejected">(
    "pending"
  );
  const [attendanceFilter, setAttendanceFilter] = useState<"present" | "absent" | "late">("present");
  const [selectedMissedTimeout, setSelectedMissedTimeout] = useState<MissedTimeout | null>(null);
  const [selectedTimeoutTime, setSelectedTimeoutTime] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submittingTimeout, setSubmittingTimeout] = useState(false);
  const [liveTime, setLiveTime] = useState("");
  const [liveDate, setLiveDate] = useState("");
  const [liveWeekday, setLiveWeekday] = useState("");
  const previousPendingCountRef = useRef<number | null>(null);
  const notificationBootstrappedRef = useRef(false);

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const forceLogout = useCallback(async () => {
    clearInactivityTimer();
    await logout();
    Alert.alert("Session expired", "You were logged out after 5 minutes of inactivity.");
    router.replace("/AdminLogin");
  }, [clearInactivityTimer, logout, router]);

  const resetInactivityTimer = useCallback(() => {
    if (!isAdminSession) return;
    clearInactivityTimer();
    inactivityTimerRef.current = setTimeout(() => {
      forceLogout();
    }, AUTO_LOGOUT_MS);
  }, [clearInactivityTimer, forceLogout, isAdminSession]);

  const setDashboardItemLoading = useCallback((key: DashboardDataKey, value: boolean) => {
    setDashboardLoading((prev) => {
      if (prev[key] === value) {
        return prev;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const requestPermission = async () => {
      try {
        const permissions = await Notifications.getPermissionsAsync();
        if (!permissions.granted) {
          await Notifications.requestPermissionsAsync();
        }
      } catch (error) {
        console.warn("Notification permission request failed:", error);
      }
    };

    requestPermission();
  }, []);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setLiveTime(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setLiveDate(
        now.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      );
      setLiveWeekday(
        now.toLocaleDateString("en-US", {
          weekday: "long",
        })
      );
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (routeAdminClient?.id && (!adminClient || adminClient.id !== routeAdminClient.id)) {
      setAdminClient(routeAdminClient).catch((error) => {
        console.warn("Failed to hydrate admin session from route params:", error);
      });
    }
  }, [adminClient, routeAdminClient, setAdminClient]);

  useEffect(() => {
    if (!authReady) return;
    if (!isAdminSession) {
      const redirectTimer = setTimeout(() => {
        router.replace("/AdminLogin");
      }, 3000);
      return () => clearTimeout(redirectTimer);
    }

    console.timeEnd("navigation");
    console.time("dashboard-render");
    const renderTimer = setTimeout(() => {
      console.timeEnd("dashboard-render");
    }, 0);

    resetInactivityTimer();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        resetInactivityTimer();
      }
    });

    return () => {
      clearTimeout(renderTimer);
      sub.remove();
      clearInactivityTimer();
    };
  }, [authReady, isAdminSession, router, resetInactivityTimer, clearInactivityTimer]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeModule !== "dashboard") {
        setActiveModule("dashboard");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [activeModule]);

  const fetchDashboardData = useCallback(async (showLoader = false) => {
    if (!clientId) {
      setAttendanceLoading(false);
      setRefreshing(false);
      return;
    }

    console.time("dashboard-api-loading");
    if (showLoader) {
      setAttendanceLoading(true);
      (Object.keys(INITIAL_DASHBOARD_LOADING) as DashboardDataKey[]).forEach((key) => {
        setDashboardItemLoading(key, true);
      });
    }

    const requestDashboardData = <T,>(
      key: DashboardDataKey,
      path: string,
      applyData: (data: T) => void
    ) => {
      const timerLabel = `dashboard-api-${key}`;
      console.time(timerLabel);
      return axios
        .get<T>(buildApiUrl(path, { clientId }), { timeout: DASHBOARD_API_TIMEOUT_MS })
        .then((res) => {
          applyData(res.data);
        })
        .catch((error) => {
          console.warn(`Admin dashboard ${key} request failed`, error);
          throw error;
        })
        .finally(() => {
          console.timeEnd(timerLabel);
          setDashboardItemLoading(key, false);
        });
    };

    try {
      const dashboardTasks = [
        requestDashboardData<EmployeeRow[]>("present", "/api/attendance/today-timein", (data) =>
          setPresentRows(Array.isArray(data) ? data : [])
        ),
        requestDashboardData<EmployeeRow[]>("late", "/api/attendance/today-time-in-late", (data) =>
          setLateRows(Array.isArray(data) ? data : [])
        ),
        requestDashboardData<EmployeeRow[]>("absent", "/api/attendance/today-absent", (data) =>
          setAbsentRows(Array.isArray(data) ? data : [])
        ),
        requestDashboardData<AttendanceSummary>("summary", "/api/attendance/summary", (data) =>
          setSummary(data || {})
        ),
        requestDashboardData<EmployeeRow[]>("employees", "/api/employees", (data) =>
          setEmployees(Array.isArray(data) ? data : [])
        ),
        requestDashboardData<LeaveRequest[]>("leaves", "/api/leaves/all", (data) =>
          setLeaves(Array.isArray(data) ? data : [])
        ),
        requestDashboardData<MissedTimeout[]>("clockout", "/api/attendance/missed-timeout", (data) =>
          setMissedTimeouts(Array.isArray(data) ? data : [])
        ),
      ];

      const results = await Promise.allSettled(dashboardTasks);
      const failedCount = results.filter((result) => result.status === "rejected").length;
      if (failedCount > 0) {
        console.warn(`Admin dashboard loaded with ${failedCount} failed request(s).`);
      }
    } catch (error) {
      console.error("Admin dashboard load failed", error);
      Alert.alert("Error", "Failed to load admin dashboard data.");
    } finally {
      setAttendanceLoading(false);
      setRefreshing(false);
      console.timeEnd("dashboard-api-loading");
    }
  }, [clientId, setDashboardItemLoading]);

  useEffect(() => {
    if (!clientId || !isAdminSession) return;
    fetchDashboardData(false);
  }, [clientId, isAdminSession, fetchDashboardData]);

  useEffect(() => {
    const pendingCount = leaves.filter(
      (item) => String(item.status || "").toLowerCase() === "pending"
    ).length;

    if (!notificationBootstrappedRef.current) {
      notificationBootstrappedRef.current = true;
      previousPendingCountRef.current = pendingCount;
      return;
    }

    const previousCount = previousPendingCountRef.current ?? 0;
    if (pendingCount > previousCount) {
      const delta = pendingCount - previousCount;
      Notifications.scheduleNotificationAsync({
        content: {
          title: "🔔 New Leave/Permission Request",
          body:
            delta === 1
              ? "📩 You have 1 new pending request."
              : `📩 You have ${delta} new pending requests.`,
        },
        trigger: null,
      }).catch((error) => {
        console.warn("Failed to schedule admin notification:", error);
      });
    }
    previousPendingCountRef.current = pendingCount;
  }, [leaves]);

  const onRefresh = () => {
    resetInactivityTimer();
    setRefreshing(true);
    fetchDashboardData(true);
  };

  const employeeLookup = useMemo(() => {
    const byId = new Map<string, EmployeeRow>();
    const byNameAndBranch = new Map<string, EmployeeRow>();
    employees.forEach((employee) => {
      const id = employee.id ?? employee.employeeId;
      if (id != null) {
        byId.set(String(id), employee);
      }
      const firstName = String(employee.firstName || employee.name || "").trim().toLowerCase();
      const branch = String(employee.branch || "").trim().toLowerCase();
      if (firstName) {
        byNameAndBranch.set(`${firstName}|${branch}`, employee);
      }
    });
    return { byId, byNameAndBranch };
  }, [employees]);

  const formatAdminEmployeeName = useCallback(
    (row: EmployeeRow, fallback: string) => {
      const id = row.id ?? row.employeeId;
      const directoryMatch =
        id != null
          ? employeeLookup.byId.get(String(id))
          : employeeLookup.byNameAndBranch.get(
              `${String(row.firstName || row.name || "").trim().toLowerCase()}|${String(row.branch || "").trim().toLowerCase()}`
            );
      return formatPersonName(
        {
          firstName: row.firstName || directoryMatch?.firstName,
          lastName: row.lastName || directoryMatch?.lastName,
          name: row.name || directoryMatch?.name,
        },
        fallback
      );
    },
    [employeeLookup]
  );

  const leaveRequestsByTabAndStatus = useMemo(() => {
    let filtered = [...leaves];
    if (leaveTab === "permission") {
      filtered = filtered.filter(
        (item) => String(item.leaveType || "").toLowerCase() === "permission"
      );
    } else {
      filtered = filtered.filter(
        (item) => String(item.leaveType || "").toLowerCase() !== "permission"
      );
    }
    filtered = filtered.filter(
      (item) => String(item.status || "").toLowerCase() === leaveStatusFilter
    );
    return filtered.sort((a, b) => {
      return (b.id || 0) - (a.id || 0);
    });
  }, [leaves, leaveTab, leaveStatusFilter]);

  const handleLeaveStatus = async (leaveId: number, status: "approved" | "rejected") => {
    if (!clientId) return;
    resetInactivityTimer();
    const previousLeaves = [...leaves];
    setLeaves((prev) =>
      prev.map((item) =>
        item.id === leaveId ? { ...item, status } : item
      )
    );
    try {
      await axios.put(
        buildApiUrl(`/api/leaves/status/${leaveId}`, {
          clientId,
          query: { status },
        }),
        {}
      );
      await fetchDashboardData();
    } catch (error) {
      setLeaves(previousLeaves);
      console.error("Leave status update failed", error);
      Alert.alert(
        "Error",
        getApiErrorMessage(error, `Unable to mark request as ${status}.`)
      );
    }
  };

  const handleOpenCompleteTimeout = (item: MissedTimeout) => {
    resetInactivityTimer();
    if (isTodayDDMMYYYY(item.date)) {
      Alert.alert("Not allowed", "Today's clock-out request cannot be completed yet.");
      return;
    }
    setSelectedMissedTimeout(item);
    setSelectedTimeoutTime(new Date());
  };

  const buildTimeOutFromDateAndTime = (recordDate?: string, time?: Date) => {
    if (!recordDate || !time) return null;
    const [day, month, year] = recordDate.split("/").map(Number);
    if (!day || !month || !year) return null;
    const merged = new Date(
      year,
      month - 1,
      day,
      time.getHours(),
      time.getMinutes(),
      time.getSeconds()
    );
    return formatLocalDateTime(merged);
  };

  const handleSubmitCompleteTimeout = async () => {
    if (!clientId || !selectedMissedTimeout) return;
    resetInactivityTimer();

    const timeOut = buildTimeOutFromDateAndTime(selectedMissedTimeout.date, selectedTimeoutTime);
    if (!timeOut) {
      Alert.alert("Invalid date", "Unable to parse request date for timeout completion.");
      return;
    }

    try {
      setSubmittingTimeout(true);
      await axios.put(
        buildApiUrl("/api/attendance/complete-missed-timeout", {
          clientId,
          query: {
            attendanceId: selectedMissedTimeout.attendanceId,
            timeOut,
          },
        }),
        {}
      );
      setSelectedMissedTimeout(null);
      await fetchDashboardData();
    } catch (error) {
      console.error("Complete missed timeout failed", error);
      Alert.alert("Error", "Unable to complete clock-out request.");
    } finally {
      setSubmittingTimeout(false);
    }
  };

  const onTimeChange = (_event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (value) {
      setSelectedTimeoutTime(value);
    }
  };

  const formatDisplayTime = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString();
  };

  const renderHeader = (title: string, subtitle?: string, showLogout = false) => (
    <View
      style={[
        styles.header,
        isDark && { backgroundColor: "#1f2937", borderWidth: 1, borderColor: colors.border },
      ]}
    >
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, isDark && { color: "#cbd5e1" }]}>{subtitle}</Text> : null}
      </View>
      {showLogout ? (
        <TouchableOpacity
          style={[
            styles.logoutButton,
            isDark && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
          ]}
          onPress={async () => {
            resetInactivityTimer();
            await logout();
            router.replace("/AdminLogin");
          }}
        >
          <Text style={[styles.logoutText, { color: colors.primary }]}>Logout</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderListItem = (title: string, meta: string, extra?: string) => (
    <View
      style={[
        styles.listCard,
        isDark && { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      key={`${title}-${meta}-${extra || ""}`}
    >
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.cardText, { color: colors.mutedText }]}>{meta}</Text>
      {extra ? <Text style={[styles.cardText, { color: colors.mutedText }]}>{extra}</Text> : null}
    </View>
  );

  const renderDashboardCards = () => {
    const greeting = getGreetingLabel(new Date().getHours());
    const pendingRequests = leaves.filter((item) => String(item.status || "").toLowerCase() === "pending").length;
    const cards = [
      {
        key: "employees" as ModuleKey,
        loadingKey: "employees" as DashboardDataKey,
        value: summary.totalEmployees ?? employees.length ?? 0,
        title: "Employees",
        hint: "United as one team",
        accent: "#5B2A8F",
        bubble: "#EFE8F8",
        icon: <Ionicons name="people" size={22} color="#5B2A8F" />,
      },
      {
        key: "ontime" as ModuleKey,
        loadingKey: "present" as DashboardDataKey,
        value: summary.presentToday ?? presentRows.length ?? 0,
        title: "Present",
        hint: "Consistency builds rhythm",
        accent: "#0FA67B",
        bubble: "#E5F7F2",
        icon: <FontAwesome5 name="user-check" size={19} color="#0FA67B" />,
      },
      {
        key: "absent" as ModuleKey,
        loadingKey: "absent" as DashboardDataKey,
        value: absentRows.length > 0 ? absentRows.length : summary.absentToday ?? 0,
        title: "Absent",
        hint: "Track daily attendance gaps",
        accent: "#E3345B",
        bubble: "#FDE8EE",
        icon: <MaterialCommunityIcons name="calendar-remove-outline" size={22} color="#E3345B" />,
      },
      {
        key: "late" as ModuleKey,
        loadingKey: "late" as DashboardDataKey,
        value: summary.lateArrivalsToday ?? lateRows.length ?? 0,
        title: "Late Arrival",
        hint: "Punctuality drives momentum",
        accent: "#F59E0B",
        bubble: "#FEF4E5",
        icon: <Feather name="clock" size={21} color="#F59E0B" />,
      },
      {
        key: "leavePermission" as ModuleKey,
        loadingKey: "leaves" as DashboardDataKey,
        value: pendingRequests,
        title: "Leave & Permission",
        hint: "Review and decide quickly",
        accent: "#1976D2",
        bubble: "#E7F1FD",
        icon: <MaterialCommunityIcons name="file-document-edit-outline" size={21} color="#1976D2" />,
      },
      {
        key: "clockout" as ModuleKey,
        loadingKey: "clockout" as DashboardDataKey,
        value: missedTimeouts.length,
        title: "Clock-Out Request",
        hint: "Complete missed clock-outs",
        accent: "#5B2A8F",
        bubble: "#EFE8F8",
        icon: <Ionicons name="timer-outline" size={21} color="#5B2A8F" />,
      },
    ];

    return (
      <>
        <View style={styles.templateHeroShell}>
          <LinearGradient
            colors={[colors.primary, "#6B32D8", "#4E1FC5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.templateHero, isDark && { borderColor: "#5b21b6" }]}
          >
            <View style={styles.templateHeroGlow} />
            <View style={styles.templateHeroRow}>
              <View>
                <Text style={styles.templateHeroTitle}>Admin Dashboard</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.templateLogoutButton,
                  isDark && { backgroundColor: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.35)" },
                ]}
                onPress={async () => {
                  resetInactivityTimer();
                  await logout();
                  router.replace("/AdminLogin");
                }}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.primary} />
                <Text style={[styles.templateLogoutText, { color: colors.primary }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
          <View style={[styles.templateCurve, { backgroundColor: colors.background }]} />
        </View>

        <View style={[styles.templateRealtimeCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.templateRealtimeTop}>
            <View style={styles.templateRealtimeInfo}>
              <Ionicons name="time-outline" size={28} color={colors.primary} />
              <View>
                <Text style={[styles.templateRealtimeValue, { color: colors.text }]}>{liveTime}</Text>
                <Text style={[styles.templateRealtimeLabel, { color: colors.mutedText }]}>Realtime Insight</Text>
              </View>
            </View>
            <View style={[styles.templateRealtimeDivider, { backgroundColor: colors.border }]} />
            <View style={styles.templateRealtimeInfo}>
              <MaterialCommunityIcons name="calendar-month-outline" size={28} color={colors.primary} />
              <View>
                <Text style={[styles.templateRealtimeValue, { color: colors.text }]}>{liveDate}</Text>
                <Text style={[styles.templateRealtimeLabel, { color: colors.mutedText }]}>{liveWeekday || "-"}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.templateAttendanceButton}
            onPress={() => {
              setAttendanceFilter("present");
              setActiveModule("attendance");
            }}
          >
            <LinearGradient
              colors={[colors.primary, "#5A24C8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.templateAttendanceButtonGradient}
            >
              <Feather name="eye" size={20} color="#ffffff" />
              <Text style={styles.templateAttendanceButtonText}>View Attendance</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.greetingRow}>
          <View style={styles.greetingTextBlock}>
            <Text style={[styles.greetingTitle, { color: colors.text }]}>{greeting}</Text>
          </View>
          <TouchableOpacity
            style={[styles.notificationButton, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setActiveModule("leavePermission")}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            {pendingRequests > 0 ? <View style={styles.notificationDot} /> : null}
          </TouchableOpacity>
        </View>

        <View style={styles.templateGrid}>
          {cards.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.templateStatCard, isDark && { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setActiveModule(item.key)}
            >
              <View style={styles.templateStatTop}>
                <View style={[styles.templateIconWrap, { backgroundColor: item.bubble }]}>{item.icon}</View>
                {dashboardLoading[item.loadingKey] ? (
                  <ActivityIndicator size="small" color={item.accent} />
                ) : (
                  <Text style={[styles.templateStatValue, { color: colors.text }]}>{item.value}</Text>
                )}
              </View>
              <Text style={[styles.templateStatLabel, { color: item.accent }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[styles.templateStatHint, { color: colors.mutedText }]} numberOfLines={2}>
                {item.hint}
              </Text>
              <View style={[styles.templateForwardBubble, { backgroundColor: item.bubble }]}>
                <Ionicons name="chevron-forward" size={18} color={item.accent} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  };

  const renderEmployees = () => (
    <>
      {renderHeader("Employees")}
      {employees.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>No employees found.</Text>
      ) : (
        employees.map((row, idx) =>
          renderListItem(
            formatAdminEmployeeName(row, `Employee ${idx + 1}`),
            `Branch: ${row.branch || "-"}`,
            `Mobile: ${row.mobile || "-"}`
          )
        )
      )}
    </>
  );

  const renderOnTime = () => (
    <>
      {renderHeader("Present Employees")}
      {attendanceLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.inlineLoader} />
      ) : presentRows.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>No present records for today.</Text>
      ) : (
        presentRows.map((row, idx) =>
          renderListItem(
            formatAdminEmployeeName(row, `Employee ${idx + 1}`),
            `Branch: ${row.branch || "-"}`,
            `Time In: ${formatDisplayTime(row.timeIn)}`
          )
        )
      )}
    </>
  );

  const renderAttendance = () => {
    const tabs = [
      { key: "present" as const, label: "Present", count: presentRows.length },
      { key: "absent" as const, label: "Absent", count: absentRows.length },
      { key: "late" as const, label: "Late", count: lateRows.length },
    ];

    let rows: EmployeeRow[] = [];
    let emptyMessage = "No records found.";
    if (attendanceFilter === "present") {
      rows = presentRows;
      emptyMessage = "No present records for today.";
    } else if (attendanceFilter === "absent") {
      rows = absentRows;
      emptyMessage = "No absent records for today.";
    } else {
      rows = lateRows;
      emptyMessage = "No late arrivals for today.";
    }

    return (
      <>
        {renderHeader("Today Attendance")}

        <View style={styles.statusFilterRow}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.statusFilterButton,
                isDark && { backgroundColor: colors.surface, borderColor: colors.border },
                attendanceFilter === tab.key && styles.activeStatusFilterButton,
              ]}
              onPress={() => setAttendanceFilter(tab.key)}
            >
              <Text
                style={[
                  styles.statusFilterText,
                  { color: isDark ? colors.mutedText : "#444" },
                  attendanceFilter === tab.key && styles.activeStatusFilterText,
                ]}
              >
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {attendanceLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.inlineLoader} />
        ) : rows.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedText }]}>{emptyMessage}</Text>
        ) : (
          rows.map((row, idx) => {
            const name = formatAdminEmployeeName(row, `Employee ${idx + 1}`);
            if (attendanceFilter === "present") {
              return renderListItem(
                name,
                `Branch: ${row.branch || "-"}`,
                `Time In: ${formatDisplayTime(row.timeIn)}`
              );
            }
            if (attendanceFilter === "absent") {
              return renderListItem(
                name,
                `Branch: ${row.branch || "-"}`,
                `Mobile: ${row.mobile || "-"}`
              );
            }
            return renderListItem(
              name,
              `Branch: ${row.branch || "-"}`,
              `Late Minutes: ${row.lateMinutes ?? 0}`
            );
          })
        )}
      </>
    );
  };

  const renderAbsent = () => (
    <>
      {renderHeader("Absent Employees")}
      {attendanceLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.inlineLoader} />
      ) : absentRows.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>No absent records for today.</Text>
      ) : (
        absentRows.map((row, idx) =>
          renderListItem(
            formatAdminEmployeeName(row, `Employee ${idx + 1}`),
            `Branch: ${row.branch || "-"}`,
            `Mobile: ${row.mobile || "-"}`
          )
        )
      )}
    </>
  );

  const renderLate = () => (
    <>
      {renderHeader("Late Arrival")}
      {attendanceLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.inlineLoader} />
      ) : lateRows.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>No late arrivals for today.</Text>
      ) : (
        lateRows.map((row, idx) =>
          renderListItem(
            formatAdminEmployeeName(row, `Employee ${idx + 1}`),
            `Branch: ${row.branch || "-"}`,
            `Late Minutes: ${row.lateMinutes ?? 0}`
          )
        )
      )}
    </>
  );

  const renderLeavePermission = () => (
    <>
      {renderHeader("Leave & Permission")}

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            isDark && { backgroundColor: colors.surface, borderColor: colors.border },
            leaveTab === "leave" && styles.activeTabButton,
          ]}
          onPress={() => setLeaveTab("leave")}
        >
          <Text
            style={[
              styles.tabText,
              { color: isDark ? colors.mutedText : "#444" },
              leaveTab === "leave" && styles.activeTabText,
            ]}
          >
            Leave
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            isDark && { backgroundColor: colors.surface, borderColor: colors.border },
            leaveTab === "permission" && styles.activeTabButton,
          ]}
          onPress={() => setLeaveTab("permission")}
        >
          <Text
            style={[
              styles.tabText,
              { color: isDark ? colors.mutedText : "#444" },
              leaveTab === "permission" && styles.activeTabText,
            ]}
          >
            Permission
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusFilterRow}>
        {(["pending", "approved", "rejected"] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.statusFilterButton,
              isDark && { backgroundColor: colors.surface, borderColor: colors.border },
              leaveStatusFilter === status && styles.activeStatusFilterButton,
            ]}
            onPress={() => setLeaveStatusFilter(status)}
          >
            <Text
              style={[
                styles.statusFilterText,
                { color: isDark ? colors.mutedText : "#444" },
                leaveStatusFilter === status && styles.activeStatusFilterText,
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {leaveRequestsByTabAndStatus.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>No {leaveStatusFilter} requests found.</Text>
      ) : (
        leaveRequestsByTabAndStatus.map((item) => (
          <View
            key={item.id}
            style={[
              styles.listCard,
              isDark && { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {formatPersonName(item.employee)}
            </Text>
            <Text style={[styles.cardText, { color: colors.mutedText }]}>Type: {item.leaveType || "-"}</Text>
            <Text style={[styles.cardText, { color: colors.mutedText }]}>
              Status: {String(item.status || "-").toUpperCase()}
            </Text>
            <Text style={[styles.cardText, { color: colors.mutedText }]}>
              Date: {item.startDate || item.date || "-"} {item.endDate ? `to ${item.endDate}` : ""}
            </Text>
            {item.startTime || item.endTime ? (
              <Text style={[styles.cardText, { color: colors.mutedText }]}>
                Time: {item.startTime || "-"} to {item.endTime || "-"}
              </Text>
            ) : null}
            <Text style={[styles.cardText, { color: colors.mutedText }]}>Reason: {item.reason || "-"}</Text>
            {leaveStatusFilter === "pending" ? (
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => handleLeaveStatus(item.id, "approved")}
                >
                  <Text style={styles.smallButtonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallDangerButton}
                  onPress={() => handleLeaveStatus(item.id, "rejected")}
                >
                  <Text style={styles.smallButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))
      )}
    </>
  );

  const renderClockout = () => (
    <>
      {renderHeader("Clock-Out Requests")}

      {missedTimeouts.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>No pending clock-out requests.</Text>
      ) : (
        missedTimeouts.map((item) => (
          <View
            key={item.attendanceId}
            style={[
              styles.listCard,
              isDark && { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>{formatPersonName(item)}</Text>
            <Text style={[styles.cardText, { color: colors.mutedText }]}>Date: {item.date || "-"}</Text>
            <Text style={[styles.cardText, { color: colors.mutedText }]}>Branch: {item.branch || "-"}</Text>
            <Text style={[styles.cardText, { color: colors.mutedText }]}>Reason: {item.timeoutReason || "-"}</Text>
            <TouchableOpacity
              style={[styles.actionButton, isTodayDDMMYYYY(item.date) && styles.disabledButton]}
              onPress={() => handleOpenCompleteTimeout(item)}
              disabled={isTodayDDMMYYYY(item.date)}
            >
              <Text style={styles.actionText}>
                {isTodayDDMMYYYY(item.date) ? "Cannot complete today" : "Complete"}
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </>
  );

  const renderActiveModule = () => {
    if (activeModule === "attendance") return renderAttendance();
    if (activeModule === "employees") return renderEmployees();
    if (activeModule === "ontime") return renderOnTime();
    if (activeModule === "absent") return renderAbsent();
    if (activeModule === "late") return renderLate();
    if (activeModule === "leavePermission") return renderLeavePermission();
    if (activeModule === "clockout") return renderClockout();
    return renderDashboardCards();
  };

  if (!authReady && !routeAdminClient?.id) {
    return (
      <SafeAreaView style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!isAdminSession) {
    return (
      <SafeAreaView style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onTouchStart={resetInactivityTimer}
      >
        {renderActiveModule()}

        <Modal
          visible={!!selectedMissedTimeout}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedMissedTimeout(null)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalCard,
                isDark && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.primary }]}>Complete Clock-Out Request</Text>
              <Text style={[styles.modalText, { color: colors.text }]}>
                Employee: {formatPersonName(selectedMissedTimeout, "-")}
              </Text>
              <Text style={[styles.modalText, { color: colors.text }]}>Date: {selectedMissedTimeout?.date || "-"}</Text>

              <TouchableOpacity
                style={[styles.secondaryActionButton, { borderColor: colors.primary }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={[styles.secondaryActionText, { color: colors.primary }]}>
                  Select Time: {selectedTimeoutTime.toLocaleTimeString()}
                </Text>
              </TouchableOpacity>

              {showTimePicker ? (
                <DateTimePicker
                  value={selectedTimeoutTime}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onTimeChange}
                />
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalCancelButton, isDark && { borderColor: colors.border }]}
                  onPress={() => setSelectedMissedTimeout(null)}
                >
                  <Text style={[styles.modalCancelText, { color: colors.mutedText }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSubmitButton,
                    { backgroundColor: colors.primary },
                    submittingTimeout && styles.disabledButton,
                  ]}
                  disabled={submittingTimeout}
                  onPress={handleSubmitCompleteTimeout}
                >
                  <Text style={styles.modalSubmitText}>
                    {submittingTimeout ? "Submitting..." : "Submit"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F2F3F8",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  content: {
    padding: 14,
    paddingBottom: 24,
  },
  templateHeroShell: {
    marginHorizontal: -14,
    marginBottom: 16,
  },
  templateHero: {
    paddingTop: 26,
    paddingBottom: 70,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: "hidden",
  },
  templateHeroGlow: {
    position: "absolute",
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(255,255,255,0.12)",
    right: 120,
    top: 64,
  },
  templateHeroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  templateHeroTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },
  templateHeroSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    marginTop: 4,
  },
  templateLogoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  templateLogoutText: {
    fontSize: 14,
    fontWeight: "700",
  },
  templateCurve: {
    position: "absolute",
    left: -24,
    right: -24,
    bottom: -36,
    height: 86,
    borderRadius: 999,
  },
  templateRealtimeCard: {
    marginTop: -80,
    marginBottom: 18,
    marginHorizontal: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ECECF2",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  templateRealtimeTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  templateRealtimeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
  },
  templateRealtimeDivider: {
    width: 1,
    height: 58,
    marginHorizontal: 8,
  },
  templateRealtimeValue: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  templateRealtimeLabel: {
    fontSize: 15,
  },
  templateAttendanceButton: {
    borderRadius: 999,
    overflow: "hidden",
  },
  templateAttendanceButtonGradient: {
    borderRadius: 999,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  templateAttendanceButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  greetingTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  greetingSubtitle: {
    marginTop: 4,
    fontSize: 15,
  },
  notificationButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ECECF2",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 11,
    right: 11,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6B32D8",
  },
  templateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  templateStatCard: {
    width: "48.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ECECF2",
    padding: 12,
    minHeight: 150,
  },
  templateStatTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  templateIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  templateStatValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  templateStatLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 3,
  },
  templateStatHint: {
    fontSize: 13,
    lineHeight: 18,
    paddingRight: 8,
  },
  templateForwardBubble: {
    alignSelf: "flex-end",
    marginTop: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    backgroundColor: "#2C0F47",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: "#D9C5F6",
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: "#351153",
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: "#3A1361",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#4E2279",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  heroTimeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroDateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroTime: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  heroDate: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  heroSub: {
    color: "#D9C5F6",
    marginBottom: 10,
    fontWeight: "600",
  },
  heroButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  heroButtonText: {
    color: "#3A1361",
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  gridCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ECECF2",
    padding: 14,
    minHeight: 110,
  },
  gridIconBubble: {
    alignSelf: "flex-end",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EFE8F8",
    alignItems: "center",
    justifyContent: "center",
  },
  gridValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E1E1E",
    marginBottom: 2,
    marginTop: 4,
  },
  gridLabel: {
    color: "#2E2E2E",
    fontWeight: "600",
    marginBottom: 4,
  },
  gridHint: {
    color: "#8A8A97",
    fontSize: 11,
  },
  listCard: {
    borderWidth: 1,
    borderColor: "#EDEDED",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    color: "#222",
  },
  cardText: {
    color: "#555",
    marginBottom: 4,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  smallButton: {
    backgroundColor: "#2E7D32",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallDangerButton: {
    backgroundColor: "#C62828",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  actionButton: {
    backgroundColor: "#351153",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 8,
  },
  actionText: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyText: {
    color: "#666",
    marginTop: 8,
  },
  inlineLoader: {
    marginTop: 18,
  },
  emptyTextSmall: {
    color: "#7A7685",
    marginBottom: 8,
    fontSize: 12,
  },
  statusSection: {
    marginBottom: 10,
  },
  statusSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2C0F47",
    marginBottom: 8,
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#C8C4D3",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  activeTabButton: {
    backgroundColor: "#351153",
    borderColor: "#351153",
  },
  tabText: {
    color: "#444",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#fff",
  },
  statusFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statusFilterButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#C8C4D3",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  activeStatusFilterButton: {
    backgroundColor: "#2C0F47",
    borderColor: "#2C0F47",
  },
  statusFilterText: {
    color: "#444",
    fontWeight: "600",
    fontSize: 11,
  },
  activeStatusFilterText: {
    color: "#fff",
  },
  attendanceSection: {
    marginBottom: 12,
  },
  attendanceSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2C0F47",
    marginBottom: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#351153",
    marginBottom: 10,
  },
  modalText: {
    color: "#444",
    marginBottom: 8,
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: "#351153",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginVertical: 8,
  },
  secondaryActionText: {
    color: "#351153",
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#777",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#555",
    fontWeight: "700",
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: "#351153",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalSubmitText: {
    color: "#fff",
    fontWeight: "700",
  },
});

