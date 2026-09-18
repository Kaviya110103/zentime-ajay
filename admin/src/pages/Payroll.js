
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
  const [additionalAllowances, setAdditionalAllowances] = useState([
    { name: "", amount: 0 },
  ]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUploaded, setLogoUploaded] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [payslipPreviewOpen, setPayslipPreviewOpen] = useState(false);
  const [includeOvertime, setIncludeOvertime] = useState(true);
  const [applyLateDeduction, setApplyLateDeduction] = useState(true);
  const [payrollSearch, setPayrollSearch] = useState("");
  const [payrollStatusFilter, setPayrollStatusFilter] = useState("");

  useEffect(() => {
    setNetSalary(null);
    setCalculationDetails(null);
  }, [paymentDetails, additionalAllowances, includeOvertime, applyLateDeduction, data]);

  const resetPayrollComputation = () => {
    setData(null);
    setNetSalary(null);
    setEmailSent(false);
    setError(null);
    setAttendanceError(null);
    setAttendanceRecords([]);
    setPaymentDetails({ ...defaultPaymentDetails });
    setAdditionalAllowances([{ name: "", amount: 0 }]);
    setOpenSnackbar(false);
    setPayslipPreviewOpen(false);
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
      return json?.message || fallbackMessage;
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
  const roundCurrency = (value) => Math.round(parseNumber(value) * 100) / 100;
  const expectedAttendance = data?.expectedAttendance || {};
  const actualAttendance = data?.actualAttendance || {};
  const salaryCalculation = data?.salaryCalculation || {};
  const backendEstimatedSalary = parseNumber(
    salaryCalculation.earnedSalary ?? salaryCalculation.estimatedNetSalary ?? data?.proratedBasic ?? data?.salary
  );
  const perMinuteSalary = parseNumber(
    salaryCalculation.perMinuteRate ?? data?.perMinuteSalary ?? 0
  );

  const additionalAllowancesTotal = calculationDetails?.additionalAllowancesTotal ?? 0;
  const overtimeMinutes = data?.overtimeMinutes ?? 0;
  const overtimeSalary = data?.overtimeAmount ?? 0;
  const includedOvertimeSalary = includeOvertime ? overtimeSalary : 0;
  const pfBaseSalary = parseNumber(data?.salary);
  const lopDays = data?.absentPayableDays ?? 0;
  const unpaidMissingMinutes = parseNumber(
    paymentDetails.lop !== "" && paymentDetails.lop !== null && paymentDetails.lop !== undefined
      ? paymentDetails.lop
      : salaryCalculation.unpaidMissingMinutes ?? data?.unpaidMissingMinutes ?? 0
  );
  const lateAmount = parseNumber(salaryCalculation.lateAmount ?? data?.lateAmount ?? 0);
  const includedLateAmount = applyLateDeduction ? lateAmount : 0;
  const lopDeductionAmount = roundCurrency(unpaidMissingMinutes * perMinuteSalary);
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
  const lateDays = parseNumber(actualAttendance.lateAttendanceDays ?? data?.lateDays ?? 0);
  const totalLateMinutes = parseNumber(
    actualAttendance.lateAttendanceMinutes ?? data?.totalLateMinutes ?? 0
  );

  const previewEarnings = [
    { label: "Base / Earned Salary", amount: backendEstimatedSalary },
    { label: "Convenience", amount: parseNumber(paymentDetails.convenience) },
    { label: "OT", amount: includedOvertimeSalary },
    { label: "Incentives", amount: parseNumber(paymentDetails.incentives) },
    { label: "Additional Allowances", amount: additionalAllowancesTotal },
  ].filter((item) => item.amount > 0);

  const previewDeductions = [
    { label: "Late Amount", amount: includedLateAmount },
    { label: "Unpaid Missing Minutes", amount: lopDeductionAmount },
    ...(SHOW_PF_SECTION ? [{ label: "PF", amount: resolvedPfAmount }] : []),
    { label: "Advance", amount: parseNumber(paymentDetails.advance) },
    { label: "Others", amount: parseNumber(paymentDetails.others) },
  ].filter((item) => item.amount > 0);

  const finalNetSalary = parseNumber(
    netSalary !== null && netSalary !== undefined ? netSalary : backendEstimatedSalary
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
  const currentEarnedSalary = attendanceRecords.reduce(
    (sum, row) => sum + parseNumber(row?.dailyEarnedSalary ?? row?.dayEarnedAmount ?? 0),
    0
  );
  const paidDays = attendanceRecords.filter((row) => parseNumber(row?.dailyEarnedSalary ?? row?.dayEarnedAmount ?? 0) > 0).length;
  const lopDayCount = attendanceRecords.filter((row) => {
    const status = String(row?.displayStatus || row?.countStatus || "").toLowerCase();
    return status.includes("absent") || status.includes("lop") || parseNumber(row?.unpaidMissingMinutes) > 0;
  }).length;
  const totalLateDeduction = attendanceRecords.reduce(
    (sum, row) => sum + parseNumber(row?.lateDeductionAmount ?? row?.lateDeduction ?? 0),
    0
  );
  const totalOvertimeAmount = attendanceRecords.reduce(
    (sum, row) => sum + parseNumber(row?.overtimeAmount ?? 0),
    0
  );
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
  const payrollStatusOptions = ["Present", "Week Off", "Holiday", "CL Approved", "CL Pending", "CL Rejected", "Absent", "LOP", "Late", "Overtime"];
  const statusBadgeSx = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("present")) return { bgcolor: "#dcfce7", color: "#166534" };
    if (normalized.includes("week off")) return { bgcolor: "#dbeafe", color: "#1d4ed8" };
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

    const printableAdditionalAllowances = additionalAllowances.filter(
      (item) => (item?.name || "").trim() || parseNumber(item?.amount) > 0
    );
    const additionalAllowanceRows = printableAdditionalAllowances
      .map(
        (item) => `
                    <tr>
                        <td><strong>${item.name || "Allowance"}</strong></td>
                        <td>${formatINR(item.amount)}</td>
                    </tr>
                  `
      )
      .join("");
    const additionalWorkingSummary =
      additionalWorkingDays.length > 0
        ? additionalWorkingDays
            .map(
              (item) =>
                `${item.label || formatWeekOffDay(item.dayType)} (${formatShiftWindow(
                  item.timeIn,
                  item.timeOut
                )})`
            )
            .join(", ")
        : "Not configured";
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
                        <tr>
                            <td>Additional Working Days</td>
                            <td>${additionalWorkingSummary}</td>
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
                            <td>Missing Hours</td>
                            <td>${data.missingHours ?? "0"} hours</td>
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
                        <td width="40%"><strong>Convenience</strong></td>
                        <td>${formatINR(paymentDetails.convenience)}</td>
                    </tr>
                        <tr>
                            <td><strong>OT</strong></td>
                            <td>${formatINR(includedOvertimeSalary)}</td>
                        </tr>
                        <tr>
                            <td><strong>PF Deduction</strong></td>
                            <td>${formatINR(resolvedPfAmount)}</td>
                        </tr>
                        <tr>
                            <td><strong>LOP</strong></td>
                            <td>${formatINR(paymentDetails.lop)}</td>
                        </tr>
                    <tr>
                        <td><strong>Incentives</strong></td>
                        <td>${formatINR(paymentDetails.incentives)}</td>
                    </tr>
                    <tr>
                        <td><strong>Advance</strong></td>
                        <td>${formatINR(paymentDetails.advance)}</td>
                    </tr>
                        <tr>
                            <td><strong>Others</strong></td>
                            <td>${paymentDetails.others || "N/A"}</td>
                        </tr>
                        ${
                          additionalAllowanceRows
                            ? `
                        <tr>
                            <td colspan="2" style="font-weight:600;background:#f9f9f9;">Additional Allowances</td>
                        </tr>
                        ${additionalAllowanceRows}
                        `
                            : ""
                        }
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
  const client = JSON.parse(localStorage.getItem("loggedInClient"));

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

  const handleAllowanceChange = (index, field, value) => {
    const normalizedValue =
      field === "amount"
        ? value === "" || value === null || value === undefined
          ? ""
          : roundCurrency(Math.max(0, parseNumber(value)))
        : value;
    setAdditionalAllowances((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: normalizedValue } : item
      )
    );
  };

  const addAllowance = () => {
    setAdditionalAllowances((prev) => [...prev, { name: "", amount: 0 }]);
  };

  const removeAllowance = (index) => {
    setAdditionalAllowances((prev) =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== index) : prev
    );
  };

  const calculateNetSalary = async () => {
    if (!data) return;
    const employeeRef = normalizeEmployeeIdRef(employeeId);
    const clientId = client?.id;
    if (!clientId) {
      setError("Client session missing. Please login again.");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/salary-details/calculate?clientId=${encodeURIComponent(clientId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            employeeId: employeeRef,
            month: getMonth(selectedDate) + 1,
            year: getYear(selectedDate),
            includeOvertime,
            applyLateDeduction,
            preview: true,
            position: data.position || "",
            branch: data.branch || "",
            convienceAmount: paymentDetails.convenience || 0,
            incentive: paymentDetails.incentives || 0,
            lossOfPay: paymentDetails.lop || 0,
            advance: paymentDetails.advance || 0,
            others: paymentDetails.others || 0,
            pfAmount: paymentDetails.pfAmount || 0,
            pfPercentage: paymentDetails.pfPercentage || 0,
            additionalAllowancesJson: JSON.stringify(additionalAllowances),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response, "Failed to calculate salary"));
      }

      const result = await response.json();
      setNetSalary(result.netSalary);
      setCalculationDetails(result);
      setOpenSnackbar(true);
    } catch (err) {
      setError(err.message || "Failed to calculate salary");
    }
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
    setPayslipPreviewOpen(true);
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
      const filteredAllowances = additionalAllowances
        .filter((item) => (item?.name || "").trim() || parseNumber(item?.amount) > 0)
        .map((item) => ({
          name: (item?.name || "").trim() || "Allowance",
          amount: parseNumber(item?.amount),
        }));

      const emailPayload = {
        clientId,
        employeeId: Number(normalizeEmployeeIdRef(employeeId) || data.employeeId || 0),
        companyName: client?.companyName || client?.companyCode || "ZenTime",
        sender: "b.inba.ips444@gmail.com",
        receiver: data.email,
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
        missingHours: Number(data.missingHours || 0),
        basicSalary: Number(data.salary || 0),
        netSalary: Number(finalNetSalary || 0),
        convenience: parseNumber(paymentDetails.convenience),
        otAmount: includedOvertimeSalary,
        pfAmount: Number(resolvedPfAmount || 0),
        lopAmount: Number(lopDeductionAmount || 0),
        incentives: parseNumber(paymentDetails.incentives),
        advance: parseNumber(paymentDetails.advance),
        others: parseNumber(paymentDetails.others),
        allowancesTotal: Number(additionalAllowancesTotal || 0),
        additionalAllowances: filteredAllowances,
      };

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
        "linear-gradient(180deg, #f7fbff 0%, #eef6ff 44%, #f8fafc 100%)",
      color: "#0f172a",
      pb: 6,
    },
    hero: {
      background:
        "linear-gradient(135deg, #0f5ea8 0%, #1677c8 52%, #38bdf8 100%)",
      color: "#ffffff",
      borderRadius: 3,
      padding: { xs: "24px", md: "32px" },
      boxShadow: "0 18px 42px rgba(15,94,168,0.22)",
      position: "relative",
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.22)",
    },
    heroGlow: {
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(420px 240px at 20% 20%, rgba(255,255,255,0.24), transparent 60%)",
      pointerEvents: "none",
    },
    heroTitle: {
      fontFamily: '"Fraunces", serif',
      fontSize: { xs: "2rem", md: "2.4rem" },
      fontWeight: 600,
      letterSpacing: "0.3px",
    },
    heroSub: {
      color: "rgba(255,255,255,0.84)",
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
      backgroundColor: "rgba(255,255,255,0.2)",
      border: "1px solid rgba(255,255,255,0.35)",
      color: "#ffffff",
      px: 1.5,
      py: 0.6,
      borderRadius: 999,
      fontSize: "0.8rem",
    },
    panel: {
      backgroundColor: "#ffffff",
      borderRadius: 3,
      border: "1px solid rgba(15,94,168,0.12)",
      boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    },
    sectionTitle: {
      fontFamily: '"Manrope", sans-serif',
      fontWeight: 700,
      color: "#0f5ea8",
      marginBottom: "12px",
      letterSpacing: "0.5px",
      fontSize: "0.9rem",
      textTransform: "uppercase",
    },
    primaryButton: {
      background: "linear-gradient(135deg, #0f5ea8 0%, #1677c8 100%)",
      color: "#ffffff",
      "&:hover": {
        background: "linear-gradient(135deg, #0b4a86 0%, #115fa1 100%)",
      },
      textTransform: "none",
      fontWeight: 700,
      boxShadow: "0 12px 26px rgba(15,94,168,0.24)",
    },
    secondaryButton: {
      backgroundColor: "#ffffff",
      color: "#0f5ea8",
      border: "1px solid rgba(15,94,168,0.3)",
      "&:hover": {
        backgroundColor: "#eef6ff",
        border: "1px solid rgba(15,94,168,0.55)",
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
          borderColor: "rgba(15,94,168,0.18)",
        },
        "&:hover fieldset": {
          borderColor: "rgba(15,94,168,0.42)",
        },
        "&.Mui-focused fieldset": {
          borderColor: "#0f5ea8",
        },
      },
      "& .MuiInputBase-input": {
        color: "#0f172a",
      },
      "& label": {
        color: "rgba(15,23,42,0.65)",
      },
    },
    statCard: {
      padding: "18px 20px",
      borderRadius: 2.5,
      background:
        "linear-gradient(140deg, #ffffff 0%, #f8fbff 100%)",
      border: "1px solid rgba(15,94,168,0.12)",
      boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
    },
    statLabel: {
      fontSize: "0.8rem",
      textTransform: "uppercase",
      letterSpacing: "0.6px",
      color: "rgba(15,23,42,0.62)",
      fontWeight: 700,
    },
    statValue: {
      fontSize: "1.35rem",
      fontWeight: 700,
      color: "#0f5ea8",
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
        boxShadow: "0 8px 20px rgba(53,17,83,0.08)",
      },
      "& td:first-child": {
        fontWeight: 600,
        color: "rgba(53,17,83,0.78)",
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
        color: "#351153",
      },
    },
    salaryNetHighlight: {
      background:
        "linear-gradient(135deg, rgba(106,27,154,0.12) 0%, rgba(53,17,83,0.08) 100%)",
      color: "#351153",
    },
    tableHeaderRow: {
      backgroundColor: "#eaf4ff",
    },
    darkTable: {
      "& td, & th": {
        color: "rgba(53,17,83,0.84)",
        borderBottom: "1px solid rgba(53,17,83,0.08)",
      },
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
  };

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
                          bgcolor: "rgba(255,255,255,0.18)",
                          color: "#fff",
                          borderRadius: 2,
                          "& fieldset": { borderColor: "rgba(255,255,255,0.45)" },
                          "&:hover fieldset": { borderColor: "rgba(255,255,255,0.75)" },
                        },
                        "& .MuiInputBase-input": { color: "#fff", fontWeight: 700 },
                        "& .MuiSvgIcon-root": { color: "#fff" },
                      }}
                    />
                  )}
                />
                <Button variant="outlined" onClick={() => moveMonth(-1)} sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.55)", textTransform: "none" }}>
                  Previous Month
                </Button>
                <Button variant="outlined" onClick={() => moveMonth(1)} sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.55)", textTransform: "none" }}>
                  Next Month
                </Button>
                <Button variant="contained" onClick={refreshPayroll} disabled={loading || !employeeId} sx={{ bgcolor: "#ffffff", color: "#0f5ea8", fontWeight: 800, textTransform: "none", "&:hover": { bgcolor: "#eaf4ff" } }}>
                  Generate / Refresh
                </Button>
                {data && (
                  <Tooltip title="Print Payroll Summary">
                    <IconButton onClick={handlePrint} sx={{ color: "#ffffff" }}>
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
                  <Grid item xs={12} md={2}>
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
                  <Grid item xs={12} md={2}>
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
                  <Grid item xs={12} md={2}>
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
                  <Grid item xs={12} md={2}>
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
                  <Grid item xs={12} md={2}>
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
                  <Grid item xs={12} md={2}>
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
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 1.5,
                        alignItems: "center",
                        pt: 1,
                        borderTop: "1px solid rgba(53,17,83,0.12)",
                      }}
                    >
                      <Typography sx={{ color: "#351153", fontWeight: 600 }}>
                        Payslip Logo
                      </Typography>
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
                      <Typography sx={{ color: logoUploaded ? "#2e7d32" : "#6b5a7a" }}>
                        {logoUploaded ? "Logo saved for all payslips" : "No logo uploaded yet"}
                      </Typography>
                    </Box>
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
                    <Grid item xs={12} md={4}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar
                          src={resolveProfileImageUrl(data.profileImage)}
                          sx={{ width: 72, height: 72, bgcolor: "#dbeafe", color: "#0f5ea8", fontWeight: 800 }}
                        >
                          {employeeDisplayName?.[0] || "E"}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>
                            {employeeDisplayName}
                          </Typography>
                          <Typography sx={{ color: "#64748b", fontWeight: 600 }}>
                            EMP {employeeId || data.employeeId} | {data.position || "Designation not set"} | {data.branch || "Department not set"}
                          </Typography>
                          <Chip size="small" label={data.status || "Active"} sx={{ mt: 1, bgcolor: "#dcfce7", color: "#166534", fontWeight: 700 }} />
                        </Box>
                      </Box>
                    </Grid>
                    {[
                      ["Basic Salary", formatINR(data.salary || 0)],
                      ["Per Day Salary", formatINR(data.perDaySalary || 0)],
                      ["Shift", formatShiftWindow(data.shiftStartTime, data.shiftEndTime)],
                      ["Weekly Off", formatWeekOffDay(data.weekOffDay)],
                      ["Allowed CL", `${data.casualLeaveBalance ?? 0} Days`],
                      ["Used CL", `${data.paidCasualDays ?? 0} Days`],
                      ["Remaining CL", `${remainingCl} Days`],
                      ["Payroll Month", monthLabel],
                    ].map(([label, value]) => (
                      <Grid item xs={6} sm={4} md={1} key={label}>
                        <Typography sx={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>
                          {label}
                        </Typography>
                        <Typography sx={{ color: "#0f172a", fontWeight: 800, mt: 0.5 }}>
                          {value}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>

                <Grid container spacing={2.2} sx={{ mb: 3 }}>
                  {[
                    { label: "Current Earned Salary", value: formatINR(currentEarnedSalary), helper: "Till selected payroll date", color: "#16a34a", bg: "#dcfce7" },
                    { label: "Paid Days", value: paidDays, helper: "Present + paid credits", color: "#0f5ea8", bg: "#dbeafe" },
                    { label: "LOP Days", value: lopDayCount, helper: "Absent / unpaid dates", color: "#dc2626", bg: "#fee2e2" },
                    { label: "Total Late Minutes", value: `${totalLateMinutes} min`, helper: `Late Deduction: -${formatINR(totalLateDeduction)}`, color: "#ea580c", bg: "#ffedd5" },
                    { label: "Overtime Minutes", value: `${overtimeMinutes} min`, helper: `Overtime Amount: +${formatINR(totalOvertimeAmount || overtimeSalary)}`, color: "#7c3aed", bg: "#ede9fe" },
                  ].map((card) => (
                    <Grid item xs={12} sm={6} md={2.4} key={card.label}>
                      <Paper sx={{ ...styles.statCard, height: "100%", borderTop: `4px solid ${card.color}` }}>
                        <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: card.bg, mb: 1.4 }} />
                        <Typography sx={styles.statLabel}>{card.label}</Typography>
                        <Typography sx={{ ...styles.statValue, color: card.color }}>{card.value}</Typography>
                        <Typography sx={{ color: "#64748b", fontSize: "0.82rem", mt: 0.6 }}>{card.helper}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={styles.statCard}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: "50%", background: "#ece1fb", display: "grid", placeItems: "center" }}>
                          <AttachMoneyIcon sx={{ color: "#351153" }} />
                        </Box>
                        <Box>
                          <Typography sx={styles.statLabel}>Net Salary</Typography>
                          <Typography sx={styles.statValue}>
                            {formatINR(finalNetSalary)}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={styles.statCard}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: "50%", background: "#ece1fb", display: "grid", placeItems: "center" }}>
                          <AccessTimeIcon sx={{ color: "#351153" }} />
                        </Box>
                        <Box>
                          <Typography sx={styles.statLabel}>Present Payable</Typography>
                          <Typography sx={styles.statValue}>
                            {formatHoursAndMinutes(data.payableHours)} ({data.payablePresentMinutes ?? 0} mins)
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={styles.statCard}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: "50%", background: "#ece1fb", display: "grid", placeItems: "center" }}>
                          <AccessTimeIcon sx={{ color: "#351153" }} />
                        </Box>
                        <Box>
                          <Typography sx={styles.statLabel}>Overtime</Typography>
                          <Typography sx={styles.statValue}>
                            {formatHoursAndMinutes(data.overtimeHours)}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper sx={styles.statCard}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: "50%", background: "#ece1fb", display: "grid", placeItems: "center" }}>
                          <AccessTimeIcon sx={{ color: "#351153" }} />
                        </Box>
                        <Box>
                          <Typography sx={styles.statLabel}>Monthly Expected Work</Typography>
                          <Typography sx={styles.statValue}>
                            {data.expectedHours ?? 0} hrs ({data.expectedWorkingMinutes ?? 0} mins)
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>

                <Grid container spacing={4}>
                  <Grid item xs={12} md={5}>
                    <Typography variant="subtitle1" sx={styles.sectionTitle}>
                      Employee Details
                    </Typography>
                    <Paper sx={{ ...styles.panel, p: 3, mb: 3 }}>
                      <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                        <Avatar
                          src={resolveProfileImageUrl(data.profileImage)}
                          sx={{ width: 64, height: 64, bgcolor: "#ece1fb", color: "#351153" }}
                        >
                          {data.firstName?.[0] || "E"}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
                            {data.firstName} {data.lastName}
                          </Typography>
                          <Typography sx={{ color: "#6b5a7a" }}>
                            Employee #{employeeId}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mt: 2, display: "grid", gap: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <PhoneIcon sx={{ fontSize: 16, color: "#6b5a7a" }} />
                          <Typography sx={{ color: "#4a3b61" }}>{data.mobile || "N/A"}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <BusinessIcon sx={{ fontSize: 16, color: "#6b5a7a" }} />
                          <Typography sx={{ color: "#4a3b61" }}>{data.branch || "N/A"}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <WorkIcon sx={{ fontSize: 16, color: "#6b5a7a" }} />
                          <Typography sx={{ color: "#4a3b61" }}>{data.position || "N/A"}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <EmailIcon sx={{ fontSize: 16, color: "#6b5a7a" }} />
                          <Typography sx={{ color: "#4a3b61" }}>{data.email || "N/A"}</Typography>
                        </Box>
                      </Box>
                    </Paper>

                    <Paper sx={{ ...styles.panel, p: 3, mb: 3 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>Expected Attendance</Typography>
                        <Typography sx={{ color: "#6b5a7a" }}>{format(selectedDate, "MMMM yyyy")}</Typography>
                      </Box>
                      <Box sx={{ display: "grid", gap: 1.15 }}>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Total Calendar Days</Typography>
                          <Typography sx={summaryValueSx}>
                            {expectedAttendance.totalCalendarDays ?? data.daysInMonth ?? 0}
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Configured Week Offs</Typography>
                          <Typography sx={summaryValueSx}>
                            {(expectedAttendance.configuredWeekOffs ?? data.weekOffDays ?? 0)} ({formatWeekOffDay(data.weekOffDay)})
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Public Holidays</Typography>
                          <Typography sx={summaryValueSx}>
                            {expectedAttendance.publicHolidays ?? (formatHolidaySummary(data)?.replace("Holidays - ", "") || "0")}
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>CL Entitlement</Typography>
                          <Typography sx={summaryValueSx}>
                            {expectedAttendance.clEntitlement ?? data.casualLeaveBalance ?? 0}
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Scheduled Working Days</Typography>
                          <Typography sx={summaryValueSx}>
                            {expectedAttendance.scheduledWorkingDays ?? data.scheduledDays ?? 0}
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Permission Allowed</Typography>
                          <Typography sx={summaryValueSx}>
                            {permissionAllowancePerMonth} ({formatMinutesAsHoursAndMinutes(permissionAllowedMinutes)})
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Regular Shift</Typography>
                          <Typography sx={summaryValueSx}>
                            {formatShiftWindow(data.shiftStartTime, data.shiftEndTime)} ({data.regularShiftMinutes ?? 0} mins/day)
                          </Typography>
                        </Box>
                        {additionalWorkingDays.length > 0 ? (
                          additionalWorkingDays.map((day, index) => (
                            <Box key={`${day.dayType || "additional"}-${index}`} sx={summaryRowSx}>
                              <Typography sx={summaryLabelSx}>
                                {day.label || formatWeekOffDay(day.dayType)}
                              </Typography>
                              <Typography sx={summaryValueSx}>
                                {formatShiftWindow(day.timeIn, day.timeOut)}
                              </Typography>
                            </Box>
                          ))
                        ) : (
                          <Box sx={summaryRowSx}>
                            <Typography sx={summaryLabelSx}>Additional Working Days</Typography>
                            <Typography sx={summaryValueSx}>Not configured</Typography>
                          </Box>
                        )}
                      </Box>
                    </Paper>

                    <Paper sx={{ ...styles.panel, p: 3, mb: 3 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>Actual Attendance</Typography>
                        <Typography sx={{ color: "#6b5a7a" }}>Month Summary</Typography>
                      </Box>
                      <Box sx={{ display: "grid", gap: 1.15 }}>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Present Working Days</Typography>
                          <Typography sx={summaryValueSx}>
                            {actualAttendance.presentWorkingDays ?? data.workedDays ?? 0}
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Week Off Days</Typography>
                          <Typography sx={summaryValueSx}>
                            {(actualAttendance.weekOffDays ?? data.weekOffDays ?? 0)} ({formatWeekOffDay(data.weekOffDay)})
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Late Attendance</Typography>
                          <Typography sx={summaryValueSx}>
                            {lateDays} day{lateDays === 1 ? "" : "s"} ({formatMinutesAsHoursAndMinutes(totalLateMinutes)})
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>CL Utilized</Typography>
                          <Typography sx={summaryValueSx}>
                            {actualAttendance.clUtilized ?? casualLeaveTakenCount ?? 0}
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Permission Duration</Typography>
                          <Typography sx={summaryValueSx}>
                            {permissionTakenCount} ({formatMinutesAsHoursAndMinutes(permissionTakenMinutes)})
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Public Holidays</Typography>
                          <Typography sx={summaryValueSx}>
                            {actualAttendance.publicHolidays ?? (formatHolidaySummary(data)?.replace("Holidays - ", "") || "0")}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>

                    <Paper sx={{ ...styles.panel, p: 3 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>Salary Calculation</Typography>
                        <Typography sx={{ color: "#6b5a7a" }}>Monthly Formula</Typography>
                      </Box>
                      <Box sx={{ display: "grid", gap: 1.15 }}>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Base / Earned Salary</Typography>
                          <Typography sx={summaryValueSx}>
                            {formatINR(backendEstimatedSalary)}
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Scheduled Working Minutes</Typography>
                          <Typography sx={summaryValueSx}>
                            {salaryCalculation.scheduledWorkingMinutes ?? data.expectedWorkingMinutes ?? 0} mins
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Total Present Days</Typography>
                          <Typography sx={summaryValueSx}>
                            {data.workedDays ?? 0}
                          </Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Total Late Minutes</Typography>
                          <Typography sx={summaryValueSx}>{totalLateMinutes} mins</Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Late Amount</Typography>
                          <Typography sx={summaryValueSx}>{formatINR(lateAmount)}</Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Total Overtime Minutes</Typography>
                          <Typography sx={summaryValueSx}>{overtimeMinutes} mins</Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Overtime Amount</Typography>
                          <Typography sx={summaryValueSx}>{formatINR(overtimeSalary)}</Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={summaryLabelSx}>Per Minute Rate</Typography>
                          <Typography sx={summaryValueSx}>{formatINR(perMinuteSalary)}</Typography>
                        </Box>
                        <Box sx={summaryRowSx}>
                          <Typography sx={{ ...summaryLabelSx, fontWeight: 700 }}>Final Net Salary</Typography>
                          <Typography sx={{ ...summaryValueSx, fontWeight: 700 }}>{formatINR(finalNetSalary)}</Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={7}>
                    <Typography variant="subtitle1" sx={styles.sectionTitle}>
                      Payment Details
                    </Typography>
                    <Paper sx={{ ...styles.panel, p: 3, mb: 3 }}>
                      <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Earnings</Typography>
                      <Box sx={{ display: "grid", gap: 1.2, mb: 2.5 }}>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 1, alignItems: "center" }}>
                          <Typography>Convenience</Typography>
                          <TextField fullWidth name="convenience" value={paymentDetails.convenience} onChange={handlePaymentDetailChange} onWheel={(e) => e.target.blur()} variant="outlined" size="small" type="number" inputProps={{ min: 0, step: "0.01" }} sx={styles.inputField} />
                        </Box>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 1, alignItems: "center" }}>
                          <Typography>OT</Typography>
                          <TextField fullWidth value={overtimeSalary} variant="outlined" size="small" type="number" inputProps={{ readOnly: true }} sx={styles.inputField} />
                        </Box>
                        <Typography sx={{ color: "#6b5a7a", fontSize: "0.82rem", pl: 0.2 }}>
                          Approved OT: {overtimeMinutes} mins x {formatINR(data?.perMinuteSalary || 0)} = {formatINR(overtimeSalary)}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography>Apply Overtime Amount?</Typography>
                          <RadioGroup row value={includeOvertime ? "yes" : "no"} onChange={(event) => {
                            setIncludeOvertime(event.target.value === "yes");
                            setNetSalary(null);
                          }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                          </RadioGroup>
                        </Box>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 1, alignItems: "center" }}>
                          <Typography>Incentives</Typography>
                          <TextField fullWidth name="incentives" value={paymentDetails.incentives} onChange={handlePaymentDetailChange} onWheel={(e) => e.target.blur()} variant="outlined" size="small" type="number" inputProps={{ min: 0, step: "0.01" }} sx={styles.inputField} />
                        </Box>
                      </Box>
                      <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Deductions</Typography>
                      <Box sx={{ display: "grid", gap: 1.2 }}>
                        {SHOW_PF_SECTION && (
                          <>
                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 1, alignItems: "center" }}>
                              <Typography>PF Amount</Typography>
                              <TextField fullWidth name="pfAmount" value={paymentDetails.pfAmount} onChange={handlePaymentDetailChange} onWheel={(e) => e.target.blur()} variant="outlined" size="small" type="number" inputProps={{ min: 0, step: "0.01" }} sx={styles.inputField} />
                            </Box>
                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 1, alignItems: "center" }}>
                              <Typography>PF %</Typography>
                              <TextField fullWidth name="pfPercentage" value={paymentDetails.pfPercentage} onChange={handlePaymentDetailChange} onWheel={(e) => e.target.blur()} variant="outlined" size="small" type="number" inputProps={{ min: 0, max: 100, step: 1 }} sx={styles.inputField} />
                            </Box>
                            <Typography sx={{ color: "#6b5a7a", fontSize: "0.82rem", pl: 0.2 }}>
                              Calculated PF Amount (on Basic Salary {formatINR(pfBaseSalary)}): {formatINR(resolvedPfAmount)}
                            </Typography>
                          </>
                        )}
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 1, alignItems: "center" }}>
                          <Typography>Late Amount</Typography>
                          <TextField fullWidth value={lateAmount} variant="outlined" size="small" type="number" inputProps={{ readOnly: true }} sx={styles.inputField} />
                        </Box>
                        <Typography sx={{ color: "#6b5a7a", fontSize: "0.82rem", pl: 0.2 }}>
                          Late: {totalLateMinutes} mins x {formatINR(perMinuteSalary)} = {formatINR(lateAmount)}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography>Apply Late Deduction?</Typography>
                          <RadioGroup row value={applyLateDeduction ? "yes" : "no"} onChange={(event) => {
                            setApplyLateDeduction(event.target.value === "yes");
                            setNetSalary(null);
                          }}>
                            <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                            <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                          </RadioGroup>
                        </Box>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 1, alignItems: "center" }}>
                          <Typography>Unpaid Missing Minutes</Typography>
                          <TextField fullWidth name="lop" value={paymentDetails.lop} onChange={handlePaymentDetailChange} onWheel={(e) => e.target.blur()} variant="outlined" size="small" type="number" inputProps={{ min: 0, step: 1 }} sx={styles.inputField} />
                        </Box>
                        <Typography sx={{ color: "#6b5a7a", fontSize: "0.82rem", pl: 0.2 }}>
                          Missing deduction: {unpaidMissingMinutes} mins x {formatINR(perMinuteSalary)} = {formatINR(lopDeductionAmount)}
                        </Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 1, alignItems: "center" }}>
                          <Typography>Advance</Typography>
                          <TextField fullWidth name="advance" value={paymentDetails.advance} onChange={handlePaymentDetailChange} onWheel={(e) => e.target.blur()} variant="outlined" size="small" type="number" inputProps={{ min: 0, step: "0.01" }} sx={styles.inputField} />
                        </Box>
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 1, alignItems: "center" }}>
                          <Typography>Others</Typography>
                          <TextField fullWidth name="others" value={paymentDetails.others} onChange={handlePaymentDetailChange} onWheel={(e) => e.target.blur()} variant="outlined" size="small" type="number" inputProps={{ min: 0, step: "0.01" }} sx={styles.inputField} />
                        </Box>
                      </Box>
                    </Paper>

                    <Paper sx={{ ...styles.panel, p: 3 }}>
                      <Typography sx={{ fontWeight: 700, mb: 1 }}>Additional Allowance</Typography>
                      <Box sx={{ display: "grid", gap: 1 }}>
                        {additionalAllowances.map((item, index) => (
                          <Box key={`allowance-${index}`} sx={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 1, alignItems: "center" }}>
                            <TextField
                              fullWidth
                              placeholder="Allowance Name"
                              value={item.name}
                              onChange={(e) => handleAllowanceChange(index, "name", e.target.value)}
                              variant="outlined"
                              size="small"
                              sx={styles.inputField}
                            />
                            <TextField
                              fullWidth
                              placeholder="Amount"
                              value={item.amount}
                              onChange={(e) => handleAllowanceChange(index, "amount", e.target.value)}
                              onWheel={(e) => e.target.blur()}
                              variant="outlined"
                              size="small"
                              type="number"
                              inputProps={{ min: 0, step: "0.01" }}
                              sx={styles.inputField}
                            />
                            <Button
                              variant="outlined"
                              color="inherit"
                              onClick={() => removeAllowance(index)}
                              disabled={additionalAllowances.length === 1}
                            >
                              Remove
                            </Button>
                          </Box>
                        ))}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Button variant="outlined" onClick={addAllowance}>
                            + Add Allowance
                          </Button>
                          <Typography sx={{ fontWeight: 600 }}>
                            Total: {calculationDetails ? formatINR(additionalAllowancesTotal) : "Pending calculation"}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            mt: 1,
                            p: 2,
                            borderRadius: 2,
                            border: "1px solid rgba(53,17,83,0.16)",
                            background:
                              "linear-gradient(135deg, rgba(106,27,154,0.1) 0%, rgba(53,17,83,0.06) 100%)",
                            textAlign: "center",
                          }}
                        >
                          <Typography sx={{ color: "#6b5a7a", fontSize: "0.9rem", fontWeight: 600 }}>
                            Total Salary
                          </Typography>
                          <Typography sx={{ fontSize: { xs: "1.8rem", md: "2.2rem" }, fontWeight: 800, color: "#351153", lineHeight: 1.1 }}>
                            {formatINR(finalNetSalary)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2 }}>
                        <Button
                          variant="contained"
                          sx={styles.primaryButton}
                          onClick={calculateNetSalary}
                          size={isMobile ? "small" : "medium"}
                        >
                          Review & Calculate
                        </Button>
                        <Button
                          variant="contained"
                          sx={styles.confirmButton}
                          onClick={handleGeneratePayslip}
                          disabled={sendingEmail || emailSent || netSalary === null}
                          size={isMobile ? "small" : "medium"}
                        >
                          {sendingEmail ? "Sending..." : emailSent ? "Email Sent" : netSalary === null ? "Review First" : "Generate Payslip"}
                        </Button>
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
                    <Typography sx={{ color: "#64748b" }}>
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
                  <TableContainer component={Paper} sx={styles.panel}>
                    <Table sx={{ minWidth: 1500 }}>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: "#eaf4ff" }}>
                          {["Date", "Day", "Status", "Time In", "Time Out", "Late Min", "Late Deduction", "OT Min", "OT Amount", "Per Day Salary", "Daily Earned Salary", "Remarks"].map((head) => (
                            <TableCell key={head} sx={{ color: "#0f172a", fontWeight: 800 }}>{head}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredPayrollRows.map((record, index) => {
                          const derivedStatus = getDerivedAttendanceStatus(record);
                          const statusBucket = getAttendanceStatusBucket(record);
                          const displayStatus = statusBucket || derivedStatus;
                          const lateArrivalMinutes = parseNumber(record.lateMinutes ?? getLateArrivalMinutes(record));
                          const lateDeduction = parseNumber(record.lateDeductionAmount ?? record.lateDeduction ?? 0);
                          const otMinutes = parseNumber(record.approvedOvertimeMinutes ?? 0);
                          const otAmount = parseNumber(record.overtimeAmount ?? 0);
                          const perDay = parseNumber(record.perDaySalaryAmount ?? record.perDaySalary ?? 0);
                          const dailyEarned = parseNumber(record.dailyEarnedSalary ?? record.dayEarnedAmount ?? 0);

                          return (
                            <TableRow key={record.id ?? `${record.date || "row"}-${index}`} hover>
                              <TableCell>{formatAttendanceDate(record.date)}</TableCell>
                              <TableCell>{formatDayName(record.date)}</TableCell>
                              <TableCell>
                                <Chip label={displayStatus} size="small" sx={{ ...statusBadgeSx(displayStatus), fontWeight: 800 }} />
                              </TableCell>
                              <TableCell>{formatTimeValue(record.timeIn)}</TableCell>
                              <TableCell>{formatTimeValue(record.timeOut)}</TableCell>
                              <TableCell>
                                {lateArrivalMinutes > 0 ? `${lateArrivalMinutes} min` : "0"}
                              </TableCell>
                              <TableCell sx={{ color: lateDeduction > 0 ? "#dc2626" : "#64748b", fontWeight: 700 }}>
                                {lateDeduction > 0 ? `-${formatINR(lateDeduction)}` : formatINR(0)}
                              </TableCell>
                              <TableCell>{otMinutes > 0 ? `${otMinutes} min` : "0"}</TableCell>
                              <TableCell sx={{ color: otAmount > 0 ? "#16a34a" : "#64748b", fontWeight: 700 }}>
                                {otAmount > 0 ? `+${formatINR(otAmount)}` : formatINR(0)}
                              </TableCell>
                              <TableCell>{formatINR(perDay)}</TableCell>
                              <TableCell sx={{ color: dailyEarned > 0 ? "#16a34a" : "#dc2626", fontWeight: 800 }}>
                                {formatINR(dailyEarned)}
                              </TableCell>
                              <TableCell sx={{ minWidth: 220 }}>{record.payrollRemark || "-"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Grid container spacing={3} sx={{ mt: 3 }}>
                    <Grid item xs={12} md={7}>
                      <Paper sx={{ ...styles.panel, p: 3 }}>
                        <Typography sx={{ fontWeight: 800, color: "#0f172a", mb: 2 }}>
                          Month to Date Summary ({monthLabel})
                        </Typography>
                        <Grid container spacing={1.5}>
                          {[
                            ["Total Days", monthToDateSummary.total],
                            ["Present Days", monthToDateSummary.present],
                            ["Week Off Days", monthToDateSummary.weekOff],
                            ["Public Holidays", monthToDateSummary.holiday],
                            ["CL Approved", monthToDateSummary.clApproved],
                            ["CL Pending", monthToDateSummary.pending],
                            ["Absent / LOP", monthToDateSummary.lop],
                          ].map(([label, value]) => (
                            <Grid item xs={6} sm={4} key={label}>
                              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                <Typography sx={{ color: "#64748b", fontSize: "0.78rem", fontWeight: 700 }}>{label}</Typography>
                                <Typography sx={{ fontWeight: 900, color: "#0f172a", fontSize: "1.2rem" }}>{value}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                        <Box sx={{ display: "grid", gap: 1.2, mt: 2.5 }}>
                          <Box sx={summaryRowSx}>
                            <Typography sx={summaryLabelSx}>Base Salary Earned</Typography>
                            <Typography sx={summaryValueSx}>{formatINR(currentEarnedSalary)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={summaryLabelSx}>Late Deduction</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#dc2626" }}>-{formatINR(totalLateDeduction)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={summaryLabelSx}>Overtime Amount</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#16a34a" }}>+{formatINR(totalOvertimeAmount || overtimeSalary)}</Typography>
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={5}>
                      <Paper sx={{ ...styles.panel, p: 3, borderTop: "4px solid #0f5ea8" }}>
                        <Typography sx={{ fontWeight: 800, color: "#0f172a", mb: 2 }}>
                          {data.payrollStatus === "Ready" ? "Final Net Salary" : "Estimated Net Salary (Till Date)"}
                        </Typography>
                        <Box sx={{ display: "grid", gap: 1.2 }}>
                          <Box sx={summaryRowSx}>
                            <Typography sx={summaryLabelSx}>Total Earned Salary</Typography>
                            <Typography sx={summaryValueSx}>{formatINR(currentEarnedSalary || backendEstimatedSalary)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={summaryLabelSx}>Additional Allowances</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#16a34a" }}>+{formatINR(additionalAllowancesTotal)}</Typography>
                          </Box>
                          <Box sx={summaryRowSx}>
                            <Typography sx={summaryLabelSx}>Other Deductions</Typography>
                            <Typography sx={{ ...summaryValueSx, color: "#dc2626" }}>-{formatINR(parseNumber(paymentDetails.advance) + parseNumber(paymentDetails.others) + lopDeductionAmount + includedLateAmount)}</Typography>
                          </Box>
                          <Box sx={{ borderTop: "1px solid #e2e8f0", pt: 1.5, mt: 0.5, ...summaryRowSx }}>
                            <Typography sx={{ ...summaryLabelSx, fontWeight: 900 }}>Current Net Salary</Typography>
                            <Typography sx={{ ...summaryValueSx, fontWeight: 900, color: "#0f5ea8", fontSize: "1.25rem" }}>{formatINR(finalNetSalary)}</Typography>
                          </Box>
                          <Typography sx={{ color: "#64748b", fontSize: "0.86rem", mt: 1 }}>
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
            maxWidth="sm"
            PaperProps={{
              sx: {
                backgroundColor: "#ffffff",
                color: "#2a1e3f",
                border: "1px solid rgba(53,17,83,0.15)",
              },
            }}
          >
            <DialogTitle sx={{ fontWeight: 700 }}>Payslip Preview</DialogTitle>
            <DialogContent dividers sx={{ borderColor: "rgba(53,17,83,0.12)" }}>
              <Box sx={{ display: "grid", gap: 1.2 }}>
                <Typography><strong>Employee:</strong> {data?.firstName || ""} {data?.lastName || ""}</Typography>
                <Typography><strong>Period:</strong> {format(selectedDate, "MMMM yyyy")}</Typography>
                <Typography><strong>Basic Salary:</strong> {formatINR(data?.salary || 0)}</Typography>
                <Box sx={{ border: "1px solid rgba(53,17,83,0.14)", borderRadius: 1.5, p: 1.2 }}>
                  <Typography sx={{ fontWeight: 700, mb: 0.6 }}>Earnings</Typography>
                  {previewEarnings.length > 0 ? (
                    previewEarnings.map((item, idx) => (
                      <Box key={`earning-${idx}`} sx={{ display: "flex", justifyContent: "space-between", py: 0.25 }}>
                        <Typography sx={{ color: "#4a3b61" }}>{item.label}</Typography>
                        <Typography sx={{ fontWeight: 600 }}>{formatINR(item.amount)}</Typography>
                      </Box>
                    ))
                  ) : (
                    <Typography sx={{ color: "#6b5a7a" }}>No earnings added</Typography>
                  )}
                </Box>
                <Box sx={{ border: "1px solid rgba(53,17,83,0.14)", borderRadius: 1.5, p: 1.2 }}>
                  <Typography sx={{ fontWeight: 700, mb: 0.6 }}>Deductions</Typography>
                  {previewDeductions.length > 0 ? (
                    previewDeductions.map((item, idx) => (
                      <Box key={`deduction-${idx}`} sx={{ display: "flex", justifyContent: "space-between", py: 0.25 }}>
                        <Typography sx={{ color: "#4a3b61" }}>{item.label}</Typography>
                        <Typography sx={{ fontWeight: 600 }}>{formatINR(item.amount)}</Typography>
                      </Box>
                    ))
                  ) : (
                    <Typography sx={{ color: "#6b5a7a" }}>No deductions added</Typography>
                  )}
                  {SHOW_PF_SECTION && parseNumber(paymentDetails.pfPercentage) > 0 && (
                    <Typography sx={{ color: "#6b5a7a", fontSize: "0.82rem", mt: 0.4 }}>
                      PF is calculated on Basic Salary {formatINR(pfBaseSalary)}
                    </Typography>
                  )}
                  {lopDeductionAmount > 0 && (
                    <Typography sx={{ color: "#6b5a7a", fontSize: "0.82rem" }}>
                      LOP: {lopDays} day{lopDays === 1 ? "" : "s"}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ borderTop: "1px solid rgba(53,17,83,0.12)", pt: 1.2, mt: 0.5 }}>
                  <Typography sx={{ fontSize: "1.2rem", fontWeight: 800, color: "#351153" }}>
                    Final Net Salary: {formatINR(finalNetSalary)}
                  </Typography>
                </Box>
                <Typography sx={{ color: "#6b5a7a", fontSize: "0.88rem" }}>
                  This payslip PDF will be sent to: {data?.email || "N/A"}
                </Typography>
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
                disabled={sendingEmail}
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
