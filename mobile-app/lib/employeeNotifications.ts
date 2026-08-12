import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

type EmployeeLike = {
  id?: string | number;
  firstName?: unknown;
  name?: unknown;
  username?: unknown;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  weekOff?: string | null;
  leavePolicyType?: string | null;
};

type AttendanceLike = {
  date?: string | null;
  timeIn?: string | null;
  timeOut?: string | null;
  attendanceStatus?: string | null;
  dayStatus?: string | null;
};

function canUseNativeNotifications(): boolean {
  return Platform.OS !== "web";
}

function getTodayKey(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseTimeStringToMinutes(timeValue?: string | null): number | null {
  if (!timeValue) return null;

  const raw = timeValue.trim();
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?:\s*)(AM|PM)$/i);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = Number(ampmMatch[2]);
    const period = ampmMatch[3].toUpperCase();
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  const parts = raw.split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function parseRecordDate(dateValue?: string | null): Date | null {
  if (!dateValue) return null;
  const trimmed = dateValue.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const dt = new Date(year, month, day);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]) - 1;
    const year = Number(dmyMatch[3]);
    const dt = new Date(year, month, day);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDisplayName(employee?: EmployeeLike | null): string {
  if (!employee) return "there";
  return (
    String(employee.firstName ?? "").trim() ||
    String(employee.name ?? "").trim() ||
    String(employee.username ?? "").trim() ||
    "there"
  );
}

async function notifyOnce(
  key: string,
  title: string,
  body: string,
  shouldPlaySound = true
): Promise<void> {
  if (!canUseNativeNotifications()) return;

  const sent = await AsyncStorage.getItem(key);
  if (sent === "1") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: shouldPlaySound ? "default" : undefined,
    },
    trigger: null,
  });

  await AsyncStorage.setItem(key, "1");
}

function minutesFromDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseWeekOffDay(raw?: string | null): number | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  if (normalized.startsWith("SUN")) return 0;
  if (normalized.startsWith("MON")) return 1;
  if (normalized.startsWith("TUE")) return 2;
  if (normalized.startsWith("WED")) return 3;
  if (normalized.startsWith("THU")) return 4;
  if (normalized.startsWith("FRI")) return 5;
  if (normalized.startsWith("SAT")) return 6;
  return null;
}

function isScheduledWorkingDay(employee: EmployeeLike | null | undefined, now: Date): boolean {
  if (!employee) return true;
  const policy = String(employee.leavePolicyType ?? "").trim().toUpperCase();
  const weekOff = String(employee.weekOff ?? "").trim().toUpperCase();
  const day = now.getDay(); // 0 Sunday ... 6 Saturday

  const weekendOff =
    policy.includes("WEEKEND") ||
    (policy.includes("SAT") && policy.includes("SUN")) ||
    (weekOff.includes("SAT") && weekOff.includes("SUN"));

  if (weekendOff) {
    return day !== 0 && day !== 6;
  }

  const singleWeekOff = parseWeekOffDay(employee.weekOff);
  if (singleWeekOff == null) {
    // Existing backend default is Sunday week off.
    return day !== 0;
  }
  return day !== singleWeekOff;
}

function isLeaveAttendance(attendance: AttendanceLike | null): boolean {
  const status = String(attendance?.attendanceStatus ?? "").trim().toLowerCase();
  const dayStatus = String(attendance?.dayStatus ?? "").trim().toLowerCase();
  return (
    status === "leave" ||
    status === "on leave" ||
    dayStatus.includes("leave approved")
  );
}

function reminderIdKey(
  type: "timeIn" | "timeOut",
  employeeId: string | number,
  dayKey: string
): string {
  return `notif:reminder:id:${type}:${employeeId}:${dayKey}`;
}

async function cancelReminder(
  type: "timeIn" | "timeOut",
  employeeId: string | number,
  dayKey: string
): Promise<void> {
  if (!canUseNativeNotifications()) return;

  const key = reminderIdKey(type, employeeId, dayKey);
  const id = await AsyncStorage.getItem(key);
  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Ignore if already delivered/removed.
    }
    await AsyncStorage.removeItem(key);
  }
}

async function scheduleReminder(
  type: "timeIn" | "timeOut",
  employeeId: string | number,
  triggerDate: Date,
  title: string,
  body: string,
  dayKey: string
): Promise<void> {
  if (!canUseNativeNotifications()) return;

  const key = reminderIdKey(type, employeeId, dayKey);
  const existing = await AsyncStorage.getItem(key);
  if (existing) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  await AsyncStorage.setItem(key, id);
}

export async function notifyEmployeeLogin(
  employee: EmployeeLike,
  now = new Date()
): Promise<void> {
  if (!employee?.id) return;

  const employeeId = employee.id;
  const dayKey = getTodayKey(now);
  const welcomeKey = `notif:sent:welcome:${employeeId}:${dayKey}`;
  await notifyOnce(welcomeKey, "👋 Hi", "Welcome to ZenTime");

  const shiftStartMinutes = parseTimeStringToMinutes(employee.shiftStartTime);
  if (shiftStartMinutes == null) return;

  const nowMinutes = minutesFromDate(now);
  if (nowMinutes < shiftStartMinutes) {
    const earlyKey = `notif:sent:early:${employeeId}:${dayKey}`;
    const name = toDisplayName(employee);
    await notifyOnce(
      earlyKey,
      "🐦 Early Bird",
      `Hey ${name}, you are an early bird!`
    );
  }
}

export async function syncAttendanceNotifications(params: {
  employee: EmployeeLike | null | undefined;
  attendance: AttendanceLike | null;
  now?: Date;
  isWorkingDay?: boolean;
  onLeaveToday?: boolean;
}): Promise<void> {
  const { employee, attendance } = params;
  const now = params.now ?? new Date();

  if (!employee?.id) return;

  const employeeId = employee.id;
  const dayKey = getTodayKey(now);
  const isWorkingDay =
    params.isWorkingDay !== undefined
      ? params.isWorkingDay
      : isScheduledWorkingDay(employee, now);
  const onLeaveToday = Boolean(params.onLeaveToday) || isLeaveAttendance(attendance);

  if (!isWorkingDay || onLeaveToday) {
    await cancelReminder("timeIn", employeeId, dayKey);
    await cancelReminder("timeOut", employeeId, dayKey);
    return;
  }

  const shiftStartMinutes = parseTimeStringToMinutes(employee.shiftStartTime);
  const shiftEndMinutes = parseTimeStringToMinutes(employee.shiftEndTime);
  const nowMinutes = minutesFromDate(now);

  const recordDate = parseRecordDate(attendance?.date);
  const todayRecord = recordDate ? isSameDay(recordDate, now) : false;
  const hasTimeIn = Boolean(attendance?.timeIn) && todayRecord;
  const hasTimeOut = Boolean(attendance?.timeOut) && todayRecord;

  if (shiftStartMinutes != null) {
    const shiftStart = new Date(now);
    shiftStart.setHours(Math.floor(shiftStartMinutes / 60), shiftStartMinutes % 60, 0, 0);
    if (shiftStart.getTime() > now.getTime()) {
      await scheduleReminder(
        "timeIn",
        employeeId,
        shiftStart,
        "⏰ Attendance Reminder",
        "Your attendance is not marked ⏰",
        dayKey
      );
    }
    if (hasTimeIn) {
      await cancelReminder("timeIn", employeeId, dayKey);
    }
  }

  if (shiftEndMinutes != null) {
    const shiftEnd = new Date(now);
    shiftEnd.setHours(Math.floor(shiftEndMinutes / 60), shiftEndMinutes % 60, 0, 0);
    if (shiftEnd.getTime() > now.getTime()) {
      await scheduleReminder(
        "timeOut",
        employeeId,
        shiftEnd,
        "🕒 Time-Out Reminder",
        "Your time-out is not marked 🕒",
        dayKey
      );
    }
    if (hasTimeOut) {
      await cancelReminder("timeOut", employeeId, dayKey);
    }
  }

  if (hasTimeIn && attendance?.timeIn && shiftStartMinutes != null) {
    const timeInDate = new Date(attendance.timeIn);
    if (!Number.isNaN(timeInDate.getTime()) && isSameDay(timeInDate, now)) {
      const timeInMinutes = minutesFromDate(timeInDate);
      if (timeInMinutes > shiftStartMinutes) {
        const lateKey = `notif:sent:late:${employeeId}:${dayKey}`;
        await notifyOnce(lateKey, "😬 Oops", "Oops, you are late 😬");
      }
    }
  }

  if (shiftStartMinutes != null && nowMinutes >= shiftStartMinutes && !hasTimeIn) {
    const missingInKey = `notif:sent:missing-in:${employeeId}:${dayKey}`;
    await notifyOnce(
      missingInKey,
      "⏰ Attendance Reminder",
      "Your attendance is not marked ⏰"
    );
  }

  if (
    shiftEndMinutes != null &&
    nowMinutes >= shiftEndMinutes &&
    hasTimeIn &&
    !hasTimeOut
  ) {
    const missingOutKey = `notif:sent:missing-out:${employeeId}:${dayKey}`;
    await notifyOnce(
      missingOutKey,
      "🕒 Time-Out Reminder",
      "Your time-out is not marked 🕒"
    );
  }
}
