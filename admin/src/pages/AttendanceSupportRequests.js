import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { getMonth, getYear } from "date-fns";
import {
  Check as CheckIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { API_BASE_URL } from "../config/api";
import RequestFilterBar from "../component/RequestFilterBar";

const normalize = (value) => String(value || "").trim().toLowerCase();

const statusColor = (status) => {
  const normalized = normalize(status);
  if (normalized === "approved") return "#4CAF50";
  if (normalized === "rejected") return "#F44336";
  if (normalized === "resolved") return "#2196F3";
  if (normalized === "closed") return "#607D8B";
  if (normalized === "open") return "#FF9800";
  return "#FFC107";
};

export default function AttendanceSupportRequests() {
  const client = JSON.parse(localStorage.getItem("loggedInClient"));
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("Attendance Support");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");

  const buildParams = (requestType = activeTab) => {
    const params = { clientId: client?.id, requestType };
    if (selectedMonth instanceof Date && !Number.isNaN(selectedMonth.getTime())) {
      params.month = getMonth(selectedMonth) + 1;
      params.year = getYear(selectedMonth);
    }
    if (selectedBranch) {
      params.branch = selectedBranch;
    }
    return params;
  };

  const getEmployeeDisplayName = (request) => {
    const name = String(request?.employeeName || "").trim();
    if (name) return name;
    const firstName = String(request?.employee?.firstName || "").trim();
    const lastName = String(request?.employee?.lastName || "").trim();
    return `${firstName} ${lastName}`.trim() || "Unknown";
  };

  const getEmployeeIdentifier = (request) => {
    const value =
      request?.employeeId ??
      request?.employee?.employeeId ??
      request?.employee?.id;
    return value == null ? "" : String(value);
  };

  const employeeOptions = useMemo(() => {
    const selectedBranchKey = normalize(selectedBranch);
    const unique = new Map();
    requests.forEach((request) => {
      if (selectedBranchKey && normalize(request?.branch) !== selectedBranchKey) {
        return;
      }
      const employeeId = getEmployeeIdentifier(request);
      if (!employeeId || unique.has(employeeId)) {
        return;
      }
      const employeeName = getEmployeeDisplayName(request);
      unique.set(employeeId, {
        value: employeeId,
        label: `${employeeName} (ID: ${employeeId})`,
      });
    });
    return Array.from(unique.values()).sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }, [requests, selectedBranch]);

  const filteredRequests = useMemo(() => {
    const selectedEmployeeId = String(selectedEmployee || "").trim();
    if (!selectedEmployeeId) {
      return requests;
    }
    return requests.filter((request) => getEmployeeIdentifier(request) === selectedEmployeeId);
  }, [requests, selectedEmployee]);

  const fetchRequests = async (requestType = activeTab) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/attendance-support`, {
        params: buildParams(requestType),
      });
      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch support requests:", error);
      alert("Failed to fetch support requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchRequests(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, activeTab, selectedMonth, selectedBranch]);

  const handleBranchChange = (value) => {
    setSelectedBranch(value);
    setSelectedEmployee("");
  };

  const updateStatus = async (requestId, action) => {
    try {
      setRefreshing(true);
      const payload = {
        approvedBy: client?.companyName || client?.companyCode || "Admin",
      };

      await axios.post(
        `${API_BASE_URL}/api/attendance-support/${requestId}/${action}`,
        payload,
        { params: { clientId: client?.id } }
      );
      await fetchRequests(activeTab);
    } catch (error) {
      console.error(`Failed to ${action} support request:`, error);
      const backendMessage =
        typeof error?.response?.data === "string"
          ? error.response.data
          : error?.response?.data?.message;
      alert(backendMessage || `Failed to ${action} request.`);
      setRefreshing(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return String(value).slice(0, 10);
  };

  const formatTime = (value) => {
    if (!value) return "-";
    return String(value).slice(0, 5);
  };

  const renderStatus = (status) => (
    <Chip
      label={String(status || "pending").toUpperCase()}
      sx={{ color: "#fff", backgroundColor: statusColor(status), fontWeight: 700 }}
      size="small"
    />
  );

  const renderAttendanceTable = () => (
    <Table stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Employee</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Branch</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Date</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Time In</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Time Out</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Reason</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Status</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Action</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {filteredRequests.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} align="center">No attendance support requests found.</TableCell>
          </TableRow>
        ) : (
          filteredRequests.map((request) => {
            const isPending = normalize(request.status) === "pending";
            return (
              <TableRow key={request.id}>
                <TableCell align="center">{request.employeeName || "Unknown"} (ID: {request.employeeId || "N/A"})</TableCell>
                <TableCell align="center">{request.branch || "-"}</TableCell>
                <TableCell align="center">{formatDate(request.attendanceDate)}</TableCell>
                <TableCell align="center">{formatTime(request.timeIn)}</TableCell>
                <TableCell align="center">{formatTime(request.timeOut)}</TableCell>
                <TableCell align="center">{request.reason || "-"}</TableCell>
                <TableCell align="center">{renderStatus(request.status)}</TableCell>
                <TableCell align="center">
                  <Tooltip title="Approve">
                    <span>
                      <IconButton onClick={() => updateStatus(request.id, "approve")} disabled={!isPending || refreshing} sx={{ color: "#4CAF50" }}>
                        <CheckIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Reject">
                    <span>
                      <IconButton onClick={() => updateStatus(request.id, "reject")} disabled={!isPending || refreshing} sx={{ color: "#F44336" }}>
                        <CloseIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  const renderGeneralTable = () => (
    <Table stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Employee</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Branch</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Message</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Date</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Status</TableCell>
          <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Action</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {filteredRequests.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} align="center">No general support requests found.</TableCell>
          </TableRow>
        ) : (
          filteredRequests.map((request) => {
            const canUpdate = !["resolved", "closed"].includes(normalize(request.status));
            return (
              <TableRow key={request.id}>
                <TableCell align="center">{request.employeeName || "Unknown"} (ID: {request.employeeId || "N/A"})</TableCell>
                <TableCell align="center">{request.branch || "-"}</TableCell>
                <TableCell align="center">{request.message || "-"}</TableCell>
                <TableCell align="center">{formatDate(request.createdAt)}</TableCell>
                <TableCell align="center">{renderStatus(request.status)}</TableCell>
                <TableCell align="center">
                  <Tooltip title="Resolve">
                    <span>
                      <IconButton onClick={() => updateStatus(request.id, "resolve")} disabled={!canUpdate || refreshing} sx={{ color: "#2196F3" }}>
                        <CheckIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Close">
                    <span>
                      <IconButton onClick={() => updateStatus(request.id, "close")} disabled={normalize(request.status) === "closed" || refreshing} sx={{ color: "#607D8B" }}>
                        <CloseIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  return (
    <Box sx={{ p: 2, background: "#f5f5f5", minHeight: "100vh" }}>
      <Typography
        variant="h4"
        sx={{ color: "#351153", fontWeight: 700, mb: 2, fontFamily: "Montserrat, sans-serif" }}
      >
        Support Requests
      </Typography>

      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        sx={{ mb: 2, "& .MuiTabs-indicator": { backgroundColor: "#351153" } }}
      >
        <Tab value="Attendance Support" label="Attendance Support" sx={{ fontWeight: 700 }} />
        <Tab value="General Support" label="General Support" sx={{ fontWeight: 700 }} />
      </Tabs>

      <RequestFilterBar
        clientId={client?.id}
        selectedMonth={selectedMonth}
        selectedBranch={selectedBranch}
        selectedEmployee={selectedEmployee}
        employeeOptions={employeeOptions}
        onMonthChange={(value) => setSelectedMonth(value || new Date())}
        onBranchChange={handleBranchChange}
        onEmployeeChange={setSelectedEmployee}
        onRefresh={() => {
          setRefreshing(true);
          fetchRequests(activeTab);
        }}
        refreshing={refreshing}
      />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress sx={{ color: "#351153" }} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          {activeTab === "Attendance Support" ? renderAttendanceTable() : renderGeneralTable()}
        </TableContainer>
      )}
    </Box>
  );
}
