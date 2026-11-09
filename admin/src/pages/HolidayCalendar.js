import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, isValid, parseISO, startOfMonth, startOfWeek } from "date-fns";
import "./HolidayCalendar.css";
import { API_BASE_URL } from "../config/api";
import { fetchBranchesFromLocationSet } from "../utils/branchSource";

const FALLBACK_ORIGIN = API_BASE_URL;

const parseHolidayDate = (value) => {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

const formatHolidayDate = (value) => {
  const parsed = parseHolidayDate(value);
  return parsed ? format(parsed, "dd/MM/yyyy") : "-";
};

export default function HolidayCalendar() {
  const client = JSON.parse(localStorage.getItem("loggedInClient") || "null");
  const companyCode = String(client?.companyCode || "").trim().toLowerCase();
  const tenantOrigin = companyCode ? API_BASE_URL : "";

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [branches, setBranches] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [form, setForm] = useState({
    holidayDate: "",
    holidayEndDate: "",
    holidayName: "",
    holidayType: "FULL",
    branchScope: "ALL",
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const holidayForDate = (dateKey) => holidays.find((holiday) => {
    if (!holiday?.holidayDate) return false;
    const endDate = holiday.holidayEndDate || holiday.holidayDate;
    return holiday.holidayDate <= dateKey && dateKey <= endDate;
  });

  const apiBase = tenantOrigin || FALLBACK_ORIGIN;
  const buildUrl = (path) => `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;

  const withHolidayFallback = async (primaryPath, fallbackPath, config) => {
    try {
      return await axios({ url: buildUrl(primaryPath), ...config });
    } catch (error) {
      const status = error?.response?.status;
      if (status === 404 && fallbackPath) {
        return axios({ url: buildUrl(fallbackPath), ...config });
      }
      throw error;
    }
  };

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchHolidays = async () => {
    if (!client?.id) return;
    try {
      const res = await withHolidayFallback(
        "/api/admin/holidays",
        "/admin/holidays",
        { method: "get", params: { clientId: client.id } }
      );
      setHolidays(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to load holidays", error);
      showSnackbar("Failed to load holidays.", "error");
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  useEffect(() => {
    let active = true;
    const fetchBranches = async () => {
      if (!client?.id) {
        if (active) setBranches([]);
        return;
      }
      try {
        const names = await fetchBranchesFromLocationSet(client.id);
        if (active) setBranches(names);
      } catch (error) {
        console.error("Failed to load branches", error);
        if (active) setBranches([]);
      }
    };
    fetchBranches();
    return () => {
      active = false;
    };
  }, [client?.id]);

  const handlePrevMonth = () => {
    setCurrentMonth(addMonths(currentMonth, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const openDialogForDate = (date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const existing = holidayForDate(dateKey);
    setSelectedDate(date);
    if (existing) {
      setEditingHoliday(existing);
      setForm({
        holidayDate: existing.holidayDate,
        holidayEndDate: existing.holidayEndDate || existing.holidayDate,
        holidayName: existing.holidayName || "",
        holidayType: existing.holidayType || "FULL",
        branchScope: existing.branchScope || "ALL",
      });
    } else {
      setEditingHoliday(null);
      setForm({
        holidayDate: dateKey,
        holidayEndDate: dateKey,
        holidayName: "",
        holidayType: "FULL",
        branchScope: "ALL",
      });
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingHoliday(null);
    setForm({
      holidayDate: "",
      holidayEndDate: "",
      holidayName: "",
      holidayType: "FULL",
      branchScope: "ALL",
    });
  };

  const formattedSelectedDate = form.holidayDate
    ? formatHolidayDate(form.holidayDate)
    : "";

  const handleSave = async () => {
    if (!client?.id) {
      showSnackbar("Client context missing.", "error");
      return;
    }
    if (!form.holidayDate || !form.holidayEndDate || !form.holidayName.trim()) {
      showSnackbar("From date, to date, and holiday name are required.", "error");
      return;
    }
    if (form.holidayEndDate < form.holidayDate) {
      showSnackbar("To date must be on or after the from date.", "error");
      return;
    }

    const payload = {
      clientId: client.id,
      holidayDate: form.holidayDate,
      holidayEndDate: form.holidayEndDate,
      holidayName: form.holidayName.trim(),
      holidayType: form.holidayType,
      branchScope: form.branchScope || "ALL",
    };

    try {
      if (editingHoliday?.id) {
        await withHolidayFallback(
          `/api/admin/holidays/${editingHoliday.id}`,
          `/admin/holidays/${editingHoliday.id}`,
          { method: "put", data: payload, params: { clientId: client.id } }
        );
        showSnackbar("Holiday updated.");
      } else {
        await withHolidayFallback(
          "/api/admin/holidays",
          "/admin/holidays",
          { method: "post", data: payload, params: { clientId: client.id } }
        );
        showSnackbar("Holiday added.");
      }
      await fetchHolidays();
      closeDialog();
    } catch (error) {
      const message = error?.response?.data || "Failed to save holiday.";
      showSnackbar(String(message), "error");
    }
  };

  const handleDelete = async () => {
    if (!editingHoliday?.id) return;
    try {
      await withHolidayFallback(
        `/api/admin/holidays/${editingHoliday.id}`,
        `/admin/holidays/${editingHoliday.id}`,
        { method: "delete", params: { clientId: client?.id } }
      );
      showSnackbar("Holiday deleted.");
      await fetchHolidays();
      closeDialog();
    } catch (error) {
      const message = error?.response?.data || "Failed to delete holiday.";
      showSnackbar(String(message), "error");
    }
  };

  const renderDays = () => {
    const days = [];
    const dateFormat = "EEE";
    const startDate = startOfWeek(currentMonth, { weekStartsOn: 0 });

    for (let i = 0; i < 7; i += 1) {
      days.push(
        <div className="holiday-calendar-day-name" key={i}>
          {format(addDays(startDate, i), dateFormat)}
        </div>
      );
    }
    return <div className="holiday-calendar-row">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i += 1) {
        const cellDate = new Date(day);
        const formattedDate = format(cellDate, "d");
        const dateKey = format(cellDate, "yyyy-MM-dd");
        const inMonth = isSameMonth(cellDate, monthStart);
        const holiday = holidayForDate(dateKey);

        days.push(
          <div
            className={`holiday-calendar-cell ${inMonth ? "" : "disabled"} ${
              holiday ? "holiday" : ""
            }`}
            key={dateKey}
            onClick={() => inMonth && openDialogForDate(cellDate)}
          >
            <span className="holiday-calendar-date">{formattedDate}</span>
            {holiday && (
              <span className="holiday-calendar-label">
                {holiday.holidayName}
              </span>
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="holiday-calendar-row" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="holiday-calendar-body">{rows}</div>;
  };

  const monthHolidayList = useMemo(() => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    return holidays
      .filter((holiday) => {
        if (!holiday?.holidayDate) return false;
        const date = new Date(holiday.holidayDate);
        return date.getMonth() === month && date.getFullYear() === year;
      })
      .sort((a, b) => (a.holidayDate || "").localeCompare(b.holidayDate || ""));
  }, [holidays, currentMonth]);

  return (
    <Box className="holiday-calendar-page">
      <Box className="holiday-calendar-header">
        <Typography className="holiday-calendar-title">
          Public Holiday Calendar
        </Typography>
        <Typography className="holiday-calendar-subtitle">
          {client?.companyName} {client?.companyCode}
        </Typography>
      </Box>

      <Box className="holiday-calendar-toolbar">
        <Button variant="outlined" onClick={handlePrevMonth}>
          Previous
        </Button>
        <Typography className="holiday-calendar-month">
          {format(currentMonth, "MMMM yyyy")}
        </Typography>
        <Button variant="outlined" onClick={handleNextMonth}>
          Next
        </Button>
      </Box>

      <Box className="holiday-calendar-grid">
        {renderDays()}
        {renderCells()}
      </Box>

      <Box className="holiday-calendar-list">
        <Typography className="holiday-calendar-list-title">
          Holidays in {format(currentMonth, "MMMM yyyy")}
        </Typography>
        {monthHolidayList.length === 0 ? (
          <Typography className="holiday-calendar-list-empty">
            No holidays added for this month.
          </Typography>
        ) : (
          <div className="holiday-calendar-list-table">
            <div className="holiday-calendar-list-header">
              <span>From</span>
              <span>To</span>
              <span>Holiday Name</span>
              <span>Type</span>
              <span>Branch</span>
              <span>Action</span>
            </div>
            {monthHolidayList.map((holiday) => (
              <div className="holiday-calendar-list-row" key={holiday.id}>
                <span>{formatHolidayDate(holiday.holidayDate)}</span>
                <span>{formatHolidayDate(holiday.holidayEndDate || holiday.holidayDate)}</span>
                <span>{holiday.holidayName}</span>
                <span>{holiday.holidayType === "HALF" ? "Half Day" : "Full Day"}</span>
                <span>{holiday.branchScope && holiday.branchScope !== "ALL" ? holiday.branchScope : "All Branches"}</span>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => openDialogForDate(new Date(holiday.holidayDate))}
                >
                  Edit
                </Button>
              </div>
            ))}
          </div>
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {editingHoliday ? "Edit Holiday" : "Add Holiday"}
        </DialogTitle>
        <DialogContent className="holiday-dialog-content">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="From Date"
              format="dd/MM/yyyy"
              value={parseHolidayDate(form.holidayDate)}
              onChange={(value) => {
                if (value && !isValid(value)) return;
                const dateKey = value ? format(value, "yyyy-MM-dd") : "";
                setForm((prev) => ({
                  ...prev,
                  holidayDate: dateKey,
                  holidayEndDate: dateKey && (!prev.holidayEndDate || prev.holidayEndDate < dateKey)
                    ? dateKey
                    : prev.holidayEndDate,
                }));
              }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  margin: "dense",
                  helperText: formattedSelectedDate ? `Selected: ${formattedSelectedDate}` : "Select a date",
                },
              }}
            />
            <DatePicker
              label="To Date"
              format="dd/MM/yyyy"
              value={parseHolidayDate(form.holidayEndDate)}
              minDate={parseHolidayDate(form.holidayDate) || undefined}
              onChange={(value) => {
                if (value && !isValid(value)) return;
                setForm((prev) => ({
                  ...prev,
                  holidayEndDate: value ? format(value, "yyyy-MM-dd") : "",
                }));
              }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  margin: "dense",
                  helperText: form.holidayEndDate ? `Selected: ${formatHolidayDate(form.holidayEndDate)}` : "Select an end date",
                },
              }}
            />
          </LocalizationProvider>
          <TextField
            label="Holiday Name"
            fullWidth
            margin="dense"
            value={form.holidayName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, holidayName: e.target.value }))
            }
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Holiday Type</InputLabel>
            <Select
              label="Holiday Type"
              value={form.holidayType}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, holidayType: e.target.value }))
              }
            >
              <MenuItem value="FULL">Full Day</MenuItem>
              <MenuItem value="HALF">Half Day</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Branch</InputLabel>
            <Select
              label="Branch"
              value={form.branchScope || "ALL"}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, branchScope: e.target.value }))
              }
            >
              <MenuItem value="ALL">All Branches</MenuItem>
              {branches.map((branch) => (
                <MenuItem key={branch} value={branch}>
                  {branch}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          {editingHoliday && (
            <Button color="error" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}





