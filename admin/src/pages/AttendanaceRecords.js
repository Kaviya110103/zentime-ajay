import React, { useState, useEffect, useMemo, useRef } from "react";
import { format, parseISO, isValid, parse } from "date-fns";
import * as XLSX from "xlsx/dist/xlsx.mini.min";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  Divider,
  AppBar,
  Toolbar,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from "@mui/material";

import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import PrintIcon from "@mui/icons-material/Print";
import TodayIcon from "@mui/icons-material/Today";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import { API_BASE_URL, fetchWithTimeout } from "../config/api";

function AttendanceFilters() {
  const client = JSON.parse(localStorage.getItem("loggedInClient"));
  const clientId = client?.id;
  const baseOrigin = API_BASE_URL;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [weekOffCount, setWeekOffCount] = useState(0);
  const [holidayCount, setHolidayCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);
  const [employeeSummaryModalOpen, setEmployeeSummaryModalOpen] = useState(false);
  const [todayStatus, setTodayStatus] = useState(null);
  const tableRef = useRef(null);
  const defaultLoadStartedRef = useRef(false);
  const [employeeDirectory, setEmployeeDirectory] = useState([]);
  const [additionalWorkingByEmployee, setAdditionalWorkingByEmployee] = useState({});
  const [overtimeRequests, setOvertimeRequests] = useState([]);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [overtimeError, setOvertimeError] = useState(null);
  const [overtimeActionId, setOvertimeActionId] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    date: "",
    timeIn: "",
    timeOut: "",
    attendanceStatus: "Present",
    dayStatus: "",
    location: "",
    missedTimes: "",
    overtime: "",
    permissionUsed: "",
  });
  const [showAttendanceActions, setShowAttendanceActions] = useState(false);
  const actionShortcutKeysRef = useRef(new Set());
  const actionShortcutArmedRef = useRef(false);

  const [filters, setFilters] = useState({
    employeeId: "",
    branch: "",
    startDate: null,
    endDate: null,
    date: null,
    month: "",
    year: "",
    attendanceStatus: "",
    filterType: "basic",
  });

  const withClientId = (url) => {
    if (!clientId) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}clientId=${encodeURIComponent(clientId)}`;
  };

  useEffect(() => {
    const normalizeKey = (key) => {
      if (key === "Left") return "ArrowLeft";
      return key;
    };

    const handleKeyDown = (event) => {
      const key = normalizeKey(event.key);
      actionShortcutKeysRef.current.add(key);
      const hasShortcut =
        actionShortcutKeysRef.current.has("ArrowLeft") &&
        actionShortcutKeysRef.current.has("F1");

      if (hasShortcut && !actionShortcutArmedRef.current) {
        actionShortcutArmedRef.current = true;
        setShowAttendanceActions((value) => !value);
        event.preventDefault();
      }
    };

    const handleKeyUp = (event) => {
      const key = normalizeKey(event.key);
      actionShortcutKeysRef.current.delete(key);
      if (["ArrowLeft", "F1"].includes(key)) {
        actionShortcutArmedRef.current = false;
      }
    };

    const clearShortcutKeys = () => {
      actionShortcutKeysRef.current.clear();
      actionShortcutArmedRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearShortcutKeys);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearShortcutKeys);
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "branch" ? { employeeId: "" } : {}),
    }));
  };

  const handleDateChange = (date, field) => {
    setFilters((prev) => ({
      ...prev,
      [field]: date,
    }));
  };

  const selectedMonthYear = useMemo(() => {
    const monthNumber = Number(filters.month);
    const yearNumber = Number(filters.year);
    if (
      Number.isInteger(monthNumber) &&
      monthNumber >= 1 &&
      monthNumber <= 12 &&
      Number.isInteger(yearNumber)
    ) {
      return new Date(yearNumber, monthNumber - 1, 1);
    }
    return null;
  }, [filters.month, filters.year]);

  const handleMonthYearChange = (date) => {
    if (!date || !isValid(date)) {
      setFilters((prev) => ({
        ...prev,
        month: "",
        year: "",
      }));
      return;
    }

    setFilters((prev) => ({
      ...prev,
      month: String(date.getMonth() + 1),
      year: String(date.getFullYear()),
    }));
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

  const toDateTimeLocalValue = (value) => {
    const parsed = parseRecordDateTime(value);
    return parsed ? format(parsed, "yyyy-MM-dd'T'HH:mm") : "";
  };

  const formatDayName = (dateString) => {
    const recordDate = parseRecordDate(dateString);
    if (!recordDate) return "-";
    return format(recordDate, "EEEE");
  };

  const buildDateKey = (dateValue) => {
    const parsed = parseRecordDate(dateValue);
    if (!parsed) return null;
    return format(parsed, "yyyy-MM-dd");
  };

  const getEmployeeAdditionalWorkingList = (employee) => {
    if (!employee) return [];
    const direct = employee.additionalWorkingDays || employee.additionalWorkingDay;
    if (Array.isArray(direct) && direct.length > 0) return direct;
    const employeeId = employee.id ?? employee.employeeId;
    const cached = employeeId != null ? additionalWorkingByEmployee[String(employeeId)] : null;
    return Array.isArray(cached) ? cached : [];
  };

  const formatShiftRange = (startTime, endTime) => {
    if (!startTime || !endTime) return "N/A";
    const formatShiftTime = (value) => {
      if (!value) return "-";
      const parsed = parseRecordDateTime(value);
      return parsed ? format(parsed, "HH:mm") : String(value);
    };
    return `${formatShiftTime(startTime)} - ${formatShiftTime(endTime)}`;
  };

  const getLateArrivalMinutes = (record) => {
    if (record?.lateMinutes != null && Number.isFinite(Number(record.lateMinutes))) {
      return Math.max(0, Number(record.lateMinutes));
    }
    return 0;
  };

  const getLateArrivalDisplay = (record) => {
    const minutes = getLateArrivalMinutes(record);
    return minutes > 0 ? `${minutes} min` : "-";
  };

  const getComputedMissedMinutes = (record) => {
    const hasLateMinutes = record?.lateMinutes != null && Number.isFinite(Number(record.lateMinutes));
    const hasEarlyOutMinutes = record?.earlyOutMinutes != null && Number.isFinite(Number(record.earlyOutMinutes));
    if (hasLateMinutes || hasEarlyOutMinutes) {
      return Math.max(
        0,
        (hasLateMinutes ? Number(record.lateMinutes) : 0) +
          (hasEarlyOutMinutes ? Number(record.earlyOutMinutes) : 0)
      );
    }
    if (record?.calculatedMissedMinutes != null && Number.isFinite(Number(record.calculatedMissedMinutes))) {
      return Math.max(0, Number(record.calculatedMissedMinutes));
    }
    return Number(record?.missedTimes || 0);
  };

  const getDerivedStatus = (record) => {
    if (!record) return "-";
    if (record.displayStatus) {
      return String(record.displayStatus);
    }
    if (record.countStatus) {
      return String(record.countStatus);
    }
    return String(record.attendanceStatus || "-");
  };

  const normalizeAttendanceStatus = (status) => {
    const normalized = String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

    if (!normalized) return "";
    if (normalized.includes("present")) return "Present";
    if (normalized.includes("absent")) return "Absent";
    if (normalized.includes("weekoff") || normalized.includes("weekendoff")) return "Week Off";
    if (normalized.includes("holiday")) return "Holiday";
    return "";
  };

  const getRecordStatusBucket = (record) => {
    if (record?.countStatus) {
      return normalizeAttendanceStatus(record.countStatus) || String(record.countStatus);
    }
    return normalizeAttendanceStatus(getDerivedStatus(record));
  };

  const updateSummaryCounts = (items) => {
    setTotalRecords(items.length);
    setPresentCount(items.filter((record) => getRecordStatusBucket(record) === "Present").length);
    setAbsentCount(items.filter((record) => getRecordStatusBucket(record) === "Absent").length);
    setWeekOffCount(items.filter((record) => getRecordStatusBucket(record) === "Week Off").length);
    setHolidayCount(items.filter((record) => getRecordStatusBucket(record) === "Holiday").length);
    setLateCount(items.filter((record) => getRecordStatusBucket(record) === "Present" && getLateArrivalMinutes(record) > 0).length);
  };

  const sortRecords = (items) => {
    return [...items].sort((a, b) => {
      const dateA = parseRecordDate(a.date);
      const dateB = parseRecordDate(b.date);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB - dateA;
      }

      const timeA = parseRecordDateTime(a.timeIn);
      const timeB = parseRecordDateTime(b.timeIn);
      if (!timeA && !timeB) return 0;
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeB - timeA;
    });
  };

  useEffect(() => {
    if (!clientId) {
      setEmployeeDirectory([]);
      setAdditionalWorkingByEmployee({});
      return;
    }

    const fetchEmployeeDirectory = async () => {
      try {
        const response = await fetchWithTimeout(
          withClientId(`${baseOrigin}/api/employees`)
        );
        if (!response.ok) {
          setEmployeeDirectory([]);
          return;
        }
        const data = await response.json();
        setEmployeeDirectory(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching employee directory:", err);
        setEmployeeDirectory([]);
      }
    };

    fetchEmployeeDirectory();
  }, [clientId, baseOrigin]);

  const fetchEmployeeAdditionalWorkingDays = async (employee) => {
    const employeeId = employee?.id ?? employee?.employeeId;
    if (!clientId || employeeId == null) return [];
    const cacheKey = String(employeeId);
    if (Array.isArray(additionalWorkingByEmployee[cacheKey])) {
      return additionalWorkingByEmployee[cacheKey];
    }

    try {
      const response = await fetchWithTimeout(
        withClientId(`${baseOrigin}/api/employees/${encodeURIComponent(employeeId)}/additional-working-days`)
      );
      if (!response.ok) return [];
      const data = await response.json();
      const days = Array.isArray(data) ? data : [];
      setAdditionalWorkingByEmployee((prev) => ({
        ...prev,
        [cacheKey]: days,
      }));
      setEmployeeDirectory((prev) =>
        prev.map((item) => {
          const itemId = item?.id ?? item?.employeeId;
          return String(itemId) === cacheKey
            ? { ...item, additionalWorkingDays: days }
            : item;
        })
      );
      return days;
    } catch (err) {
      console.error("Error fetching additional working days:", err);
      return [];
    }
  };

  const fetchOvertimeRequests = async () => {
    if (!clientId) {
      setOvertimeRequests([]);
      return;
    }
    setOvertimeLoading(true);
    setOvertimeError(null);
    try {
      const response = await fetchWithTimeout(
        withClientId(`${baseOrigin}/api/overtime-requests`)
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch overtime requests (${response.status})`);
      }
      const data = await response.json();
      setOvertimeRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching overtime requests:", err);
      setOvertimeError("Failed to fetch overtime requests.");
      setOvertimeRequests([]);
    } finally {
      setOvertimeLoading(false);
    }
  };

  useEffect(() => {
    fetchOvertimeRequests();
  }, [clientId, baseOrigin]);

  const handleOvertimeDecision = async (requestId, action) => {
    if (!requestId || !action) return;
    setOvertimeActionId(requestId);
    setOvertimeError(null);
    try {
      const response = await fetchWithTimeout(
        withClientId(`${baseOrigin}/api/overtime-requests/${encodeURIComponent(requestId)}/${action}`),
        { method: "POST" }
      );
      if (!response.ok) {
        throw new Error(`Failed to ${action} overtime request`);
      }
      await fetchOvertimeRequests();
      setSuccess(`Overtime request ${action === "approve" ? "approved" : "rejected"} successfully.`);
    } catch (err) {
      console.error("Overtime decision error:", err);
      setOvertimeError(`Failed to ${action} overtime request.`);
    } finally {
      setOvertimeActionId(null);
    }
  };

  const employeeDirectoryIndex = useMemo(() => {
    const byId = new Map();
    const byEmployeeId = new Map();
    const byCode = new Map();

    employeeDirectory.forEach((employee) => {
      if (employee?.id != null) {
        byId.set(String(employee.id), employee);
      }
      if (employee?.employeeId != null) {
        byEmployeeId.set(String(employee.employeeId), employee);
      }
      if (employee?.employeeCode) {
        byCode.set(String(employee.employeeCode).toLowerCase(), employee);
      }
      if (employee?.code) {
        byCode.set(String(employee.code).toLowerCase(), employee);
      }
    });

    return { byId, byEmployeeId, byCode };
  }, [employeeDirectory]);

  const getEmployeeBranch = (employee) => String(employee?.branch || "").trim();

  const employeeMatchesSelectedBranch = (employee, branch) => {
    const selectedBranch = String(branch || "").trim().toLowerCase();
    if (!selectedBranch) return true;
    return getEmployeeBranch(employee).toLowerCase() === selectedBranch;
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
      .filter((employee) => employeeMatchesSelectedBranch(employee, filters.branch))
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
  }, [employeeDirectory, filters.branch]);

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
    const raw = String(filters.employeeId || "").trim();
    if (!raw) return "";
    return employeeNameOptions.some((option) => option.value === raw) ? raw : "";
  }, [filters.employeeId, employeeNameOptions]);

  const handleEmployeeNameChange = (e) => {
    const selectedValue = String(e.target.value || "");
    setFilters((prev) => ({
      ...prev,
      employeeId: selectedValue,
    }));
  };

  const getEmployeeSummaryFromFilter = () => {
    const raw = String(filters.employeeId || "").trim();
    if (!raw) return null;

    const lowered = raw.toLowerCase();
    const match =
      employeeDirectoryIndex.byId.get(raw) ||
      employeeDirectoryIndex.byEmployeeId.get(raw) ||
      employeeDirectoryIndex.byCode.get(lowered);

    if (match) return match;

    return (
      records.find((record) => {
        const employee = record?.employee;
        if (!employee) return false;
        const candidates = [
          employee.id,
          employee.employeeId,
          employee.employeeCode,
          employee.code,
        ]
          .filter((value) => value != null)
          .map((value) => String(value).toLowerCase());
        return candidates.includes(lowered);
      })?.employee || null
    );
  };

  const selectedEmployeeSummary = useMemo(
    () => getEmployeeSummaryFromFilter(),
    [filters.employeeId, employeeDirectoryIndex, records]
  );

  useEffect(() => {
    if (!selectedEmployeeSummary) return;
    const existing = getEmployeeAdditionalWorkingList(selectedEmployeeSummary);
    if (existing.length > 0) return;
    fetchEmployeeAdditionalWorkingDays(selectedEmployeeSummary);
  }, [selectedEmployeeSummary?.id, selectedEmployeeSummary?.employeeId]);

  const additionalWorkingSummaryRows = useMemo(() => {
    if (!selectedEmployeeSummary) return [];
    const entries = getEmployeeAdditionalWorkingList(selectedEmployeeSummary);
    const labelMap = {
      ODD_SATURDAY: "Odd Saturday",
      EVEN_SATURDAY: "Even Saturday",
      ODD_SUNDAY: "Odd Sunday",
      EVEN_SUNDAY: "Even Sunday",
    };
    const orderMap = {
      ODD_SATURDAY: 1,
      EVEN_SATURDAY: 2,
      ODD_SUNDAY: 3,
      EVEN_SUNDAY: 4,
    };
    const sorted = [...entries].sort((a, b) =>
      (orderMap[String(a?.dayType || "").toUpperCase()] || 99) -
      (orderMap[String(b?.dayType || "").toUpperCase()] || 99)
    );
    return sorted.map((entry) => {
      const key = String(entry?.dayType || "").toUpperCase();
      return {
        dayType: key,
        label: labelMap[key] || key,
        value: formatShiftRange(entry?.timeIn, entry?.timeOut),
      };
    });
  }, [selectedEmployeeSummary, additionalWorkingByEmployee]);

  const rotationalWeekOffSummaryRows = useMemo(() => {
    const configured = new Set(additionalWorkingSummaryRows.map((entry) => entry.dayType));
    const pairs = [
      ["ODD_SATURDAY", "EVEN_SATURDAY"],
      ["ODD_SUNDAY", "EVEN_SUNDAY"],
    ];
    const labelMap = {
      ODD_SATURDAY: "Odd Saturday",
      EVEN_SATURDAY: "Even Saturday",
      ODD_SUNDAY: "Odd Sunday",
      EVEN_SUNDAY: "Even Sunday",
    };

    return pairs
      .map(([oddType, evenType]) => {
        const hasOdd = configured.has(oddType);
        const hasEven = configured.has(evenType);
        if (hasOdd === hasEven) return null;
        return hasOdd ? labelMap[evenType] : labelMap[oddType];
      })
      .filter(Boolean);
  }, [additionalWorkingSummaryRows]);

  const enrichRecordsWithEmployeeDetails = (items) => {
    if (!Array.isArray(items) || items.length === 0) return [];
    return items.map((record) => {
      const baseEmployee = record?.employee || {};
      const idCandidates = [
        record?.employee?.id,
        record?.employeeId,
        record?.employee?.employeeId,
      ]
        .filter((value) => value != null)
        .map((value) => String(value));
      const codeCandidates = [
        record?.employee?.employeeCode,
        record?.employee?.code,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      let matched = null;
      for (const idValue of idCandidates) {
        matched =
          employeeDirectoryIndex.byId.get(idValue) ||
          employeeDirectoryIndex.byEmployeeId.get(idValue);
        if (matched) break;
      }
      if (!matched) {
        for (const codeValue of codeCandidates) {
          matched = employeeDirectoryIndex.byCode.get(codeValue);
          if (matched) break;
        }
      }

      const employeeKey =
        matched?.id ?? matched?.employeeId ?? baseEmployee?.id ?? baseEmployee?.employeeId;
      const cachedAdditionalWorkingDays =
        employeeKey != null ? additionalWorkingByEmployee[String(employeeKey)] : null;
        const mergedEmployee = matched ? { ...baseEmployee, ...matched } : baseEmployee;

      return {
        ...record,
        employee: Array.isArray(cachedAdditionalWorkingDays)
          ? { ...mergedEmployee, additionalWorkingDays: cachedAdditionalWorkingDays }
          : mergedEmployee,
      };
    });
  };

  // Build URL based on filter type
  const buildUrl = (activeFilters = filters) => {
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    if (activeFilters.employeeId) params.set("employeeId", activeFilters.employeeId);
    if (activeFilters.branch) params.set("branch", activeFilters.branch);
    if (activeFilters.date) params.set("date", format(activeFilters.date, "dd/MM/yyyy"));
    if (activeFilters.startDate) params.set("startDate", format(activeFilters.startDate, "dd/MM/yyyy"));
    if (activeFilters.endDate) params.set("endDate", format(activeFilters.endDate, "dd/MM/yyyy"));
    if (activeFilters.month) params.set("month", activeFilters.month);
    if (activeFilters.year) params.set("year", activeFilters.year);
    if (activeFilters.attendanceStatus) params.set("status", activeFilters.attendanceStatus);
    params.set("limit", "5000");
    return `${baseOrigin}/api/attendance-records/search?${params.toString()}`;
  };

  const fetchAttendanceRecords = async (activeFilters = filters, options = {}) => {
    const { showSuccess = true } = options;
    setLoading(true);
    setError(null);
    if (showSuccess) {
      setSuccess(null);
    }
    setTodayStatus(null);

    try {
      const url = buildUrl(activeFilters);
      console.log("Fetching from URL:", url);

      const response = await fetchWithTimeout(url);

      if (response.status === 404) {
        setRecords([]);
        updateSummaryCounts([]);
        if (showSuccess) {
          setSuccess("No records found.");
        }
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      let data = await response.json();

      // Handle different response formats
      const normalizeRecords = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (payload?.records && Array.isArray(payload.records)) return payload.records;
        if (payload?.data && Array.isArray(payload.data)) return payload.data;
        if (payload?.items && Array.isArray(payload.items)) return payload.items;
        return payload ? [payload] : [];
      };

      // Response from attendance-records endpoints is usually an array
      const arr = normalizeRecords(data);
      const filteredRecords = arr.filter((item) => item != null);

      const sortedRecords = sortRecords(filteredRecords);
      const statusFilteredRecords = enrichRecordsWithEmployeeDetails(sortedRecords);
      setRecords(statusFilteredRecords);
      updateSummaryCounts(statusFilteredRecords);

      const present = statusFilteredRecords.filter((record) => getRecordStatusBucket(record) === "Present").length;
      const absent = statusFilteredRecords.filter((record) => getRecordStatusBucket(record) === "Absent").length;
      const weekOff = statusFilteredRecords.filter((record) => getRecordStatusBucket(record) === "Week Off").length;
      const holiday = statusFilteredRecords.filter((record) => getRecordStatusBucket(record) === "Holiday").length;
      
      if (showSuccess) {
        setSuccess(
          `Found ${statusFilteredRecords.length} records (${present} Present, ${absent} Absent, ${weekOff} Week Off, ${holiday} Holiday)`
        );
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Error fetching data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetchAttendanceRecords(filters);
  };

  useEffect(() => {
    if (!clientId || defaultLoadStartedRef.current) {
      return;
    }
    defaultLoadStartedRef.current = true;
    fetchAttendanceRecords(filters, { showSuccess: false });
  }, [clientId]);

  const handleReset = () => {
    const resetFilters = {
      employeeId: "",
      branch: "",
      startDate: null,
      endDate: null,
      date: null,
      month: "",
      year: "",
      attendanceStatus: "",
      filterType: "basic",
    };
    setFilters(resetFilters);
    setError(null);
    setSuccess(null);
    setTodayStatus(null);
    fetchAttendanceRecords(resetFilters, { showSuccess: false });
  };

  const exportToExcel = () => {
    const headers = [
      "Date",
      "Day",
      "Employee Name",
      "Employee Code",
      "Branch",
      "Status",
      "Time In",
      "Time Out",
      "Worked Minutes",
      "Working Hours",
      "Late Minutes",
      "Early Out Minutes",
      "Missed Minutes",
      "Shift Start",
      "Shift End",
      "Expected Minutes",
      "Location",
      "Week Off",
      "Holiday",
      "Additional Working Day",
    ];

    const parseBusinessDateForExcel = (value) => {
      if (!value) return "";
      const text = String(value).trim();

      let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        return new Date(Number(year), Number(month) - 1, Number(day));
      }

      match = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
      if (match) {
        const [, day, month, year] = match;
        return new Date(Number(year), Number(month) - 1, Number(day));
      }

      const parsed = parseRecordDate(text);
      if (!parsed) return text;
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    };

    const rows = records.map((record) => [
      parseBusinessDateForExcel(record.date),
      formatDayName(record.date),
      record.employee
        ? `${record.employee.firstName} ${record.employee.lastName || ""}`
        : "-",
      record.employee?.employeeCode || "-",
      record.employee?.branch || "-",
      getDerivedStatus(record),
      formatTime(record.timeIn),
      formatTime(record.timeOut),
      record.workedMinutes ?? "",
      formatWorkingHoursFromMinutes(record.workedMinutes),
      getLateArrivalMinutes(record),
      record.earlyOutMinutes ?? 0,
      getComputedMissedMinutes(record),
      record.expectedShiftStart || "",
      record.expectedShiftEnd || "",
      record.expectedMinutes ?? "",
      record.location || "-",
      record.weekOff ? "Yes" : "No",
      record.holiday ? "Yes" : "No",
      record.additionalWorkingDay ? "Yes" : "No",
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet["!cols"] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 25 },
      { wch: 16 },
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 15 },
      { wch: 15 },
      { wch: 16 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 22 },
    ];

    rows.forEach((row, index) => {
      if (row[0] instanceof Date) {
        const cellAddress = XLSX.utils.encode_cell({ r: index + 1, c: 0 });
        worksheet[cellAddress].t = "d";
        worksheet[cellAddress].z = "dd-mmm-yyyy";
      }
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Records");
    XLSX.writeFile(workbook, `attendance_records_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`, {
      bookType: "xlsx",
      compression: true,
    });
  };

  const findTodayRecord = (items) => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const employeeRef = String(filters.employeeId || "").trim();
    return items.find((record) => {
      if (buildDateKey(record?.date) !== todayKey) {
        return false;
      }
      if (!employeeRef) {
        return true;
      }
      const candidates = [
        record.employee?.id,
        record.employeeId,
        record.employee?.employeeId,
        record.employee?.employeeCode,
        record.employee?.code,
      ]
        .filter(Boolean)
        .map((value) => String(value));
      return candidates.includes(employeeRef);
    });
  };

  const checkTodayAttendance = async () => {
    if (!filters.employeeId) {
      setError("Employee ID or code is required to check today's attendance");
      return;
    }

    setLoading(true);
    setError(null);
    setTodayStatus(null);
    try {
      let todayRecord = findTodayRecord(records);

      if (!todayRecord) {
        const today = format(new Date(), "dd/MM/yyyy");
        const response = await fetchWithTimeout(
          withClientId(`${baseOrigin}/api/attendance-records/by-employee-date?employeeId=${encodeURIComponent(filters.employeeId)}&date=${encodeURIComponent(today)}`)
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch today's attendance (${response.status})`);
        }

        const payload = await response.json();
        const fetchedRecords = Array.isArray(payload)
          ? payload
          : payload
          ? [payload]
          : [];
        const enrichedRecords = enrichRecordsWithEmployeeDetails(
          fetchedRecords.filter((item) => item != null)
        );
        todayRecord = findTodayRecord(enrichedRecords) || enrichedRecords[0];
      }

      if (todayRecord) {
        setTodayStatus({
          status: getDerivedStatus(todayRecord),
          timeIn: formatTime(todayRecord.timeIn),
          location: todayRecord.location || "-",
        });
        return;
      }

      const response = await fetchWithTimeout(
        withClientId(`${baseOrigin}/api/attendance-records/check-today-attendance?employeeId=${encodeURIComponent(filters.employeeId)}`)
      );
      
      if (response.ok) {
        const result = await response.text();
        setTodayStatus({
          status: result || "No attendance for today",
          timeIn: "-",
          location: "-",
        });
      } else {
        setError("Failed to check today's attendance");
      }
    } catch (err) {
      setError("Error checking today's attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const raw = String(filters.employeeId || "").trim();
    if (!raw || !filters.branch) return;

    const lowered = raw.toLowerCase();
    const selectedEmployee =
      employeeDirectoryIndex.byId.get(raw) ||
      employeeDirectoryIndex.byEmployeeId.get(raw) ||
      employeeDirectoryIndex.byCode.get(lowered);

    if (selectedEmployee && !employeeMatchesSelectedBranch(selectedEmployee, filters.branch)) {
      setFilters((prev) => ({ ...prev, employeeId: "" }));
    }
  }, [filters.branch, filters.employeeId, employeeDirectoryIndex]);

  const openEditDialog = (record) => {
    if (!record || record.__synthetic) return;
    setEditingRecord(record);
    setEditForm({
      date: record.date || "",
      timeIn: toDateTimeLocalValue(record.timeIn),
      timeOut: toDateTimeLocalValue(record.timeOut),
      attendanceStatus: record.attendanceStatus || getRecordStatusBucket(record) || "Present",
      dayStatus: record.dayStatus || "",
      location: record.location || "",
      missedTimes: record.missedTimes ?? "",
      overtime: record.overtime ?? "",
      permissionUsed: record.permissionUsed ?? "",
    });
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setEditDialogOpen(false);
    setEditingRecord(null);
  };

  const handleEditFormChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const compactEditPayload = () => {
    const nullableText = (value) => {
      const text = String(value ?? "").trim();
      return text ? text : null;
    };
    const nullableNumber = (value) => {
      const text = String(value ?? "").trim();
      if (!text) return null;
      const parsed = Number(text);
      return Number.isFinite(parsed) ? parsed : null;
    };

    return {
      date: nullableText(editForm.date),
      timeIn: nullableText(editForm.timeIn),
      timeOut: nullableText(editForm.timeOut),
      attendanceStatus: nullableText(editForm.attendanceStatus),
      dayStatus: nullableText(editForm.dayStatus),
      location: nullableText(editForm.location),
      missedTimes: nullableNumber(editForm.missedTimes),
      overtime: nullableNumber(editForm.overtime),
      permissionUsed: nullableNumber(editForm.permissionUsed),
    };
  };

  const readErrorMessage = async (response, fallback) => {
    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await response.json();
        return body?.message || body?.error || fallback;
      }
      const text = await response.text();
      return text || fallback;
    } catch {
      return fallback;
    }
  };

  const saveAttendanceRecord = async () => {
    if (!editingRecord?.id) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetchWithTimeout(
        withClientId(`${baseOrigin}/api/attendance-records/${encodeURIComponent(editingRecord.id)}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(compactEditPayload()),
        }
      );
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to save attendance record (${response.status})`));
      }
      closeEditDialog();
      setSuccess("Attendance record updated.");
      await fetchAttendanceRecords(filters, { showSuccess: false });
    } catch (err) {
      console.error("Attendance update error:", err);
      setError(err.message || "Unable to update attendance record.");
    } finally {
      setLoading(false);
    }
  };

  const deleteAttendanceRecord = async (record) => {
    if (!record?.id || record.__synthetic) return;
    const employeeName = record.employee
      ? `${record.employee.firstName || ""} ${record.employee.lastName || ""}`.trim()
      : "this employee";
    if (!window.confirm(`Delete attendance record for ${employeeName || "this employee"} on ${record.date || "selected date"}?`)) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetchWithTimeout(
        withClientId(`${baseOrigin}/api/attendance-records/${encodeURIComponent(record.id)}`),
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to delete attendance record (${response.status})`));
      }
      setSuccess("Attendance record deleted.");
      await fetchAttendanceRecords(filters, { showSuccess: false });
    } catch (err) {
      console.error("Attendance delete error:", err);
      setError(err.message || "Unable to delete attendance record.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Attendance Records</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
            }
            h1 {
              text-align: center;
              font-size: 18px;
              margin-bottom: 5px;
            }
            .summary {
              text-align: center;
              font-size: 12px;
              margin-bottom: 5px;
              color: #555;
            }
            .print-date {
              text-align: center;
              font-size: 12px;
              margin-bottom: 15px;
              color: #555;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            th {
              background-color: #351153;
              color: white;
              padding: 8px;
              text-align: left;
              font-weight: bold;
            }
            td {
              padding: 6px;
              border-bottom: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background-color: #f5f5f5;
            }
          </style>
        </head>
        <body>
          <h1>Attendance Records</h1>
          <div class="summary">Total Records: ${totalRecords} | Present: ${presentCount} | Absent: ${absentCount} | Week Off: ${weekOffCount} | Holiday: ${holidayCount} | Late: ${lateCount}</div>
          <div class="print-date">Generated on: ${format(
            new Date(),
            "dd MMM yyyy HH:mm"
          )}</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Employee</th>
                <th>Status</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Working Hours</th>
                <th>Late Arrival (min)</th>
                <th>Early Out (min)</th>
                <th>Missed Minutes</th>
                <th>Shift Start</th>
                <th>Shift End</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map(
                  (record) => `
                <tr>
                  <td>${safeFormatDate(record.date, "dd MMM yyyy")}</td>
                  <td>${formatDayName(record.date)}</td>
                  <td>${
                    record.employee
                      ? `${record.employee.firstName} ${
                          record.employee.lastName || ""
                        }`
                      : "-"
                  }</td>
                  <td>${getDerivedStatus(record)}</td>
                  <td>${formatTime(record.timeIn)}</td>
                  <td>${formatTime(record.timeOut)}</td>
                  <td>${formatWorkingHoursFromMinutes(record.workedMinutes)}</td>
                  <td>${getLateArrivalDisplay(record)}</td>
                  <td>${record.earlyOutMinutes ?? 0}</td>
                  <td>${getComputedMissedMinutes(record)}</td>
                  <td>${record.expectedShiftStart || "-"}</td>
                  <td>${record.expectedShiftEnd || "-"}</td>
                  <td>${record.location || "-"}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const safeFormatDate = (dateString, formatStr) => {
    if (!dateString) return "-";
    try {
      const isoDate = parseISO(dateString);
      if (isValid(isoDate)) return format(isoDate, formatStr);
      const ddMMyyyy = parse(dateString, "dd/MM/yyyy", new Date());
      return isValid(ddMMyyyy) ? format(ddMMyyyy, formatStr) : dateString;
    } catch {
      return dateString;
    }
  };

  const summaryRows = useMemo(() => {
    if (!selectedEmployeeSummary) return [];
    const rows = [
      {
        label: "Week Off Day",
        value: selectedEmployeeSummary.weekOff || "N/A",
      },
      {
        label: "Leave Policy",
        value: selectedEmployeeSummary.leavePolicyType || "N/A",
      },
      {
        label: "Regular Shift",
        value: formatShiftRange(
          selectedEmployeeSummary.shiftStartTime,
          selectedEmployeeSummary.shiftEndTime
        ),
      },
    ];

    if (additionalWorkingSummaryRows.length > 0) {
      rows.push({
        label: "Additional Working Day",
        value: additionalWorkingSummaryRows
          .map((entry) => `${entry.label} - ${entry.value}`)
          .join(", "),
      });
    } else {
      rows.push({
        label: "Additional Working",
        value: "Not configured",
      });
    }
    if (rotationalWeekOffSummaryRows.length > 0) {
      rows.push({
        label: "Rotational Week Off",
        value: rotationalWeekOffSummaryRows.join(", "),
      });
    }

    return rows;
  }, [selectedEmployeeSummary, additionalWorkingSummaryRows, rotationalWeekOffSummaryRows]);

  const formatTime = (timeString) => {
    if (!timeString) return "-";
    try {
      const isoDate = parseISO(timeString);
      if (isValid(isoDate)) return format(isoDate, "HH:mm:ss");
      const timeWithSeconds = parse(timeString, "HH:mm:ss", new Date());
      if (isValid(timeWithSeconds)) return format(timeWithSeconds, "HH:mm:ss");
      const timeWithoutSeconds = parse(timeString, "HH:mm", new Date());
      if (isValid(timeWithoutSeconds)) return format(timeWithoutSeconds, "HH:mm:ss");
      return timeString;
    } catch {
      return timeString;
    }
  };

  const formatBusinessDate = (dateString) => {
    if (!dateString) return "";
    const parsed = parseRecordDate(dateString);
    return parsed ? format(parsed, "dd/MM/yyyy") : String(dateString);
  };

  const formatWorkingHoursFromMinutes = (minutes) => {
    const totalMinutes = Number(minutes);
    if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "-";
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.round(totalMinutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    try {
      const parsed = parseISO(value);
      if (isValid(parsed)) return format(parsed, "dd MMM yyyy HH:mm");
      return String(value);
    } catch {
      return String(value);
    }
  };

  const formatOvertimeHours = (value) => {
    const num = Number(value || 0);
    if (Number.isNaN(num) || num <= 0) return "0.00 h";
    return `${num.toFixed(2)} h`;
  };

  const filterCardSx = {
    mb: 3,
    borderRadius: 3,
    border: "1px solid rgba(53,17,83,0.14)",
    boxShadow: "0 14px 34px rgba(53,17,83,0.12)",
    backgroundColor: "#ffffff",
  };

  const filterHeaderIconSx = {
    width: 52,
    height: 52,
    borderRadius: 2,
    backgroundColor: "rgba(53,17,83,0.08)",
    color: "#351153",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  };

  const filterGridSx = {
    display: "grid",
    gridTemplateColumns: {
      xs: "1fr",
      md: "repeat(2, minmax(0, 1fr))",
      lg: "repeat(3, minmax(0, 1fr))",
    },
    gap: { xs: 2.25, md: 3 },
    mt: 4,
  };

  const fieldLabelSx = {
    mb: 1,
    color: "#1f1a2e",
    fontWeight: 700,
    fontSize: 14,
  };

  const filterInputSx = {
    "& .MuiOutlinedInput-root": {
      height: 48,
      borderRadius: 2,
      backgroundColor: "#ffffff",
      "& fieldset": {
        borderColor: "rgba(53,17,83,0.22)",
      },
      "&:hover fieldset": {
        borderColor: "rgba(53,17,83,0.45)",
      },
      "&.Mui-focused fieldset": {
        borderColor: "#351153",
      },
    },
    "& .MuiInputBase-input, & .MuiSelect-select": {
      color: "#2a1e3f",
      fontWeight: 500,
    },
  };

  const selectSx = {
    ...filterInputSx,
    "& .MuiSelect-select": {
      display: "flex",
      alignItems: "center",
      minHeight: "auto",
      overflow: "hidden",
      pr: 4,
    },
  };

  const fieldIconSx = { color: "#351153", opacity: 0.82, fontSize: 22 };
  const placeholderSx = { color: "rgba(42,30,63,0.72)", fontWeight: 500 };

  return (
    <>
      <AppBar
        position="static"
        elevation={0}
        sx={{ backgroundColor: "#351153" }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, color: "white" }}
          >
            Attendance Records
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ fontWeight: "bold", color: "#351153" }}
        >
          Check Attendance Logs
        </Typography>

        <Card elevation={0} sx={filterCardSx}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 }, "&:last-child": { pb: { xs: 2.5, md: 4 } } }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={filterHeaderIconSx}>
                  <FilterAltIcon fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" component="h2" sx={{ color: "#1f1a2e", fontWeight: 800 }}>
                    Filter Criteria
                  </Typography>
                  <Typography sx={{ color: "rgba(42,30,63,0.74)", mt: 0.5 }}>
                    Use the filters below to search attendance logs
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <Box sx={filterGridSx}>
                <Box>
                  <Typography sx={fieldLabelSx}>Employee ID / Code</Typography>
                  <TextField
                    fullWidth
                    placeholder="Enter Employee ID / Code"
                    name="employeeId"
                    value={filters.employeeId}
                    onChange={handleInputChange}
                    variant="outlined"
                    size="small"
                    sx={filterInputSx}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlineIcon sx={fieldIconSx} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Employee Name</Typography>
                  <FormControl fullWidth size="small" sx={selectSx}>
                    <Select
                      value={selectedEmployeeNameValue}
                      onChange={handleEmployeeNameChange}
                      displayEmpty
                      startAdornment={
                        <InputAdornment position="start">
                          <PersonOutlineIcon sx={fieldIconSx} />
                        </InputAdornment>
                      }
                      renderValue={(selected) => {
                        if (!selected) {
                          return (
                            <Typography noWrap sx={placeholderSx}>
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
                    >
                      <MenuItem value="">All Employees</MenuItem>
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
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Select Date</Typography>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      value={filters.date}
                      onChange={(date) => handleDateChange(date, 'date')}
                      format="dd/MM/yyyy"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          placeholder: "Select Date",
                          size: "small",
                          sx: filterInputSx,
                          InputProps: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <CalendarMonthIcon sx={fieldIconSx} />
                              </InputAdornment>
                            ),
                          },
                        },
                      }}
                    />
                  </LocalizationProvider>
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Select Month & Year</Typography>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      views={["year", "month"]}
                      value={selectedMonthYear}
                      onChange={handleMonthYearChange}
                      format="MMMM yyyy"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          placeholder: "Select Month & Year",
                          size: "small",
                          sx: filterInputSx,
                          InputProps: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <CalendarMonthIcon sx={fieldIconSx} />
                              </InputAdornment>
                            ),
                          },
                        },
                      }}
                    />
                  </LocalizationProvider>
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Status</Typography>
                  <FormControl fullWidth size="small" sx={selectSx}>
                    <Select
                      name="attendanceStatus"
                      value={filters.attendanceStatus}
                      onChange={handleInputChange}
                      displayEmpty
                      startAdornment={
                        <InputAdornment position="start">
                          <ShieldOutlinedIcon sx={fieldIconSx} />
                        </InputAdornment>
                      }
                      renderValue={(selected) =>
                        selected || <Typography noWrap sx={placeholderSx}>Select Status</Typography>
                      }
                    >
                      <MenuItem value="">All Status</MenuItem>
                      <MenuItem value="Present">Present</MenuItem>
                      <MenuItem value="Absent">Absent</MenuItem>
                      <MenuItem value="Week Off">Week Off</MenuItem>
                      <MenuItem value="Holiday">Holiday</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box>
                  <Typography sx={fieldLabelSx}>Branch</Typography>
                  <FormControl fullWidth size="small" sx={selectSx}>
                    <Select
                      name="branch"
                      value={filters.branch}
                      onChange={handleInputChange}
                      displayEmpty
                      startAdornment={
                        <InputAdornment position="start">
                          <BusinessOutlinedIcon sx={fieldIconSx} />
                        </InputAdornment>
                      }
                      renderValue={(selected) =>
                        selected || <Typography noWrap sx={placeholderSx}>Select Branch</Typography>
                      }
                    >
                      <MenuItem value="">All Branches</MenuItem>
                      {branchOptions.map((branch) => (
                        <MenuItem key={branch} value={branch}>
                          {branch}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              <Box
                sx={{
                  mt: 5,
                  display: "flex",
                  gap: 2,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  startIcon={<SearchIcon />}
                  disabled={loading}
                  sx={{
                    minWidth: 150,
                    height: 52,
                    px: 4,
                    borderRadius: 2,
                    backgroundColor: "#351153",
                    "&:hover": { backgroundColor: "#4a1a6b" },
                  }}
                >
                  {loading ? <CircularProgress size={24} /> : "Search"}
                </Button>

                {filters.employeeId && (
                  <Button
                    type="button"
                    variant="outlined"
                    color="primary"
                    startIcon={<TodayIcon />}
                    onClick={checkTodayAttendance}
                    disabled={loading}
                    sx={{ height: 52, borderRadius: 2, borderColor: "rgba(53,17,83,0.25)", color: "#351153" }}
                  >
                    Check Today
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outlined"
                  color="secondary"
                  startIcon={<RefreshIcon />}
                  onClick={handleReset}
                  disabled={loading}
                  sx={{ minWidth: 125, height: 52, borderRadius: 2, color: "#351153", borderColor: "rgba(53,17,83,0.25)" }}
                >
                  Reset
                </Button>

                <Box sx={{ display: "flex", gap: 2, ml: { xs: 0, md: "auto" }, flexWrap: "wrap" }}>
                  <Button
                    type="button"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={exportToExcel}
                    disabled={records.length === 0 || loading}
                    sx={{ minWidth: 130, height: 52, borderRadius: 2, color: "#1f1a2e", borderColor: "rgba(53,17,83,0.25)" }}
                  >
                    Excel
                  </Button>

                  <Button
                    type="button"
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                    disabled={records.length === 0 || loading}
                    sx={{ minWidth: 130, height: 52, borderRadius: 2, color: "#1f1a2e", borderColor: "rgba(53,17,83,0.25)" }}
                  >
                    Print
                  </Button>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {todayStatus && (
          <Alert severity="info" sx={{ mb: 3 }} onClose={() => setTodayStatus(null)}>
            <Typography component="div" fontWeight="bold">
              Today's Attendance
            </Typography>
            <Typography component="div" variant="body2">
              Status: {todayStatus.status || "-"}
            </Typography>
            <Typography component="div" variant="body2">
              Time In: {todayStatus.timeIn || "-"}
            </Typography>
            <Typography component="div" variant="body2">
              Location: {todayStatus.location || "-"}
            </Typography>
          </Alert>
        )}

        {/* Summary Cards */}
        {totalRecords > 0 && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2}>
              <Card sx={{ backgroundColor: '#f5f5f5' }}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Records
                  </Typography>
                  <Typography variant="h4" component="div">
                    {totalRecords}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card sx={{ backgroundColor: '#e8f5e8' }}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Present
                  </Typography>
                  <Typography variant="h4" component="div" color="success.main">
                    {presentCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card sx={{ backgroundColor: '#ffebee' }}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Absent
                  </Typography>
                  <Typography variant="h4" component="div" color="error.main">
                    {absentCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card sx={{ backgroundColor: '#e3f2fd' }}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Week Off
                  </Typography>
                  <Typography variant="h4" component="div" color="info.main">
                    {weekOffCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card sx={{ backgroundColor: '#fff8e1' }}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Holiday
                  </Typography>
                  <Typography variant="h4" component="div" color="warning.main">
                    {holidayCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card sx={{ backgroundColor: '#f3ecfb' }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
                  <Typography color="textSecondary" gutterBottom sx={{ mb: 0 }}>
                    Employee Summary
                  </Typography>
                  <Button
                    type="button"
                    variant="contained"
                    onClick={() => setEmployeeSummaryModalOpen(true)}
                    disabled={!selectedEmployeeSummary}
                    sx={{
                      alignSelf: "flex-start",
                      backgroundColor: "#351153",
                      "&:hover": { backgroundColor: "#4a1a6b" },
                    }}
                  >
                    View Summary
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        <Card elevation={3} ref={tableRef}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6" component="h2">
                Results
              </Typography>
              {totalRecords > 0 && (
                <Chip
                  label={`${totalRecords} records found`}
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>

            <Divider sx={{ mb: 3 }} />

            {records.length === 0 ? (
              <Paper elevation={0} sx={{ p: 4, textAlign: "center" }}>
                <Typography variant="body1" color="textSecondary">
                  {loading
                    ? "Loading records..."
                    : "No records found. Apply filters to see results."}
                </Typography>
              </Paper>
            ) : (
              <TableContainer component={Paper} elevation={0}>
                <Table
                  sx={{
                    minWidth: 1100,
                    tableLayout: "fixed",
                    "& th, & td": {
                      px: 2,
                    },
                  }}
                  aria-label="attendance records table"
                >
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#351153" }}>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: "10%" }}>Date</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: "8%" }}>Day</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: "16%" }}>Employee</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: "10%" }}>Status</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: "9%" }}>Time In</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: "9%" }}>Time Out</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: "12%" }}>Working Hours</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: "9%" }}>Late Arrival</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: "9%" }}>Missed Times</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: showAttendanceActions ? "8%" : "18%" }}>Location</TableCell>
                      {showAttendanceActions ? (
                        <TableCell sx={{ color: "white", fontWeight: "bold", width: "10%" }}>Action</TableCell>
                      ) : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((record) => {
                      const derivedStatus = getDerivedStatus(record);
                      const statusBucket = getRecordStatusBucket(record);
                      const displayStatus = derivedStatus || statusBucket;
                      const lateArrivalMinutes = getLateArrivalMinutes(record);
                      const missedMinutes = getComputedMissedMinutes(record);
                      const statusColor =
                        displayStatus === "Present"
                          ? "success"
                          : displayStatus === "Absent"
                          ? "error"
                          : displayStatus === "Late"
                          ? "warning"
                          : displayStatus === "Week Off"
                          ? "info"
                          : displayStatus === "Holiday" || displayStatus === "Leave"
                          ? "secondary"
                          : "default";
                      return (
                      <TableRow key={record.id || Math.random()} hover>
                        <TableCell>
                          {safeFormatDate(record.date, "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>{formatDayName(record.date)}</TableCell>
                        <TableCell>
                          {record.employee ? (
                            <>
                              <Typography fontWeight="medium">
                                {`${record.employee.firstName} ${
                                  record.employee.lastName || ""
                                }`}
                              </Typography>
                            </>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={displayStatus}
                            color={statusColor}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatTime(record.timeIn)}</TableCell>
                        <TableCell>{formatTime(record.timeOut)}</TableCell>
                        <TableCell>{formatWorkingHoursFromMinutes(record.workedMinutes)}</TableCell>
                        <TableCell>
                          {lateArrivalMinutes > 0 ? (
                            <Chip
                              label={`${lateArrivalMinutes} min`}
                              color="warning"
                              size="small"
                              variant="outlined"
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${missedMinutes} min`}
                            color={missedMinutes > 0 ? "error" : "success"}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{record.location || "-"}</TableCell>
                        {showAttendanceActions ? (
                          <TableCell>
                            {!record.__synthetic ? (
                              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                <Button
                                  type="button"
                                  size="small"
                                  variant="outlined"
                                  onClick={() => openEditDialog(record)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  onClick={() => deleteAttendanceRecord(record)}
                                >
                                  Delete
                                </Button>
                              </Box>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={editDialogOpen}
          onClose={closeEditDialog}
          maxWidth="sm"
          fullWidth
          disableRestoreFocus
        >
          <DialogTitle>Edit Attendance Record</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date"
                  name="date"
                  value={editForm.date}
                  onChange={handleEditFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <Select
                    name="attendanceStatus"
                    value={editForm.attendanceStatus}
                    onChange={handleEditFormChange}
                  >
                    <MenuItem value="Present">Present</MenuItem>
                    <MenuItem value="Absent">Absent</MenuItem>
                    <MenuItem value="Week Off">Week Off</MenuItem>
                    <MenuItem value="Holiday">Holiday</MenuItem>
                    <MenuItem value="Leave">Leave</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Time In"
                  name="timeIn"
                  value={editForm.timeIn}
                  onChange={handleEditFormChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Time Out"
                  name="timeOut"
                  value={editForm.timeOut}
                  onChange={handleEditFormChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Day Status"
                  name="dayStatus"
                  value={editForm.dayStatus}
                  onChange={handleEditFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Location"
                  name="location"
                  value={editForm.location}
                  onChange={handleEditFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Missed Minutes"
                  name="missedTimes"
                  value={editForm.missedTimes}
                  onChange={handleEditFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Overtime Hours"
                  name="overtime"
                  value={editForm.overtime}
                  onChange={handleEditFormChange}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Permission Hours"
                  name="permissionUsed"
                  value={editForm.permissionUsed}
                  onChange={handleEditFormChange}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={closeEditDialog}>Cancel</Button>
            <Button type="button" variant="contained" onClick={saveAttendanceRecord} disabled={loading}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Card elevation={3} sx={{ mt: 3 }}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6" component="h2">
                Overtime Requests
              </Typography>
              <Button
                variant="outlined"
                onClick={fetchOvertimeRequests}
                disabled={overtimeLoading}
                startIcon={overtimeLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
              >
                Refresh
              </Button>
            </Box>

            {overtimeError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOvertimeError(null)}>
                {overtimeError}
              </Alert>
            )}

            {overtimeLoading ? (
              <LinearProgress sx={{ mb: 2 }} />
            ) : null}

            {overtimeRequests.length === 0 ? (
              <Paper elevation={0} sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="body2" color="textSecondary">
                  No overtime requests found.
                </Typography>
              </Paper>
            ) : (
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#351153" }}>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Employee</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Date</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Overtime</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Requested At</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Status</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {overtimeRequests.map((request) => {
                      const status = String(request?.status || "PENDING").toUpperCase();
                      const isPending = status === "PENDING";
                      const statusColor =
                        status === "APPROVED"
                          ? "success"
                          : status === "REJECTED"
                          ? "error"
                          : "warning";
                      const rowBusy = overtimeActionId === request.id;
                      return (
                        <TableRow key={request.id}>
                          <TableCell>{request.employeeName || `Employee ${request.employeeId || "-"}`}</TableCell>
                          <TableCell>{request.date || "-"}</TableCell>
                          <TableCell>{formatOvertimeHours(request.overtimeHours)}</TableCell>
                          <TableCell>{formatDateTime(request.createdAt)}</TableCell>
                          <TableCell>
                            <Chip size="small" color={statusColor} label={status} />
                          </TableCell>
                          <TableCell>
                            {isPending ? (
                              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  disabled={rowBusy}
                                  onClick={() => handleOvertimeDecision(request.id, "approve")}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="error"
                                  disabled={rowBusy}
                                  onClick={() => handleOvertimeDecision(request.id, "reject")}
                                >
                                  Reject
                                </Button>
                              </Box>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={employeeSummaryModalOpen}
          onClose={() => setEmployeeSummaryModalOpen(false)}
          fullWidth
          maxWidth="md"
          PaperProps={{
            sx: {
              borderRadius: 3,
              overflow: "hidden",
              border: "1px solid rgba(53,17,83,0.2)",
              boxShadow: "0 18px 42px rgba(53,17,83,0.25)",
            },
          }}
        >
          <DialogTitle
            sx={{
              fontWeight: 700,
              color: "#ffffff",
              background: "linear-gradient(135deg, #351153 0%, #5a2d8a 100%)",
              textAlign: "center",
              py: 1.6,
            }}
          >
            Employee Policy Summary
          </DialogTitle>
          <DialogContent
            dividers
            sx={{
              background: "linear-gradient(180deg, #faf7ff 0%, #f4edfc 100%)",
              display: "flex",
              justifyContent: "center",
              py: 2.5,
            }}
          >
            {selectedEmployeeSummary ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  border: "1px solid rgba(53,17,83,0.14)",
                  borderRadius: 2,
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                  width: "100%",
                  maxWidth: 700,
                }}
              >
                {summaryRows.map((row, index) => (
                  <Box
                    key={`summary-modal-row-${row.label}`}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "220px minmax(0, 1fr)" },
                      columnGap: 2,
                      rowGap: 0.5,
                      alignItems: "center",
                      py: 1.4,
                      px: 2,
                      borderBottom:
                        index === summaryRows.length - 1
                          ? "none"
                          : "1px solid rgba(53,17,83,0.1)",
                    }}
                  >
                    <Typography sx={{ fontWeight: 600, color: "#4a3a60" }}>
                      {row.label}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: "#1f1630" }}>
                      {row.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary" sx={{ textAlign: "center" }}>
                Search by employee ID/code or select employee name to view the summary.
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ justifyContent: "center", py: 1.5 }}>
            <Button
              variant="contained"
              onClick={() => setEmployeeSummaryModalOpen(false)}
              sx={{
                backgroundColor: "#351153",
                "&:hover": { backgroundColor: "#4a1a6b" },
                px: 3,
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Container>

    </>
  );
}

export default AttendanceFilters;




