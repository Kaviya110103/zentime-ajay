
import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Box,
  Grid,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  IconButton,
  useTheme,
  useMediaQuery,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Radio,
  RadioGroup,
  Chip,
} from "@mui/material";

import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { getMonth, getYear, format, parseISO, isValid, parse } from "date-fns";
import PrintIcon from "@mui/icons-material/Print";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import PhoneIcon from "@mui/icons-material/Phone";
import BusinessIcon from "@mui/icons-material/Business";
import WorkIcon from "@mui/icons-material/Work";
import EmailIcon from "@mui/icons-material/Email";
import Avatar from "@mui/material/Avatar";
import { API_BASE_URL, resolveBackendAssetUrl } from "../config/api";

function EmployeePayrollViewer() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const SHOW_PF_SECTION = false;
  const defaultPaymentDetails = {
    convenience: 0,
    ot: 0,
    lop: 0,
    incentives: 0,
    advance: 0,
    others: 0,
    pfAmount: 0,
    pfPercentage: 0,
  };

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [employeeId, setEmployeeId] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [employeeDirectory, setEmployeeDirectory] = useState([]);
  const [netSalary, setNetSalary] = useState(null);
  const [calculationDetails, setCalculationDetails] = useState(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const [holidayDateSet, setHolidayDateSet] = useState(new Set());
  const [paymentDetails, setPaymentDetails] = useState({ ...defaultPaymentDetails });
  const [logoFile, setLogoFile] = useState(null);
  const [logoUploaded, setLogoUploaded] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [payslipPreviewOpen, setPayslipPreviewOpen] = useState(false);
  const [payslipPdfUrl, setPayslipPdfUrl] = useState("");
  const [payslipPdfLoading, setPayslipPdfLoading] = useState(false);
  const [includeOvertime, setIncludeOvertime] = useState(true);
  const [applyLateDeduction, setApplyLateDeduction] = useState(true);
  const [payrollSearch, setPayrollSearch] = useState("");
  const [payrollStatusFilter, setPayrollStatusFilter] = useState("");
  const client = JSON.parse(localStorage.getItem("loggedInClient"));
  useEffect(() => {
    setNetSalary(null);
    setCalculationDetails(null);
  }, [paymentDetails, includeOvertime, applyLateDeduction, data]);

  useEffect(() => {
    return () => {
      if (payslipPdfUrl) {
        URL.revokeObjectURL(payslipPdfUrl);
      }
    };
  }, [payslipPdfUrl]);

  const resetPayrollComputation = () => {
    setData(null);
    setNetSalary(null);
    setEmailSent(false);
    setError(null);
    setAttendanceError(null);
    setAttendanceRecords([]);
    setPaymentDetails({ ...defaultPaymentDetails });
    setOpenSnackbar(false);
    setPayslipPreviewOpen(false);
    if (payslipPdfUrl) {
      URL.revokeObjectURL(payslipPdfUrl);
    }
    setPayslipPdfUrl("");
    setPayslipPdfLoading(false);
    setIncludeOvertime(true);
    setApplyLateDeduction(true);
  };

  const normalizeEmployeeIdRef = (value) => {
    const normalized = (value || "").trim();
    if (!normalized) return "";
    if (/^\d+$/.test(normalized)) return normalized;
    const match = normalized.match(/(?:^|\.)EMP(\d+)$/i);
    if (match?.[1]) return match[1];
    return normalized;
  };

  const getEmployeeDisplayName = (employee) => {
    if (!employee) return "Unnamed Employee";
    const firstName = String(employee.firstName || "").trim();
    const lastName = String(employee.lastName || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;
    const fallbackName = String(employee.name || "").trim();
    if (fallbackName) return fallbackName;
    return "Unnamed Employee";
  };

  const getEmployeeLookupValue = (employee) => {
    if (!employee) return "";
    const preferredValue =
      employee.employeeId ??
      employee.id ??
      employee.employeeCode ??
      employee.code;
    return preferredValue == null ? "" : String(preferredValue).trim();
  };

  const employeeNameOptions = useMemo(() => {
    const unique = new Map();
    employeeDirectory
      .filter((employee) => {
        if (!selectedBranch) return true;
        return String(employee?.branch || "").trim().toLowerCase()
          === String(selectedBranch).trim().toLowerCase();
      })
      .forEach((employee) => {
      const value = getEmployeeLookupValue(employee);
      if (!value || unique.has(value)) return;

      const idPart = employee?.employeeId ?? employee?.id;
      const codePart = employee?.employeeCode || employee?.code;
      const badge = idPart != null
        ? `ID: ${idPart}`
        : codePart
        ? `Code: ${codePart}`
        : null;

      unique.set(value, {
        value,
        label: badge
          ? `${getEmployeeDisplayName(employee)} (${badge})`
          : getEmployeeDisplayName(employee),
      });
    });
    return Array.from(unique.values()).sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }, [employeeDirectory, selectedBranch]);

  const branchOptions = useMemo(() => {
    const unique = new Map();
    employeeDirectory.forEach((employee) => {
      const branch = String(employee?.branch || "").trim();
      if (branch) {
        const normalizedBranch = branch.toLowerCase();
        if (!unique.has(normalizedBranch)) {
          unique.set(normalizedBranch, branch);
        }
      }
    });
    return Array.from(unique.values()).sort((left, right) => left.localeCompare(right));
  }, [employeeDirectory]);

  const selectedEmployeeNameValue = useMemo(() => {
    const normalizedRef = normalizeEmployeeIdRef(employeeId);
    if (!normalizedRef) return "";
    return employeeNameOptions.some((option) => option.value === normalizedRef)
      ? normalizedRef
      : "";
  }, [employeeId, employeeNameOptions]);

  const employeeDirectoryIndex = useMemo(() => {
    const byId = new Map();
    const byEmployeeId = new Map();
    const byCode = new Map();

    employeeDirectory.forEach((employee) => {
      if (employee?.id != null) byId.set(String(employee.id), employee);
      if (employee?.employeeId != null) byEmployeeId.set(String(employee.employeeId), employee);
      if (employee?.employeeCode) {
        byCode.set(String(employee.employeeCode).toLowerCase(), employee);
      }
      if (employee?.code) {
        byCode.set(String(employee.code).toLowerCase(), employee);
      }
    });

    return { byId, byEmployeeId, byCode };
  }, [employeeDirectory]);

  const parseErrorMessage = async (response, fallbackMessage) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      return json?.message || json?.error || fallbackMessage;
    }

    const text = (await response.text())?.trim();
    return text || fallbackMessage;
  };

  const formatINR = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(value || 0));

  const formatHoursAndMinutes = (value) => {
    const hoursValue = Number(value || 0);
    const totalMinutes = Math.round(hoursValue * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.abs(totalMinutes % 60);
    return `${hours} hrs ${minutes} mins`;
  };

  const formatMinutesAsHoursAndMinutes = (value) => {
    const totalMinutes = Math.max(0, Math.round(Number(value || 0)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} hrs ${minutes} mins`;
  };

  const formatWeekOffDay = (value) => {
    if (!value) return "Not configured";
    const raw = String(value).trim();
    if (!raw) return "Not configured";
    return raw
      .toLowerCase()
      .split(/[\s_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const formatShiftWindow = (startTime, endTime) => {
    if (!startTime || !endTime) return "Not configured";
    return `${startTime} - ${endTime}`;
  };

  const resolveProfileImageUrl = resolveBackendAssetUrl;

  const additionalWorkingDaysSource = Array.isArray(data?.additionalWorkingDays)
    ? data.additionalWorkingDays
    : Array.isArray(data?.employee?.additionalWorkingDays)
    ? data.employee.additionalWorkingDays
    : [];

  const additionalWorkingDays = additionalWorkingDaysSource
    .map((day) => ({
      dayType: String(day?.dayType || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_"),
      label: String(day?.label || "").trim(),
      timeIn: day?.timeIn || "",
      timeOut: day?.timeOut || "",
    }))
    .filter((day) => day.dayType || day.label || day.timeIn || day.timeOut)
    .sort((a, b) => {
        const order = {
          ODD_SATURDAY: 1,
          EVEN_SATURDAY: 2,
          ODD_SUNDAY: 3,
          EVEN_SUNDAY: 4,
        };
        const left = order[a?.dayType] || 99;
        const right = order[b?.dayType] || 99;
        return left - right;
      });
  const formatAdditionalShiftSummary = () => {
    if (!additionalWorkingDays.length) return "Null";
    return additionalWorkingDays
      .map((day) => {
        const label = day.label || formatWeekOffDay(day.dayType) || "Additional Shift";
        const window = formatShiftWindow(day.timeIn, day.timeOut);
        return window === "Not configured" ? label : `${label}: ${window}`;
      })
      .join(", ");
  };

  const parseRecordDate = (dateString) => {
    if (!dateString) return null;
    const isoDate = parseISO(dateString);
    if (isValid(isoDate)) return isoDate;
    const ddMMyyyy = parse(dateString, "dd/MM/yyyy", new Date());
    if (isValid(ddMMyyyy)) return ddMMyyyy;
    const ddMMyyyyDash = parse(dateString, "dd-MM-yyyy", new Date());
    if (isValid(ddMMyyyyDash)) return ddMMyyyyDash;
    return null;
  };

  const parseRecordDateTime = (value) => {
    if (!value) return null;
    const isoDate = parseISO(value);
    if (isValid(isoDate)) return isoDate;
    const timeWithSeconds = parse(value, "HH:mm:ss", new Date());
    if (isValid(timeWithSeconds)) return timeWithSeconds;
    const timeWithoutSeconds = parse(value, "HH:mm", new Date());
    if (isValid(timeWithoutSeconds)) return timeWithoutSeconds;
    return null;
  };

  const formatAttendanceDate = (dateString) => {
    const date = parseRecordDate(dateString);
    return date ? format(date, "dd MMM yyyy") : dateString || "-";
  };

  const formatDayName = (dateString) => {
    const date = parseRecordDate(dateString);
    return date ? format(date, "EEEE") : "-";
  };

  const formatTimeValue = (value) => {
    const time = parseRecordDateTime(value);
    return time ? format(time, "HH:mm:ss") : value || "-";
  };

  const getDerivedAttendanceStatus = (record) => record?.displayStatus || record?.countStatus || "-";
  const getAttendanceStatusBucket = (record) => record?.countStatus || "";
  const attendanceSummary = data?.attendanceSummary || {};
  const getLateArrivalMinutes = (record) => record?.lateMinutes ?? 0;
  const getComputedMissedMinutes = (record) => record?.calculatedMissedMinutes ?? null;

  const getHolidayCounts = (payload) => {
    const full = Number(payload?.holidayDaysFull || 0);
    const half = Number(payload?.holidayDaysHalf || 0);
    const total = Number(payload?.holidayDaysTotal || 0);
    return {
      full,
      half,
      total,
      hasAny: full > 0 || half > 0 || total > 0,
    };
  };

  const formatHolidaySummary = (payload) => {
    const { full, half, total, hasAny } = getHolidayCounts(payload);
    if (!hasAny) return null;
    const formatDayEquivalent = (value) => {
      const rounded = Math.round(value * 10) / 10;
      return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(1)}`;
    };
    const fullLabel = `${full} Full Day${full === 1 ? "" : "s"}`;
    const halfLabel = `${half} Half Day${half === 1 ? "" : "s"}`;
    if (full > 0 && half > 0) {
      const equivalent = formatDayEquivalent(full + half * 0.5);
      return `Holidays - ${fullLabel} + ${halfLabel} (${equivalent} day equivalent)`;
    }
    if (full > 0) {
      return `Holidays - ${fullLabel}`;
    }
    if (half > 0) {
      const equivalent = formatDayEquivalent(half * 0.5);
      return `Holidays - ${halfLabel} (${equivalent} day equivalent)`;
    }
    if (total > 0) {
      return `Holidays - ${total}`;
    }
    return null;
  };

  const buildHolidayRowsHtml = (payload) => {
    const summary = formatHolidaySummary(payload);
    if (!summary) return "";
    return `<tr><td>Holiday</td><td>${summary.replace(/^Holiday[s]? - /, "")}</td></tr>`;
  };

  const parseNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const hasNumberValue = (value) => value !== null && value !== undefined && value !== "";
  const numberOrFallback = (value, fallback) => (hasNumberValue(value) ? parseNumber(value) : fallback);
  const roundCurrency = (value) => Math.round(parseNumber(value) * 100) / 100;
  const expectedAttendance = data?.expectedAttendance || {};
  const actualAttendance = data?.actualAttendance || {};
  const salaryCalculation = data?.salaryCalculation || {};
  const backendEstimatedSalary = parseNumber(
    salaryCalculation.earnedSalary ?? salaryCalculation.estimatedNetSalary ?? data?.proratedBasic ?? data?.salary
  );
  const overtimeMinutes = data?.overtimeMinutes ?? 0;
  const overtimeSalary = data?.overtimeAmount ?? 0;
  const pfBaseSalary = parseNumber(data?.salary);
  const lateAmount = parseNumber(salaryCalculation.lateAmount ?? data?.lateAmount ?? 0);
  const resolvedPfAmount = calculationDetails?.pfAmount ?? 0;

  const casualLeaveTakenCount =
    parseNumber(data?.paidCasualDays) + parseNumber(data?.unpaidCasualDays);
  const permissionAllowancePerMonth = parseNumber(
    data?.permissionAllowancePerMonth || 0
  );
  const permissionAllowedMinutes = parseNumber(
    data?.permissionAllowedMinutes || 0
  );
  const permissionTakenCount = parseNumber(data?.permissionTakenCount || 0);
  const permissionTakenMinutes = parseNumber(
    actualAttendance.permissionDurationMinutes ?? data?.permissionTakenMinutes ?? 0
  );
  const permissionExcessMinutes = parseNumber(
    salaryCalculation.permissionExcessMinutes ?? data?.permissionExcessMinutes ?? 0
  );
  const permissionExcessAmount = parseNumber(
    salaryCalculation.permissionExcessAmount ?? data?.permissionExcessAmount ?? 0
  );
  const lateDays = parseNumber(actualAttendance.lateAttendanceDays ?? data?.lateDays ?? 0);
  const totalLateMinutes = parseNumber(
    actualAttendance.lateAttendanceMinutes ?? data?.totalLateMinutes ?? 0
  );

  const employeeDisplayName = data
    ? `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.name || "Employee"
    : "";
  const monthLabel = format(selectedDate || new Date(), "MMMM yyyy");
  const remainingCl = Math.max(
    0,
    parseNumber(data?.casualLeaveBalance ?? data?.expectedAttendance?.clEntitlement ?? 0) -
      parseNumber(data?.paidCasualDays ?? 0)
  );
  const rawDailyEarnedSalary = attendanceRecords.reduce(
    (sum, row) => sum + parseNumber(row?.dailyEarnedSalary ?? row?.dayEarnedAmount ?? 0),
    0
  );
  const dashboardPerDaySalary = parseNumber(
    attendanceRecords.find((row) => parseNumber(row?.perDaySalaryAmount ?? row?.perDaySalary) > 0)?.perDaySalaryAmount ??
      attendanceRecords.find((row) => parseNumber(row?.perDaySalaryAmount ?? row?.perDaySalary) > 0)?.perDaySalary ??
      data?.perDaySalary ??
      0
  );
  const shiftMinutesForFormula = parseNumber(data?.regularShiftMinutes || data?.expectedMinutes || 0);
  const scheduledMinutesForFormula = parseNumber(
    data?.salaryCalculation?.scheduledWorkingMinutes || data?.expectedWorkingMinutes || 0
  );
  const inferredScheduledDays =
    shiftMinutesForFormula > 0 && scheduledMinutesForFormula > 0
      ? scheduledMinutesForFormula / shiftMinutesForFormula
      : attendanceRecords.filter(
          (row) =>
            row?.scheduledWorkingDay === true ||
            String(row?.scheduledWorkingDay || "").toLowerCase() === "true"
        ).length;
  const scheduledWorkingDays = parseNumber(
    data?.scheduledWorkingDays ??
      data?.scheduledDays ??
      data?.expectedAttendance?.scheduledWorkingDays ??
      data?.expectedWorkingDays ??
      inferredScheduledDays
  );
  const perDaySalaryFormula = scheduledWorkingDays > 0
    ? `${formatINR(data?.salary || 0)} / ${scheduledWorkingDays} scheduled days`
    : "Basic salary / scheduled working days";
  const totalOvertimeAmount = attendanceRecords.reduce(
    (sum, row) => sum + parseNumber(row?.overtimeAmount ?? 0),
    0
  );
  const basicSalary = parseNumber(data?.salary || 0);
  const backendBaseEarnedSalary = parseNumber(
    data?.proratedBasic ?? salaryCalculation.basicSalary ?? basicSalary
  );
  const currentEarnedSalary = roundCurrency(
    backendBaseEarnedSalary || Math.max(0, rawDailyEarnedSalary - totalOvertimeAmount)
  );
  const rowPresentDays = attendanceRecords.filter((row) => {
      const status = String(row?.displayStatus || row?.countStatus || "").toLowerCase();
      return status.includes("present");
    }).length;
  const paidDays = numberOrFallback(data?.workedDays, rowPresentDays);
  const holidayDayCount = parseNumber(data?.holidayDaysTotal ?? data?.holidayDaysFull ?? 0) ||
    attendanceRecords.filter((row) => {
      const status = String(row?.displayStatus || row?.countStatus || "").toLowerCase();
      return status.includes("holiday") || row?.holiday === true || String(row?.holiday).toLowerCase() === "true";
    }).length;
  const rowLopDays = attendanceRecords.filter((row) => {
      const status = String(row?.displayStatus || row?.countStatus || "").toLowerCase();
      return status.includes("absent") || status.includes("lop");
    }).length;
  const lopDayCount = numberOrFallback(data?.absentDays, rowLopDays);
  const totalLateDeduction = attendanceRecords.reduce(
    (sum, row) => sum + parseNumber(row?.lateDeductionAmount ?? row?.lateDeduction ?? 0),
    0
  );
  const lopDeductionAmount = roundCurrency(
    salaryCalculation.lopAmount ??
      salaryCalculation.unpaidMissingAmount ??
      data?.attendanceDeduction ??
      lopDayCount * dashboardPerDaySalary
  );
  const incentiveAmount = parseNumber(paymentDetails.incentives);
  const advanceDeduction = parseNumber(paymentDetails.advance);
  const otherDeduction = parseNumber(paymentDetails.others);
  const selectedOvertimeAmount = includeOvertime ? parseNumber(totalOvertimeAmount || overtimeSalary) : 0;
  const selectedLateDeduction = applyLateDeduction ? totalLateDeduction : 0;
  const estimatedNetSalary = roundCurrency(
    currentEarnedSalary + incentiveAmount + selectedOvertimeAmount - lopDeductionAmount - selectedLateDeduction - advanceDeduction - otherDeduction
  );
  const finalNetSalary = parseNumber(
    netSalary !== null && netSalary !== undefined ? netSalary : estimatedNetSalary
  );
  const companyName = client?.companyName || client?.companyCode || "ZenTime";
  const companyAddress = client?.address || client?.companyAddress || "Company address not configured";
  const monthToDateSummary = attendanceRecords.reduce(
    (summary, row) => {
      const status = String(row?.displayStatus || row?.countStatus || "").toLowerCase();
      summary.total += 1;
      if (status.includes("present")) summary.present += 1;
      else if (status.includes("week off")) summary.weekOff += 1;
      else if (status.includes("holiday")) summary.holiday += 1;
      else if (status.includes("pending")) summary.pending += 1;
      else if (status.includes("leave") || status.includes("cl")) summary.clApproved += parseNumber(row?.dailyEarnedSalary ?? row?.dayEarnedAmount) > 0 ? 1 : 0;
      else if (status.includes("absent") || status.includes("lop")) summary.lop += 1;
      return summary;
    },
    { total: 0, present: 0, weekOff: 0, holiday: 0, clApproved: 0, pending: 0, lop: 0 }
  );
  const displayMonthSummary = {
    total: numberOrFallback(data?.daysInMonth, monthToDateSummary.total),
    present: numberOrFallback(data?.workedDays, monthToDateSummary.present),
    weekOff: numberOrFallback(data?.weekOffDays ?? data?.expectedAttendance?.configuredWeekOffs, monthToDateSummary.weekOff),
    holiday: numberOrFallback(data?.holidayDaysTotal ?? data?.holidayDaysFull ?? data?.expectedAttendance?.publicHolidays, monthToDateSummary.holiday),
    clApproved: numberOrFallback(data?.paidCasualDays ?? data?.approvedLeaveTakenCount, monthToDateSummary.clApproved),
    pending: numberOrFallback(data?.unpaidCasualDays ?? data?.pendingLeaveTakenCount, monthToDateSummary.pending),
    lop: numberOrFallback(data?.absentDays, monthToDateSummary.lop),
  };
  const additionalShiftDisplay = formatAdditionalShiftSummary();
  const payrollStatusOptions = ["Present", "Week Off", "Holiday", "CL Approved", "CL Pending", "CL Rejected", "Absent", "LOP", "Late", "Overtime"];
  const statusBadgeSx = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("present")) return { bgcolor: "#dcfce7", color: "#166534" };
    if (normalized.includes("week off")) return { bgcolor: "#f0e6f6", color: "#1d4ed8" };
    if (normalized.includes("holiday")) return { bgcolor: "#fef3c7", color: "#92400e" };
    if (normalized.includes("pending")) return { bgcolor: "#ffedd5", color: "#c2410c" };
    if (normalized.includes("leave") || normalized.includes("cl")) return { bgcolor: "#ede9fe", color: "#6d28d9" };
    if (normalized.includes("absent") || normalized.includes("lop") || normalized.includes("reject")) return { bgcolor: "#fee2e2", color: "#b91c1c" };
    return { bgcolor: "#e5e7eb", color: "#374151" };
  };
  const filteredPayrollRows = attendanceRecords.filter((row) => {
    const status = String(row?.displayStatus || row?.countStatus || "");
    const remark = String(row?.payrollRemark || "");
    const search = payrollSearch.trim().toLowerCase();
    const matchesSearch =
      !search ||
      String(row?.date || "").toLowerCase().includes(search) ||
      status.toLowerCase().includes(search) ||
      employeeDisplayName.toLowerCase().includes(search) ||
      remark.toLowerCase().includes(search);
    const matchesFilter =
      !payrollStatusFilter ||
      status.toLowerCase().includes(payrollStatusFilter.toLowerCase()) ||
      (payrollStatusFilter === "Late" && parseNumber(row?.lateMinutes) > 0) ||
      (payrollStatusFilter === "Overtime" && parseNumber(row?.approvedOvertimeMinutes) > 0) ||
      (payrollStatusFilter === "LOP" && parseNumber(row?.unpaidMissingMinutes) > 0);
    return matchesSearch && matchesFilter;
  });

  const refreshPayroll = () => handleSubmit({ preventDefault: () => {} });
  const moveMonth = (amount) => {
    const next = new Date(selectedDate || new Date());
    next.setMonth(next.getMonth() + amount);
    setSelectedDate(next);
    resetPayrollComputation();
  };
  const exportPayrollCsv = () => {
    if (!data || filteredPayrollRows.length === 0) return;
    const headers = [
      "Employee",
      "Month",
      "Date",
      "Day",
      "Status",
      "Time In",
      "Time Out",
      "Late Min",
      "Late Deduction",
      "OT Min",
      "OT Amount",
      "Per Day Salary",
      "Daily Earned Salary",
      "Remarks",
    ];
    const rows = filteredPayrollRows.map((row) => [
      employeeDisplayName,
      monthLabel,
      formatAttendanceDate(row.date),
      formatDayName(row.date),
      row.displayStatus || row.countStatus || "-",
      formatTimeValue(row.timeIn),
      formatTimeValue(row.timeOut),
      row.lateMinutes ?? 0,
      parseNumber(row.lateDeductionAmount ?? row.lateDeduction ?? 0),
      row.approvedOvertimeMinutes ?? 0,
      parseNumber(row.overtimeAmount ?? 0),
      parseNumber(row.perDaySalaryAmount ?? row.perDaySalary ?? 0),
      parseNumber(row.dailyEarnedSalary ?? row.dayEarnedAmount ?? 0),
      row.payrollRemark || "-",
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payroll-${employeeId || data.employeeId}-${format(selectedDate, "yyyy-MM")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handlePrint = () => {
    if (!data) return;

    const finalPayableForPrint = finalNetSalary;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payroll Summary - ${data.firstName} ${
      data.lastName
    }</title>
                <style>
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                    body {
                        font-family: Arial, sans-serif;
                        color: #000;
                        padding: 20px;
                        
                    }
                    .print-header {
                        text-align: center;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #351153;
                        padding-bottom: 10px;
                    }
                    .print-header h1 {
                        color: #351153;
                        margin-bottom: 5px;
                    }
                    .print-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    .print-table th, .print-table td {
                        padding: 8px;
                        border: 1px solid #ddd;
                        text-align: left;
                    }
                    .print-table th {
                        background-color: #f5f5f5;
                        font-weight: bold;
                    }
                    .print-footer {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                    }
                    .signature-box {
                        width: 200px;
                        border-top: 1px solid #000;
                        padding-top: 10px;
                        text-align: center;
                    }
                    .highlight-row {
                        background-color: #f5f0ff;
                        font-weight: bold;
                    }
                    .salary-details-wrapper {
                        margin-top: 24px;
                    }
                    .salary-section-title {
                        color: #351153;
                        font-weight: 600;
                        font-size: 1.1rem;
                        margin-bottom: 16px;
                        border-bottom: 2px solid #351153;
                        padding-bottom: 8px;
                    }
                    .salary-details-table {
                        width: 100%;
                        border-collapse: collapse;
                        background-color: #fff;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
                    }
                    .salary-details-table td {
                        padding: 14px 18px;
                        border-bottom: 1px solid #eee;
                        font-size: 15px;
                        vertical-align: top;
                    }
                    .salary-details-table td:first-child {
                        font-weight: 600;
                        color: #333;
                        width: 40%;
                        background-color: #f9f9f9;
                    }
                    .salary-details-table tr:last-child td {
                        border-bottom: none;
                    }
                    .salary-net-highlight {
                        background-color: #f5f0ff;
                        font-weight: 700;
                        color: #2b1035;
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>Payroll Summary</h1>
                    <p>${data.firstName} ${data.lastName} | ${format(
      selectedDate,
      "MMMM yyyy"
    )}</p>
                </div>
                
                <table class="print-table">
                    <tr>
                        <th colspan="2" style="background-color: #351153; color: white;">Employee Details</th>
                    </tr>
                    <tr>
                        <td width="40%"><strong>Full Name</strong></td>
                        <td>${data.firstName} ${data.lastName}</td>
                    </tr>
                    <tr>
                        <td><strong>Employee ID</strong></td>
                        <td>${employeeId}</td>
                    </tr>
                    <tr>
                        <td><strong>Mobile Number</strong></td>
                        <td>${data.mobile || "N/A"}</td>
                    </tr>
                    <tr>
                        <td><strong>Branch</strong></td>
                        <td>${data.branch || "N/A"}</td>
                    </tr>
                    <tr>
                        <td><strong>Position</strong></td>
                        <td>${data.position || "N/A"}</td>
                    </tr>
                    <tr>
                        <td><strong>Email</strong></td>
                        <td>${data.email || "N/A"}</td>
                    </tr>
                </table>
                
                <div class="salary-details-wrapper">
                    <h3 class="salary-section-title">Salary Details</h3>
                    <table class="salary-details-table">
                        <tr>
                            <td>Month/Year</td>
                            <td>${format(selectedDate, "MMMM yyyy")}</td>
                        </tr>
                        <tr>
                            <td>Total Days</td>
                            <td>${data.daysInMonth}</td>
                        </tr>
                        <tr>
                            <td>Scheduled Days</td>
                            <td>${data.scheduledDays ?? "N/A"}</td>
                        </tr>
                        <tr>
                            <td>Week Offs</td>
                            <td>${data.weekOffDays ?? "0"}</td>
                        </tr>
                        <tr>
                            <td>Week Off Day</td>
                            <td>${formatWeekOffDay(data.weekOffDay)}</td>
                        </tr>
                        <tr>
                            <td>Regular Shift</td>
                            <td>${formatShiftWindow(data.shiftStartTime, data.shiftEndTime)} (${data.regularShiftMinutes ?? "0"} mins/day)</td>
                        </tr>
                        ${buildHolidayRowsHtml(data)}
                        <tr>
                            <td>Worked Days</td>
                            <td>${data.workedDays ?? "N/A"}</td>
                        </tr>
                        <tr>
                            <td>Approved Leave Taken</td>
                            <td>${data.approvedLeaveTakenCount ?? "0"}</td>
                        </tr>
                        <tr>
                            <td>Permission Taken</td>
                            <td>${data.permissionTakenCount ?? "0"}</td>
                        </tr>
                        <tr>
                            <td>Basic Salary</td>
                            <td>${formatINR(data.salary)}</td>
                        </tr>
                        <tr>
                            <td>Absent Days</td>
                            <td>${data.absentDays ?? "0"}</td>
                        </tr>
                        <tr>
                            <td>Monthly Expected Working</td>
                            <td>${data.expectedHours ?? "0"} hours (${data.expectedWorkingMinutes ?? "0"} mins)</td>
                        </tr>
                        <tr>
                            <td>Employee Present Working</td>
                            <td>${data.workedHours ?? "0"} hours (${data.presentWorkingMinutes ?? "0"} mins)</td>
                        </tr>
                        <tr>
                            <td>Present Payable Hours</td>
                            <td>${data.payableHours ?? "0"} hours (${data.payablePresentMinutes ?? "0"} mins)</td>
                        </tr>
                        <tr>
                            <td>Overtime Hours</td>
                            <td>${data.overtimeHours ?? "0"} hours</td>
                        </tr>
                        <tr>
                            <td>Payroll Net</td>
                            <td>${formatINR(finalNetSalary)}</td>
                        </tr>
                        ${
                          netSalary
                            ? `
                        <tr class="salary-net-highlight">
                            <td>Net Salary</td>
                            <td>${formatINR(netSalary)}</td>
                        </tr>
                        `
                            : ""
                        }
                    </table>
                </div>
                
                <table class="print-table">
                    <tr>
                        <th colspan="2" style="background-color: #351153; color: white;">Payment Details</th>
                    </tr>
                    <tr>
                        <td width="40%"><strong>Base / Earned Salary</strong></td>
                        <td>${formatINR(currentEarnedSalary)}</td>
                    </tr>
                    <tr>
                        <td><strong>Approved OT</strong></td>
                        <td>${formatINR(selectedOvertimeAmount)}</td>
                    </tr>
                    <tr>
                        <td><strong>Incentives</strong></td>
                        <td>${formatINR(paymentDetails.incentives)}</td>
                    </tr>
                    <tr>
                        <td><strong>Late Deduction</strong></td>
                        <td>${formatINR(selectedLateDeduction)}</td>
                    </tr>
                    <tr>
                        <td><strong>Advance</strong></td>
                        <td>${formatINR(paymentDetails.advance)}</td>
                    </tr>
                    <tr>
                        <td><strong>Others</strong></td>
                        <td>${formatINR(paymentDetails.others)}</td>
                    </tr>
                        <tr class="salary-net-highlight">
                            <td><strong>Final Payable Salary</strong></td>
                            <td>${formatINR(finalPayableForPrint)}</td>
                        </tr>
                    </table>
                
                <div class="print-footer">
                    <div class="signature-box">
                        Employee Signature
                    </div>
                    <div class="signature-box">
                        Authorized Signature
                    </div>
                </div>
                
                <script>
                    setTimeout(function() {
                        window.print();
                        window.close();
                    }, 200);
                </script>
            </body>
            </html>
        `);
    printWindow.document.close();
  };
  useEffect(() => {
    const clientId = client?.id;
    if (!clientId) return;
    const checkLogo = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/payroll/logo?clientId=${encodeURIComponent(clientId)}`
        );
        setLogoUploaded(response.ok && response.status !== 204);
      } catch (err) {
        setLogoUploaded(false);
      }
    };
    checkLogo();
  }, [client?.id]);

  useEffect(() => {
    const clientId = client?.id;
    if (!clientId) {
      setHolidayDateSet(new Set());
      return;
    }

    const fetchHolidays = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/admin/holidays?clientId=${encodeURIComponent(clientId)}`
        );
        if (!response.ok) {
          setHolidayDateSet(new Set());
          return;
        }
        const payload = await response.json();
        if (!Array.isArray(payload)) {
          setHolidayDateSet(new Set());
          return;
        }

        const nextSet = new Set();
        payload.forEach((holiday) => {
          const parsedDate = parseRecordDate(holiday?.holidayDate);
          const dateKey = parsedDate ? format(parsedDate, "yyyy-MM-dd") : null;
          if (dateKey) nextSet.add(dateKey);
        });
        setHolidayDateSet(nextSet);
      } catch (err) {
        setHolidayDateSet(new Set());
      }
    };

    fetchHolidays();
  }, [client?.id]);

  useEffect(() => {
    const clientId = client?.id;
    if (!clientId) {
      setEmployeeDirectory([]);
      return;
    }

    const fetchEmployeeDirectory = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/payroll/employees?clientId=${encodeURIComponent(clientId)}`
        );
        if (!response.ok) {
          setEmployeeDirectory([]);
          return;
        }
        const payload = await response.json();
        setEmployeeDirectory(Array.isArray(payload) ? payload : []);
      } catch (err) {
        setEmployeeDirectory([]);
      }
    };

    fetchEmployeeDirectory();
  }, [client?.id]);

  const handleLogoUpload = async () => {
    const clientId = client?.id;
    if (!clientId) {
      setError("Client session missing. Please login again.");
      return;
    }
    if (!logoFile) {
      setError("Please choose a logo image before upload.");
      return;
    }

    setLogoUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("clientId", String(clientId));
      formData.append("logo", logoFile);
      const response = await fetch(`${API_BASE_URL}/api/payroll/logo`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const msg = await parseErrorMessage(response, "Failed to upload payroll logo");
        throw new Error(msg);
      }
      setLogoUploaded(true);
      alert("Payroll logo uploaded successfully.");
    } catch (err) {
      setError(err.message || "Failed to upload payroll logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleEmployeeNameSelect = (e) => {
    setEmployeeId(String(e.target.value || ""));
    resetPayrollComputation();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setData(null);
    setLoading(true);

    const month = getMonth(selectedDate) + 1;
    const year = getYear(selectedDate);
    const employeeRef = normalizeEmployeeIdRef(employeeId);
    const clientId = client?.id;

    if (!employeeRef) {
      setError("Employee ID or Employee Name selection is required");
      setLoading(false);
      return;
    }
    if (!clientId) {
      setError("Client session missing. Please login again.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/payroll/month-payroll?employeeId=${encodeURIComponent(employeeRef)}&month=${month}&year=${year}&clientId=${encodeURIComponent(clientId)}${selectedBranch ? `&branch=${encodeURIComponent(selectedBranch)}` : ""}`
      );

      if (!response.ok) {
        const errorMessage = await parseErrorMessage(
          response,
          "Failed to fetch payroll data"
        );
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (Array.isArray(result?.dailyRows)) {
        setAttendanceRecords(result.dailyRows);
      }
      const defaultMissingMinutes = parseNumber(
        result?.salaryCalculation?.unpaidMissingMinutes ?? result?.unpaidMissingMinutes ?? result?.absentMinutes ?? 0
      );
      setPaymentDetails((prev) => ({ ...prev, lop: defaultMissingMinutes }));
      const payrollDays = Array.isArray(result?.additionalWorkingDays)
        ? result.additionalWorkingDays
        : [];

      if (payrollDays.length === 0) {
        try {
          const employeeResponse = await fetch(
            `${API_BASE_URL}/api/employees/${encodeURIComponent(employeeRef)}?clientId=${encodeURIComponent(clientId)}`
          );
          if (employeeResponse.ok) {
            const employeeData = await employeeResponse.json();
            let employeeDays = Array.isArray(employeeData?.additionalWorkingDays)
              ? employeeData.additionalWorkingDays
              : [];

            if (employeeDays.length === 0) {
              const daysResponse = await fetch(
                `${API_BASE_URL}/api/employees/${encodeURIComponent(employeeRef)}/additional-working-days?clientId=${encodeURIComponent(clientId)}`
              );
              if (daysResponse.ok) {
                const daysPayload = await daysResponse.json();
                employeeDays = Array.isArray(daysPayload) ? daysPayload : [];
              }
            }

            setData({
              ...result,
              profileImage: result?.profileImage || employeeData?.profileImage || null,
              leavePolicyType: result?.leavePolicyType || employeeData?.leavePolicyType || null,
              additionalWorkingDays: employeeDays,
            });
          } else {
            setData(result);
          }
        } catch (_fallbackError) {
          setData(result);
        }
      } else {
        setData(result);
      }
    } catch (err) {
      setError(err.message || "Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentDetailChange = (e) => {
    const { name, value } = e.target;
    let roundedValue = value;
    if (value !== "" && value !== null && value !== undefined) {
      if (name === "pfPercentage") {
        roundedValue = Math.min(100, Math.max(0, Math.round(parseNumber(value))));
      } else if (name === "lop") {
        roundedValue = Math.max(0, Math.round(parseNumber(value)));
      } else {
        roundedValue = roundCurrency(parseNumber(value));
      }
    }
    setPaymentDetails((prev) => ({
      ...prev,
      [name]: roundedValue,
    }));
  };

  const fetchAttendanceForMonth = async () => {
    setAttendanceError(null);
    setAttendanceRecords([]);

    const month = getMonth(selectedDate) + 1;
    const year = getYear(selectedDate);
    const employeeRef = normalizeEmployeeIdRef(employeeId);
    const clientId = client?.id;

    if (!employeeRef) {
      setAttendanceError("Employee ID or Employee Name selection is required");
      return;
    }
    if (!clientId) {
      setAttendanceError("Client session missing. Please login again.");
      return;
    }

    setAttendanceLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/payroll/month-payroll?employeeId=${encodeURIComponent(employeeRef)}&month=${month}&year=${year}&clientId=${encodeURIComponent(clientId)}`);

      if (response.status === 400 || response.status === 404) {
        setAttendanceRecords([]);
        return;
      }

      if (!response.ok) {
        const message = await parseErrorMessage(response, "Failed to fetch attendance records");
        throw new Error(message);
      }
      const result = await response.json();
      if (!Array.isArray(result.dailyRows)) throw new Error("Backend payroll ledger is unavailable");
      setAttendanceRecords(result.dailyRows);
    } catch (err) {
      setAttendanceError(err.message || "Failed to fetch attendance records");
    } finally {
      setAttendanceLoading(false);
    }
  };

  const buildPayslipPayload = () => {
    const clientId = client?.id;
    if (!data || !clientId) return null;
    return {
      clientId,
      employeeId: Number(normalizeEmployeeIdRef(employeeId) || data.employeeId || 0),
      companyName,
      companyAddress,
      sender: client?.email || client?.emailAddress || "wingrootechnologies@gmail.com",
      receiver: data.email || "",
      subject: `Payslip - ${format(selectedDate, "MMMM yyyy")}`,
      message: `Dear ${data.firstName || ""},\n\nPlease find your payslip attached.\n\nRegards,\nPayroll Team`,
      employeeName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
      position: data.position || "",
      branch: data.branch || "",
      mobile: data.mobile || "",
      email: data.email || "",
      month: getMonth(selectedDate) + 1,
      year: getYear(selectedDate),
      totalDays: Number(data.daysInMonth || 0),
      scheduledDays: Number(data.scheduledDays || 0),
      weekOffDays: Number(data.weekOffDays || 0),
      holidaysSummary: formatHolidaySummary(data) || "-",
      workedDays: Number(data.workedDays || 0),
      absentDays: Number(data.absentDays || 0),
      expectedHours: Number(data.expectedHours || 0),
      payableHours: Number(data.payableHours || 0),
      overtimeHours: Number(data.overtimeHours || 0),
      missingHours: 0,
      basicSalary: Number(data.salary || 0),
      netSalary: Number(finalNetSalary || 0),
      convenience: 0,
      otAmount: selectedOvertimeAmount,
      pfAmount: Number(resolvedPfAmount || 0),
      lopAmount: 0,
      incentives: parseNumber(paymentDetails.incentives),
      advance: parseNumber(paymentDetails.advance),
      others: parseNumber(paymentDetails.others),
      allowancesTotal: 0,
      additionalAllowances: [],
    };
  };

  const loadPayslipPreview = async () => {
    const payload = buildPayslipPayload();
    if (!payload) {
      setError("Client session missing. Please login again.");
      return;
    }
    setPayslipPreviewOpen(true);
    setPayslipPdfLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/payroll/preview-payslip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorMessage(
          response,
          "Failed to generate payslip preview"
        );
        throw new Error(errorMessage);
      }

      const pdfBlob = await response.blob();
      const nextUrl = URL.createObjectURL(pdfBlob);
      setPayslipPdfUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return nextUrl;
      });
    } catch (err) {
      setError(err.message || "Failed to generate payslip preview");
      console.error("Payslip preview error:", err);
    } finally {
      setPayslipPdfLoading(false);
    }
  };

  const calculateNetSalary = async () => {
    if (!data) return;
    setNetSalary(estimatedNetSalary);
    setCalculationDetails({
      earnedSalary: currentEarnedSalary,
      incentiveAmount,
      overtimeAmount: selectedOvertimeAmount,
      lateDeduction: selectedLateDeduction,
      advance: advanceDeduction,
      others: otherDeduction,
      netSalary: estimatedNetSalary,
    });
    setOpenSnackbar(true);
    await loadPayslipPreview();
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  const handleGeneratePayslip = () => {
    if (!data) return;
    if (netSalary === null) {
      setError("Please click Review & Calculate before generating payslip.");
      return;
    }
    if (!data.email) {
      setError("Employee email is missing.");
      return;
    }
    loadPayslipPreview();
  };

  const sendConfirmationEmail = async () => {
    if (!data) return;
    const clientId = client?.id;
    if (!clientId) {
      setError("Client session missing. Please login again.");
      return;
    }
    if (!data.email) {
      setError("Employee email is missing.");
      return;
    }

    setSendingEmail(true);
    setError(null);

    try {
      const emailPayload = buildPayslipPayload();
      emailPayload.receiver = data.email;

      const response = await fetch(`${API_BASE_URL}/api/payroll/send-payslip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorMessage(
          response,
          "Failed to generate and send payslip"
        );
        throw new Error(errorMessage);
      }

      setEmailSent(true);
      alert(`Payslip PDF sent to ${data.email}`);
      setPayslipPreviewOpen(false);
    } catch (err) {
      setError(err.message || "Failed to send payslip");
      console.error("Payslip email error:", err);
    } finally {
      setSendingEmail(false);
    }
  };

 

  // Styles
  const styles = {
    page: {
      minHeight: "100vh",
      background:
        "linear-gradient(180deg, #f8f3fc 0%, #fcf9ff 42%, #ffffff 100%)",
      backgroundImage:
        "linear-gradient(180deg, rgba(53,17,83,0.08) 0%, rgba(255,255,255,0) 34%), linear-gradient(90deg, rgba(53,17,83,0.04) 1px, transparent 1px), linear-gradient(180deg, rgba(53,17,83,0.035) 1px, transparent 1px)",
      backgroundSize: "auto, 38px 38px, 38px 38px",
      color: "#0b1b3d",
      pb: 6,
    },
    hero: {
      background:
        "linear-gradient(135deg, #351153 0%, #5a2d8a 100%)",
      color: "#ffffff",
      borderRadius: 3,
      padding: { xs: "18px", md: "22px" },
      boxShadow: "0 18px 44px rgba(53,17,83,0.12)",
      position: "relative",
      overflow: "hidden",
      border: "1px solid rgba(53,17,83,0.22)",
      "&::before": {
        content: '""',
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(120deg, rgba(255,255,255,0.18) 0 18%, transparent 18% 36%, rgba(255,255,255,0.1) 36% 52%, transparent 52%)",
        opacity: 0.65,
        pointerEvents: "none",
      },
    },
    heroGlow: {
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(420px 240px at 18% 18%, rgba(255,255,255,0.2), transparent 62%)",
      pointerEvents: "none",
    },
    heroTitle: {
      fontFamily: '"Manrope", sans-serif',
      fontSize: { xs: "1.8rem", md: "2.15rem" },
      fontWeight: 900,
      letterSpacing: "0",
      color: "#ffffff",
    },
    heroSub: {
      color: "rgba(255,255,255,0.86)",
      fontSize: "0.95rem",
      maxWidth: 520,
    },
    actionRow: {
      display: "flex",
      gap: 1.2,
      alignItems: "center",
      mt: 2,
      flexWrap: "wrap",
    },
    chip: {
      backgroundColor: "#f4ecfb",
      border: "1px solid #eadcf4",
      color: "#0b1b3d",
      px: 1.5,
      py: 0.6,
      borderRadius: 999,
      fontSize: "0.8rem",
    },
    panel: {
      backgroundColor: "#ffffff",
      borderRadius: 3,
      border: "1px solid #dfcbea",
      boxShadow: "0 16px 34px rgba(53,17,83,0.10)",
      overflow: "hidden",
    },
    sectionTitle: {
      fontFamily: '"Manrope", sans-serif',
      fontWeight: 700,
      color: "#351153",
      marginBottom: "12px",
      letterSpacing: "0.5px",
      fontSize: "0.9rem",
      textTransform: "uppercase",
    },
    primaryButton: {
      background: "linear-gradient(135deg, #351153 0%, #5a2d8a 100%)",
      color: "#ffffff",
      "&:hover": {
        background: "linear-gradient(135deg, #2a0d42 0%, #4a1b74 100%)",
        boxShadow: "0 14px 30px rgba(53,17,83,0.32)",
        transform: "translateY(-1px)",
      },
      "&.Mui-disabled": {
        background: "linear-gradient(135deg, #351153 0%, #5a2d8a 100%)",
        color: "#ffffff",
        opacity: 0.55,
        boxShadow: "none",
      },
      textTransform: "none",
      fontWeight: 700,
      boxShadow: "0 12px 26px rgba(53,17,83,0.24)",
      transition: "all 180ms ease",
    },
    secondaryButton: {
      backgroundColor: "#ffffff",
      color: "#351153",
      border: "1px solid #dfcbea",
      "&:hover": {
        backgroundColor: "#f8f3fc",
        border: "1px solid #7a3bb0",
      },
      textTransform: "none",
      fontWeight: 600,
    },
    confirmButton: {
      backgroundColor: "#6a1b9a",
      color: "#ffffff",
      "&:hover": {
        backgroundColor: "#571785",
      },
      "&:disabled": {
        backgroundColor: "#cdbbe2",
        color: "#ffffff",
      },
      textTransform: "none",
      fontWeight: 700,
      boxShadow: "0 10px 24px rgba(106,27,154,0.28)",
    },
    inputField: {
      "& .MuiOutlinedInput-root": {
        backgroundColor: "#ffffff",
        borderRadius: 2,
        "& fieldset": {
          borderColor: "#eadcf4",
        },
        "&:hover fieldset": {
          borderColor: "#b88bd4",
        },
        "&.Mui-focused fieldset": {
          borderColor: "#351153",
        },
      },
      "& .MuiInputBase-input": {
        color: "#0b1b3d",
      },
      "& .MuiSelect-select": { color: "#0b1b3d" },
      "& .MuiSvgIcon-root": { color: "#526684" },
      "& label": {
        color: "#526684",
      },
    },
    statCard: {
      padding: "18px 20px",
      borderRadius: 2.5,
      background:
        "linear-gradient(180deg, #ffffff 0%, #fcf9ff 100%)",
      border: "1px solid #eadcf4",
      boxShadow: "0 12px 24px rgba(53,17,83,0.08)",
      position: "relative",
      overflow: "hidden",
      transition: "transform 180ms ease, box-shadow 180ms ease",
      "&:hover": {
        transform: "translateY(-3px)",
        boxShadow: "0 18px 34px rgba(53,17,83,0.14)",
      },
      "&::after": {
        content: '""',
        position: "absolute",
        inset: "0 0 auto 0",
        height: 4,
        background: "linear-gradient(90deg, rgba(53,17,83,0.18), transparent)",
      },
    },
    statLabel: {
      fontSize: "0.8rem",
      textTransform: "uppercase",
      letterSpacing: "0.6px",
      color: "#526684",
      fontWeight: 700,
    },
    statValue: {
      fontSize: "1.35rem",
      fontWeight: 700,
      color: "#0b1b3d",
      marginTop: "6px",
    },
    salaryDetailsWrapper: {
      marginTop: "8px",
    },
    salaryDetailsTable: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: "0 10px",
      "& td": {
        padding: "12px 16px",
        fontSize: "14px",
        verticalAlign: "top",
      },
      "& tr": {
        backgroundColor: "#ffffff",
        boxShadow: "0 8px 20px rgba(0,0,0,0.16)",
      },
      "& td:first-child": {
        fontWeight: 600,
        color: "#526684",
        width: "48%",
      },
      "& tr td:first-of-type": {
        borderTopLeftRadius: "12px",
        borderBottomLeftRadius: "12px",
      },
      "& tr td:last-of-type": {
        borderTopRightRadius: "12px",
        borderBottomRightRadius: "12px",
        textAlign: "right",
        fontWeight: 600,
        color: "#0b1b3d",
      },
    },
    salaryNetHighlight: {
      background:
        "linear-gradient(135deg, rgba(106,27,154,0.12) 0%, rgba(53,17,83,0.08) 100%)",
      color: "#0b1b3d",
    },
    tableHeaderRow: {
      backgroundColor: "rgba(112,199,255,0.12)",
    },
    darkTable: {
      "& td, & th": {
        color: "#263a5a",
        borderBottom: "1px solid #edf2f8",
      },
    },
    payrollTablePanel: {
      backgroundColor: "#ffffff",
      border: "1px solid #eadcf4",
      borderRadius: 2.5,
      boxShadow: "0 18px 36px rgba(53,17,83,0.12)",
      maxHeight: { xs: 560, md: 680 },
      overflow: "auto",
    },
    payrollHeadCell: {
      position: "sticky",
      top: 0,
      zIndex: 2,
      backgroundColor: "#351153",
      color: "#ffffff",
      fontWeight: 900,
      fontSize: "0.74rem",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      lineHeight: 1.25,
      borderBottom: "2px solid #5a2d8a",
      py: 1.4,
      px: 1.5,
      whiteSpace: "normal",
    },
    payrollBodyCell: {
      color: "#263a5a",
      borderBottom: "1px solid #edf2f8",
      py: 1.35,
      px: 1.5,
      fontSize: "0.88rem",
      verticalAlign: "middle",
    },
    payrollNumericCell: {
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
    },
  };

  const summaryRowSx = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    columnGap: 2,
    alignItems: "center",
  };
  const summaryLabelSx = {
    pr: 1,
    overflowWrap: "anywhere",
  };
  const summaryValueSx = {
    minWidth: { xs: "110px", sm: "140px" },
    textAlign: "right",
    whiteSpace: "nowrap",
    fontWeight: 600,
    color: "#0b1b3d",
  };

  const payrollColumns = [
    { key: "date", label: "Date", width: 116, align: "left" },
    { key: "day", label: "Day", width: 118, align: "left" },
    { key: "status", label: "Status", width: 138, align: "center" },
    { key: "timeIn", label: "Time In", width: 100, align: "center" },
    { key: "timeOut", label: "Time Out", width: 100, align: "center" },
    { key: "approvedPermission", label: "Approved Permission", width: 132, align: "right" },
    { key: "permissionExcess", label: "Permission Excess", width: 132, align: "right" },
    { key: "lateMin", label: "Late Min", width: 96, align: "right" },
    { key: "lateDeduction", label: "Late Deduction", width: 126, align: "right" },
    { key: "otMin", label: "OT Min", width: 88, align: "right" },
    { key: "otAmount", label: "OT Amount", width: 118, align: "right" },
    { key: "perDay", label: "Per Day Salary", width: 130, align: "right" },
    { key: "dailyEarned", label: "Daily Earned Salary", width: 148, align: "right" },
    { key: "remarks", label: "Remarks", width: 260, align: "left" },
  ];
  const payrollCellSx = (column, extra = {}) => ({
    ...styles.payrollBodyCell,
    width: column.width,
    minWidth: column.width,
    textAlign: column.align,
    ...(column.align === "right" ? styles.payrollNumericCell : {}),
    ...extra,
  });

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={styles.page}>
        <Box component="style">{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Manrope:wght@400;600;700&display=swap');
          body { font-family: 'Manrope', sans-serif; }
        `}</Box>
        <Container maxWidth="xl" sx={{ pt: 4, px: { xs: 2, md: 4 } }}>
          <Box sx={styles.hero}>
            <Box sx={styles.heroGlow} />
            <Box sx={{ position: "relative", display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3, justifyContent: "space-between" }}>
              <Box>
                <Typography sx={styles.heroTitle}>Payroll Dashboard</Typography>
                <Typography sx={styles.heroSub}>
                  Daily payroll details and salary calculation
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1.2, alignItems: "center", flexWrap: "wrap", justifyContent: { xs: "flex-start", md: "flex-end" } }}>
                <DatePicker
                  views={["year", "month"]}
                  value={selectedDate}
                  onChange={(newValue) => {
                    setSelectedDate(newValue);
                    resetPayrollComputation();
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      sx={{
                        width: 180,
                        "& .MuiOutlinedInput-root": {
                          bgcolor: "#ffffff",
                          color: "#0b1b3d",
                          borderRadius: 2,
                          "& fieldset": { borderColor: "#eadcf4" },
                          "&:hover fieldset": { borderColor: "#b88bd4" },
                        },
                        "& .MuiInputBase-input": { color: "#0b1b3d", fontWeight: 700 },
                        "& .MuiSvgIcon-root": { color: "#0b1b3d" },
                      }}
                    />
                  )}
                />
                <Button variant="outlined" onClick={() => moveMonth(-1)} sx={{ color: "#0b1b3d", borderColor: "#dfcbea", backgroundColor: "#ffffff", textTransform: "none" }}>
                  Previous Month
                </Button>
                <Button variant="outlined" onClick={() => moveMonth(1)} sx={{ color: "#0b1b3d", borderColor: "#dfcbea", backgroundColor: "#ffffff", textTransform: "none" }}>
                  Next Month
                </Button>
                <Button variant="contained" onClick={refreshPayroll} disabled={loading || !employeeId} sx={styles.primaryButton}>
                  Generate / Refresh
                </Button>
                {data && (
                  <Tooltip title="Print Payroll Summary">
                    <IconButton onClick={handlePrint} sx={{ color: "#351153" }}>
                      <PrintIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Box>

          <Box sx={{ mt: 4 }}>
            {/* Form Section */}
            <Paper sx={{ ...styles.panel, p: { xs: 2.5, md: 3 }, mb: 4 }}>
              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={2 }>
                    <TextField
                      fullWidth
                      label="Employee ID"
                      value={employeeId}
                      onChange={(e) => {
                        setEmployeeId(e.target.value);
                        resetPayrollComputation();
                      }}
                      required
                      variant="outlined"
                      size={isMobile ? "small" : "medium"}
                      sx={styles.inputField}
                    />
                  </Grid>
                  <Grid item xs={12} md={2 }>
                    <FormControl fullWidth size={isMobile ? "small" : "medium"} sx={styles.inputField}>
                      <InputLabel shrink>Branch</InputLabel>
                      <Select
                        value={selectedBranch}
                        onChange={(e) => {
                          setSelectedBranch(e.target.value);
                          setEmployeeId("");
                          resetPayrollComputation();
                        }}
                        label="Branch"
                        displayEmpty
                        notched
                        renderValue={(selected) => selected || "All Branches"}
                      >
                        <MenuItem value="">All Branches</MenuItem>
                        {branchOptions.map((branch) => (
                          <MenuItem key={branch} value={branch}>
                            {branch}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={2 }>
                    <FormControl fullWidth size={isMobile ? "small" : "medium"} sx={styles.inputField}>
                      <InputLabel shrink>Employee Name</InputLabel>
                      <Select
                        value={selectedEmployeeNameValue}
                        onChange={handleEmployeeNameSelect}
                        label="Employee Name"
                        displayEmpty
                        notched
                        renderValue={(selected) => {
                          if (!selected) {
                            return (
                              <Typography color="text.secondary" noWrap>
                                Select Employee Name
                              </Typography>
                            );
                          }
                          const match = employeeNameOptions.find(
                            (option) => option.value === selected
                          );
                          return (
                            <Typography noWrap title={match?.label || String(selected)}>
                              {match?.label || String(selected)}
                            </Typography>
                          );
                        }}
                        sx={{
                          minWidth: 0,
                          "& .MuiSelect-select": {
                            display: "flex",
                            alignItems: "center",
                            minHeight: "1.4375em",
                            overflow: "hidden",
                            pr: 4,
                          },
                        }}
                      >
                        <MenuItem value="">Select Employee Name</MenuItem>
                        {employeeNameOptions.map((option) => (
                          <MenuItem
                            key={option.value}
                            value={option.value}
                            sx={{ whiteSpace: "normal" }}
                          >
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={2 }>
                    <DatePicker
                      views={["year", "month"]}
                      label="Select Month & Year"
                      minDate={new Date(2000, 0)}
                      maxDate={new Date(2100, 11)}
                      value={selectedDate}
                      onChange={(newValue) => {
                        setSelectedDate(newValue);
                        resetPayrollComputation();
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          required
                          size={isMobile ? "small" : "medium"}
                          sx={styles.inputField}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={2 }>
                    <Button
                      type="submit"
                      variant="contained"
                      sx={styles.primaryButton}
                      size={isMobile ? "small" : "medium"}
                      fullWidth
                      disabled={loading}
                    >
                      {loading ? "Loading..." : "View Payroll"}
                    </Button>
                  </Grid>
                  <Grid item xs={12} md={2 }>
                    <Button
                      variant="contained"
                      sx={styles.secondaryButton}
                      size={isMobile ? "small" : "medium"}
                      fullWidth
                      onClick={fetchAttendanceForMonth}
                      disabled={attendanceLoading}
                    >
                      {attendanceLoading ? "Loading..." : "View Attendance"}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Paper>

            {loading && <LinearProgress sx={{ mb: 4 }} />}

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {/* Data Display Section */}
            {data && (
              <Box>
                <Paper sx={{ ...styles.panel, p: { xs: 2.5, md: 3 }, mb: 3 }}>
                  <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={4 }>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar
                          src={resolveProfileImageUrl(data.profileImage)}
                          sx={{ width: 72, height: 72, bgcolor: "#f0e6f6", color: "#351153", fontWeight: 900, fontSize: "1.8rem" }}
                        >
                          {employeeDisplayName?.[0] || "E"}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize: "1.35rem", fontWeight: 900, color: "#0b1b3d" }}>
                            {employeeDisplayName}
                          </Typography>
                          <Typography sx={{ color: "#526684", fontWeight: 700 }}>
                            EMP {employeeId || data.employeeId} | {data.position || "Designation not set"} | {data.branch || "Department not set"}
                          </Typography>
                          <Chip size="small" label={data.status || "Active"} sx={{ mt: 1, bgcolor: "#dcfce7", color: "#166534", fontWeight: 700 }} />
                        </Box>
                      </Box>
                    </Grid>
                    {[
                      ["Basic Salary", formatINR(data.salary || 0)],
                      ["Per Day Salary", formatINR(dashboardPerDaySalary)],
                      ["Shift", formatShiftWindow(data.shiftStartTime, data.shiftEndTime)],
                      ["Additional Shift", additionalShiftDisplay],
                      ["Weekly Off", formatWeekOffDay(data.weekOffDay)],
                      ["Allowed CL", `${data.casualLeaveBalance ?? 0} Days`],
                      ["Used CL", `${data.paidCasualDays ?? 0} Days`],
                      ["Remaining CL", `${remainingCl} Days`],
                      ["Payroll Month", monthLabel],
                    ].map(([label, value]) => (
                      <Grid item xs={6} sm={4} md={1 } key={label}>
                        <Typography sx={{ fontSize: "0.72rem", color: "#526684", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0" }}>
                          {label}
                        </Typography>
                        <Typography sx={{ color: "#0b1b3d", fontWeight: 900, mt: 0.5, fontSize: label === "Per Day Salary" ? "1.1rem" : "1rem" }}>
                          {value}
                        </Typography>
                        {label === "Per Day Salary" && (
                          <Typography sx={{ color: "#351153", fontSize: "0.68rem", fontWeight: 700, mt: 0.3 }}>
                            {perDaySalaryFormula}
                          </Typography>
                        )}
                      </Grid>
                    ))}
                  </Grid>
                </Paper>

                <Grid container spacing={2.2} sx={{ mb: 3 }}>
                  {[
                    { label: "Current Earned Salary", value: formatINR(currentEarnedSalary), helper: "Till selected payroll date", color: "#22c55e", bg: "rgba(34,197,94,0.16)", icon: <AttachMoneyIcon fontSize="small" /> },
                    { label: "Paid Days", value: paidDays, helper: "Employee present days this month", color: "#38bdf8", bg: "rgba(56,189,248,0.16)", icon: <WorkIcon fontSize="small" /> },
                    { label: "Holiday", value: holidayDayCount, helper: "Paid public holiday count", color: "#14b8a6", bg: "rgba(20,184,166,0.16)", icon: <BusinessIcon fontSize="small" /> },
                    { label: "LOP Days", value: lopDayCount, helper: "Absent / unpaid dates", color: "#ef4444", bg: "rgba(239,68,68,0.16)", icon: <EmailIcon fontSize="small" /> },
                    { label: "Approved Permission", value: `${permissionTakenMinutes} min`, helper: "Paid approved permission", color: "#0ea5e9", bg: "rgba(14,165,233,0.16)", icon: <PhoneIcon fontSize="small" /> },
                    { label: "Permission Excess", value: `${permissionExcessMinutes} min`, helper: `LOP Amount: -${formatINR(permissionExcessAmount)}`, color: "#f43f5e", bg: "rgba(244,63,94,0.16)", icon: <AccessTimeIcon fontSize="small" /> },
                    { label: "Total Late Minutes", value: `${totalLateMinutes} min`, helper: `Late Deduction: -${formatINR(totalLateDeduction)}`, color: "#fb923c", bg: "rgba(251,146,60,0.16)", icon: <AccessTimeIcon fontSize="small" /> },
                    { label: "Overtime Minutes", value: `${overtimeMinutes} min`, helper: `Overtime Amount: +${formatINR(totalOvertimeAmount || overtimeSalary)}`, color: "#a855f7", bg: "rgba(168,85,247,0.16)", icon: <WorkIcon fontSize="small" /> },
                  ].map((card) => (
                    <Grid item xs={12} sm={6} md={2 } key={card.label}>
                      <Paper sx={{ ...styles.statCard, height: "100%", borderTop: `4px solid ${card.color}` }}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2.2,
                            bgcolor: card.bg,
                            mb: 1.4,
                            border: `1px solid ${card.color}`,
                            color: card.color,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: `0 10px 18px ${card.bg}`,
                          }}
                        >
                          {card.icon}
                        </Box>
                        <Typography sx={styles.statLabel}>{card.label}</Typography>
                        <Typography sx={{ ...styles.statValue, color: card.color }}>{card.value}</Typography>
                        <Typography sx={{ color: "#526684", fontSize: "0.82rem", mt: 0.6 }}>{card.helper}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} lg={8 }>
                    <Paper sx={{ ...styles.panel, p: 3 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", mb: 2.5 }}>
                        <Box>
                          <Typography sx={{ ...styles.sectionTitle, mb: 0.5 }}>Salary Report</Typography>
                          <Typography sx={{ color: "#526684" }}>
                            Earnings and deductions used for the payslip
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                          <Typography sx={{ color: "#0b1b3d", fontWeight: 900 }}>{companyName}</Typography>
                          <Typography sx={{ color: "#526684", fontSize: "0.85rem", maxWidth: 360 }}>
                            {companyAddress}
                          </Typography>
                        </Box>
                      </Box>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6 }>
                          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#fcf9ff", border: "1px solid rgba(34,197,94,0.32)", height: "100%" }}>
                            <Typography sx={{ color: "#22c55e", fontWeight: 900, mb: 1.5 }}>Earnings</Typography>
                            <Box sx={summaryRowSx}>
                              <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Base / Earned Salary</Typography>
                              <Typography sx={summaryValueSx}>{formatINR(currentEarnedSalary)}</Typography>
                            </Box>
                            <TextField
                              label="Incentive"
                              name="incentives"
                              type="number"
                              value={paymentDetails.incentives}
                              onChange={handlePaymentDetailChange}
                              fullWidth
                              size="small"
                              sx={{ ...styles.inputField, mt: 2 }}
                            />
                            <Box sx={{ mt: 2 }}>
                              <Typography sx={{ color: "#526684", fontWeight: 800, mb: 0.5 }}>
                                Apply Overtime Amount?
                              </Typography>
                              <RadioGroup
                                row
                                value={includeOvertime ? "yes" : "no"}
                                onChange={(event) => setIncludeOvertime(event.target.value === "yes")}
                              >
                                <FormControlLabel value="yes" control={<Radio size="small" />} label={`Yes (${formatINR(totalOvertimeAmount || overtimeSalary)})`} />
                                <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                              </RadioGroup>
                            </Box>
                          </Box>
                        </Grid>

                        <Grid item xs={12} md={6 }>
                          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "#fcf9ff", border: "1px solid rgba(239,68,68,0.32)", height: "100%" }}>
                            <Typography sx={{ color: "#ef4444", fontWeight: 900, mb: 1.5 }}>Deductions</Typography>
                            <Box sx={{ mb: 1.5 }}>
                              <Typography sx={{ color: "#526684", fontWeight: 800, mb: 0.5 }}>
                                Apply Late Deduction?
                              </Typography>
                              <RadioGroup
                                row
                                value={applyLateDeduction ? "yes" : "no"}
                                onChange={(event) => setApplyLateDeduction(event.target.value === "yes")}
                              >
                                <FormControlLabel value="yes" control={<Radio size="small" />} label={`Yes (${formatINR(totalLateDeduction)})`} />
                                <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                              </RadioGroup>
                            </Box>
                            <Grid container spacing={1.5}>
                              <Grid item xs={12} sm={6 }>
                                <TextField
                                  label="Advance"
                                  name="advance"
                                  type="number"
                                  value={paymentDetails.advance}
                                  onChange={handlePaymentDetailChange}
                                  fullWidth
                                  size="small"
                                  sx={styles.inputField}
                                />
                              </Grid>
                              <Grid item xs={12} sm={6 }>
                                <TextField
                                  label="Others"
                                  name="others"
                                  type="number"
                                  value={paymentDetails.others}
                                  onChange={handlePaymentDetailChange}
                                  fullWidth
                                  size="small"
                                  sx={styles.inputField}
                                />
                              </Grid>
                            </Grid>
                          </Box>
                        </Grid>
                      </Grid>

                      <Box sx={{ mt: 2.5, p: 2, borderRadius: 2, bgcolor: "#f8f3fc", border: "1px solid #eadcf4" }}>
                        <Grid container spacing={1.5}>
                          {[
                            ["Earned Salary", currentEarnedSalary],
                            ["Incentive", incentiveAmount],
                            ["Selected OT", selectedOvertimeAmount],
                            ["Selected Late", -selectedLateDeduction],
                            ["Advance / Others", -(advanceDeduction + otherDeduction)],
                            ["Estimated Net Salary", estimatedNetSalary],
                          ].map(([label, value]) => (
                            <Grid item xs={6} md={label === "Estimated Net Salary" ? 3 : 1.5 } key={label}>
                              <Typography sx={{ color: "#526684", fontSize: "0.72rem", fontWeight: 800 }}>{label}</Typography>
                              <Typography sx={{ color: value < 0 ? "#ef4444" : "#ffffff", fontWeight: 900 }}>{formatINR(value)}</Typography>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} lg={4 }>
                    <Paper sx={{ ...styles.panel, p: 3, height: "100%" }}>
                      <Typography sx={{ ...styles.sectionTitle, mb: 2 }}>Payslip Actions</Typography>
                      <Box sx={{ display: "grid", gap: 1.5 }}>
                        <Button variant="outlined" component="label" sx={styles.secondaryButton}>
                          {logoFile ? logoFile.name : "Choose Logo"}
                          <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                          />
                        </Button>
                        <Button
                          variant="contained"
                          sx={styles.primaryButton}
                          onClick={handleLogoUpload}
                          disabled={logoUploading || !logoFile}
                        >
                          {logoUploading ? "Uploading..." : "Upload Logo"}
                        </Button>
                        <Typography sx={{ color: logoUploaded ? "#22c55e" : "#526684", fontSize: "0.86rem" }}>
                          {logoUploaded ? "Logo saved for all payslips" : "Upload company logo for payslip"}
                        </Typography>
                        <Button variant="contained" sx={styles.primaryButton} onClick={calculateNetSalary}>
                          Review & Calculate
                        </Button>
                        <Button variant="outlined" sx={styles.secondaryButton} onClick={handleGeneratePayslip}>
                          Send Payslip to Employee Email
                        </Button>
                        <Typography sx={{ color: "#526684", fontSize: "0.86rem" }}>
                          Employee email: {data.email || "Not configured"}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>

              </Box>
            )}

            {(attendanceRecords.length > 0 || attendanceError) && (
              <Box sx={{ mt: 4 }}>
                <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" }, mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ ...styles.sectionTitle, mb: 0.5 }}>
                      Daily Payroll Details
                    </Typography>
                    <Typography sx={{ color: "#526684" }}>
                      Transparent day-by-day salary calculation for {monthLabel}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1.2, flexWrap: "wrap" }}>
                    <TextField
                      size="small"
                      placeholder="Search date, status, employee, remarks"
                      value={payrollSearch}
                      onChange={(event) => setPayrollSearch(event.target.value)}
                      sx={{ ...styles.inputField, minWidth: { xs: "100%", sm: 260 } }}
                    />
                    <FormControl size="small" sx={{ ...styles.inputField, minWidth: 180 }}>
                      <InputLabel>Status Filter</InputLabel>
                      <Select
                        value={payrollStatusFilter}
                        label="Status Filter"
                        onChange={(event) => setPayrollStatusFilter(event.target.value)}
                      >
                        <MenuItem value="">All Status</MenuItem>
                        {payrollStatusOptions.map((option) => (
                          <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button variant="outlined" sx={styles.secondaryButton} onClick={exportPayrollCsv} disabled={!filteredPayrollRows.length}>
                      Export
                    </Button>
                  </Box>
                </Box>
                {attendanceError && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    {attendanceError}
                  </Alert>
                )}
                {attendanceRecords.length > 0 && (
                  <>
                  <TableContainer component={Paper} sx={styles.payrollTablePanel}>
                    <Table stickyHeader sx={{ minWidth: 1780, tableLayout: "fixed" }}>
                      <TableHead>
                        <TableRow>
                          {payrollColumns.map((column) => (
                            <TableCell
                              key={column.key}
                              sx={{
                                ...styles.payrollHeadCell,
                                width: column.width,
                                minWidth: column.width,
                                textAlign: column.align,
                              }}
                            >
                              {column.label}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredPayrollRows.map((record, index) => {
                          const derivedStatus = getDerivedAttendanceStatus(record);
                          const statusBucket = getAttendanceStatusBucket(record);
                          const displayStatus = statusBucket || derivedStatus;
                          const approvedPermission = parseNumber(record.approvedPermissionMinutes ?? 0);
                          const permissionExcess = parseNumber(record.permissionExcessMinutes ?? 0);
                          const lateArrivalMinutes = parseNumber(record.lateMinutes ?? getLateArrivalMinutes(record));
                          const lateDeduction = parseNumber(record.lateDeductionAmount ?? record.lateDeduction ?? 0);
                          const otMinutes = parseNumber(record.approvedOvertimeMinutes ?? 0);
                          const otAmount = parseNumber(record.overtimeAmount ?? 0);
                          const perDay = parseNumber(record.perDaySalaryAmount ?? record.perDaySalary ?? 0);
                          const dailyEarned = parseNumber(record.dailyEarnedSalary ?? record.dayEarnedAmount ?? 0);

                          return (
                            <TableRow
                              key={record.id ?? `${record.date || "row"}-${index}`}
                              hover
                              sx={{
                                "& td": {
                                  backgroundColor: index % 2 === 0 ? "#ffffff" : "#fcf9ff",
                                },
                                "&:hover td": { backgroundColor: "#f8f3fc" },
                              }}
                            >
                              <TableCell sx={payrollCellSx(payrollColumns[0], { fontWeight: 800, whiteSpace: "nowrap" })}>
                                {formatAttendanceDate(record.date)}
                              </TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[1], { color: "#526684" })}>
                                {formatDayName(record.date)}
                              </TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[2])}>
                                <Chip
                                  label={displayStatus}
                                  size="small"
                                  sx={{
                                    ...statusBadgeSx(displayStatus),
                                    fontWeight: 800,
                                    minWidth: 82,
                                    justifyContent: "center",
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[3], { fontVariantNumeric: "tabular-nums" })}>{formatTimeValue(record.timeIn)}</TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[4], { fontVariantNumeric: "tabular-nums" })}>{formatTimeValue(record.timeOut)}</TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[5], { color: approvedPermission > 0 ? "#38bdf8 !important" : "#64748b !important", fontWeight: 800 })}>
                                {approvedPermission > 0 ? `${approvedPermission} min` : "0"}
                              </TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[6], { color: permissionExcess > 0 ? "#ef4444 !important" : "#64748b !important", fontWeight: 800 })}>
                                {permissionExcess > 0 ? `${permissionExcess} min` : "0"}
                              </TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[7], { color: lateArrivalMinutes > 0 ? "#fb923c !important" : "#64748b !important", fontWeight: 800 })}>
                                {lateArrivalMinutes > 0 ? `${lateArrivalMinutes} min` : "0"}
                              </TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[8], { color: lateDeduction > 0 ? "#ef4444 !important" : "#64748b !important", fontWeight: 800 })}>
                                {lateDeduction > 0 ? `-${formatINR(lateDeduction)}` : formatINR(0)}
                              </TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[9], { color: otMinutes > 0 ? "#22c55e !important" : "#64748b !important", fontWeight: 800 })}>{otMinutes > 0 ? `${otMinutes} min` : "0"}</TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[10], { color: otAmount > 0 ? "#22c55e !important" : "#64748b !important", fontWeight: 800 })}>
                                {otAmount > 0 ? `+${formatINR(otAmount)}` : formatINR(0)}
                              </TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[11], { fontWeight: 800 })}>{formatINR(perDay)}</TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[12], { color: dailyEarned > 0 ? "#22c55e !important" : "#ef4444 !important", fontWeight: 900 })}>
                                {formatINR(dailyEarned)}
                              </TableCell>
                              <TableCell sx={payrollCellSx(payrollColumns[13], { color: "#526684", whiteSpace: "normal", lineHeight: 1.35 })}>{record.payrollRemark || "-"}</TableCell>
                            </TableRow>
                          );
                        })}
                        {filteredPayrollRows.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={payrollColumns.length}
                              sx={{
                                ...styles.payrollBodyCell,
                                textAlign: "center",
                                py: 4,
                                color: "#526684",
                              }}
                            >
                              No payroll rows match the selected search or status filter.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Grid container spacing={3} sx={{ mt: 3 }}>
                    <Grid item xs={12} md={7 }>
                      <Paper sx={{ ...styles.panel, p: 3 }}>
                        <Typography sx={{ fontWeight: 900, color: "#0b1b3d", mb: 2 }}>
                          Month to Date Summary ({monthLabel})
                        </Typography>
                        <Grid container spacing={1.5}>
                          {[
                            ["Total Days", displayMonthSummary.total],
                            ["Present Days", displayMonthSummary.present],
                            ["Week Off Days", displayMonthSummary.weekOff],
                            ["Public Holidays", displayMonthSummary.holiday],
                            ["CL Approved", displayMonthSummary.clApproved],
                            ["CL Pending", displayMonthSummary.pending],
                            ["Absent / LOP", displayMonthSummary.lop],
                          ].map(([label, value]) => (
                            <Grid item xs={6} sm={4 } key={label}>
                              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#fcf9ff", border: "1px solid #eadcf4" }}>
                                <Typography sx={{ color: "#526684", fontSize: "0.78rem", fontWeight: 700 }}>{label}</Typography>
                                <Typography sx={{ fontWeight: 900, color: "#0b1b3d", fontSize: "1.2rem" }}>{value}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                        <Box sx={{ display: "grid", gap: 1.2, mt: 2.5 }}>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Base Salary Earned</Typography>
                            <Typography sx={summaryValueSx}>{formatINR(currentEarnedSalary)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>LOP Deduction</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#ef4444" }}>-{formatINR(lopDeductionAmount)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Approved Permission</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#38bdf8" }}>{permissionTakenMinutes} min</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Permission Excess LOP</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#ef4444" }}>-{formatINR(permissionExcessAmount)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Late Deduction</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#ef4444" }}>-{formatINR(totalLateDeduction)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Overtime Amount</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#22c55e" }}>+{formatINR(totalOvertimeAmount || overtimeSalary)}</Typography>
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={5 }>
                      <Paper sx={{ ...styles.panel, p: 3, borderTop: "4px solid #351153" }}>
                        <Typography sx={{ fontWeight: 900, color: "#0b1b3d", mb: 2 }}>
                          {data?.payrollStatus === "Ready" ? "Final Net Salary" : "Estimated Net Salary (Till Date)"}
                        </Typography>
                        <Box sx={{ display: "grid", gap: 1.2 }}>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Total Earned Salary</Typography>
                            <Typography sx={summaryValueSx}>{formatINR(currentEarnedSalary || backendEstimatedSalary)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>LOP Deduction</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#ef4444" }}>-{formatINR(lopDeductionAmount)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Approved Permission</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#38bdf8" }}>{permissionTakenMinutes} min</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Permission Excess LOP</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#ef4444" }}>-{formatINR(permissionExcessAmount)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Late Deduction</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#ef4444" }}>-{formatINR(totalLateDeduction)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={{ ...summaryLabelSx, color: "#526684" }}>Overtime Amount</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#22c55e" }}>+{formatINR(totalOvertimeAmount || overtimeSalary)}</Typography>
                          </Box>
                          <Box sx={{ borderTop: "1px solid #eadcf4", pt: 1.5, mt: 0.5, ...summaryRowSx }}>
                            <Typography sx={{ ...summaryLabelSx, fontWeight: 900, color: "#0b1b3d" }}>Current Net Salary</Typography>
                            <Typography sx={{ ...summaryValueSx, fontWeight: 900, color: "#351153", fontSize: "1.25rem" }}>{formatINR(estimatedNetSalary)}</Typography>
                          </Box>
                          <Typography sx={{ color: "#526684", fontSize: "0.86rem", mt: 1 }}>
                            Final Net Salary will be calculated at the end of the month.
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  </Grid>
                  </>
                )}
              </Box>
            )}

          </Box>

          <Dialog
            open={payslipPreviewOpen}
            onClose={() => !sendingEmail && setPayslipPreviewOpen(false)}
            fullWidth
            maxWidth="lg"
            PaperProps={{
              sx: {
                backgroundColor: "#ffffff",
                color: "#0b1b3d",
                border: "1px solid rgba(56,189,248,0.22)",
                minHeight: "86vh",
              },
            }}
          >
            <DialogTitle sx={{ fontWeight: 800, display: "flex", justifyContent: "space-between", gap: 2 }}>
              <span>Payslip PDF Preview</span>
              <Typography component="span" sx={{ color: "#526684", fontWeight: 700, fontSize: "0.95rem" }}>
                {data?.email || "Employee email not configured"}
              </Typography>
            </DialogTitle>
            <DialogContent dividers sx={{ borderColor: "rgba(56,189,248,0.18)", p: 2 }}>
              <Box
                sx={{
                  height: { xs: "68vh", md: "72vh" },
                  backgroundColor: "#fcf9ff",
                  border: "1px solid rgba(56,189,248,0.16)",
                  borderRadius: 2,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {payslipPdfLoading ? (
                  <Box sx={{ width: "min(360px, 80%)" }}>
                    <Typography sx={{ mb: 1.5, fontWeight: 800, textAlign: "center" }}>
                      Generating payslip PDF...
                    </Typography>
                    <LinearProgress />
                  </Box>
                ) : payslipPdfUrl ? (
                  <Box
                    component="iframe"
                    title="Payslip PDF Preview"
                    src={payslipPdfUrl}
                    sx={{
                      width: "100%",
                      height: "100%",
                      border: 0,
                      backgroundColor: "#ffffff",
                    }}
                  />
                ) : (
                  <Typography sx={{ color: "#526684", fontWeight: 700 }}>
                    Payslip PDF preview is not available.
                  </Typography>
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setPayslipPreviewOpen(false)}
                disabled={sendingEmail}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                sx={styles.confirmButton}
                onClick={sendConfirmationEmail}
                disabled={sendingEmail || payslipPdfLoading || !payslipPdfUrl}
              >
                {sendingEmail ? "Sending..." : "Confirm & Send Email"}
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={openSnackbar}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert
              onClose={handleCloseSnackbar}
              severity="success"
              sx={{ width: "100%" }}
            >
              Net salary calculated successfully!
            </Alert>
          </Snackbar>
        </Container>
      </Box>
    </LocalizationProvider>
  );
}

export default EmployeePayrollViewer;
