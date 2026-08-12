import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  CircularProgress,
  Button,
  Chip,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ClearIcon from "@mui/icons-material/Clear";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DateRangeIcon from "@mui/icons-material/DateRange";
import { styled } from "@mui/material/styles";
import { API_BASE_URL } from "../config/api";
import { fetchBranchesFromLocationSet } from "../utils/branchSource";

// Styled components
const Container = styled('div')(({ theme }) => ({
  padding: theme.spacing(0),
  backgroundColor: "#F5F5F5",
  minHeight: "100vh",
}));

const Heading = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: "1.2rem",
  marginBottom: theme.spacing(4),
  fontFamily: "Montserrat, sans-serif",
  backgroundColor: "#351153",
  color: "white",
  padding: theme.spacing(2),
  borderRadius: "12px 12px 0 0",
  boxShadow: "0 3px 5px rgba(0,0,0,0.2)",
}));

const FilterContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: 12,
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  boxShadow: "0 3px 5px rgba(0,0,0,0.1)",
}));

const FilterRow = styled('div')(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing(2),
  gap: theme.spacing(2),
  flexWrap: "wrap",
}));

const FilterControl = styled(FormControl)(({ theme }) => ({
  minWidth: 180,
  "& .MuiInputBase-root": {
    borderRadius: 8,
  },
}));

const DateInput = styled(TextField)(({ theme }) => ({
  flex: 1,
  "& .MuiInputBase-root": {
    borderRadius: 8,
  },
}));

const ClearButton = styled(IconButton)(({ theme }) => ({
  marginLeft: theme.spacing(1),
  color: "#F44336",
}));

const TabContainer = styled('div')(({ theme }) => ({
  display: "flex",
  marginBottom: theme.spacing(3),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const TabButton = styled('div')(({ theme, active }) => ({
  padding: theme.spacing(1, 3),
  borderBottom: active ? "3px solid #351153" : "3px solid transparent",
  cursor: "pointer",
}));

const TabText = styled(Typography)(({ theme, active }) => ({
  color: active ? "#351153" : "#757575",
  fontWeight: 600,
  fontFamily: "Open Sans, sans-serif",
}));

const LoaderContainer = styled('div')(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(4),
}));

const LoadingText = styled(Typography)(({ theme }) => ({
  color: "#757575",
  marginTop: theme.spacing(2),
}));

const EmptyState = styled(Paper)(({ theme }) => ({
  backgroundColor: "white",
  padding: theme.spacing(4),
  borderRadius: 12,
  textAlign: "center",
  boxShadow: "0 3px 5px rgba(0,0,0,0.1)",
}));

const EmptyStateText = styled(Typography)(({ theme }) => ({
  color: "#757575",
}));

const ErrorText = styled(Typography)(({ theme }) => ({
  color: "#f44336",
  textAlign: "center",
  marginTop: theme.spacing(2),
}));

const Card = styled(Paper)(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: 12,
  padding: theme.spacing(3),
  boxShadow: "0 3px 5px rgba(0,0,0,0.1)",
  marginBottom: theme.spacing(2),
}));

const CardHeader = styled('div')(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: theme.spacing(2),
}));

const CardTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: "#212121",
  fontFamily: "Montserrat, sans-serif",
}));

const StatusBadge = styled(Chip)(({ theme, status }) => ({
  fontWeight: 600,
  color: "white",
  backgroundColor: 
    status === "pending" ? "#FFC107" :
    status === "approved" ? "#4CAF50" :
    "#F44336",
}));

const InfoRow = styled('div')(({ theme }) => ({
  display: "flex",
  marginBottom: theme.spacing(1),
}));

const InfoLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: "#757575",
  width: 100,
  fontFamily: "Open Sans, sans-serif",
}));

const InfoValue = styled(Typography)(({ theme }) => ({
  flex: 1,
  color: "#212121",
  fontFamily: "Open Sans, sans-serif",
}));

const CardFooter = styled('div')(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
}));

const ActionIcon = styled(IconButton)(({ theme, actiontype, disabled }) => ({
  cursor: disabled ? "not-allowed" : "pointer",
  padding: theme.spacing(1),
  borderRadius: "50%",
  opacity: disabled ? 0.5 : 1,
  color: actiontype === "approve" ? "#4CAF50" : "#F44336",
  "&:hover": {
    backgroundColor: actiontype === "approve" 
      ? "rgba(76, 175, 80, 0.1)" 
      : "rgba(244, 67, 54, 0.1)",
  },
}));

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: 12,
  boxShadow: "0 3px 5px rgba(0,0,0,0.1)",
  overflowX: "auto",
}));

const StyledTable = styled(Table)(({ theme }) => ({
  minWidth: 800,
}));

const TableHeader = styled(TableHead)(({ theme }) => ({
  backgroundColor: "#351153",
  "& th": {
    color: "white",
    fontWeight: 600,
    fontFamily: "Montserrat, sans-serif",
  },
}));

const TableRowStyled = styled(TableRow)(({ theme }) => ({
  "&:nth-of-type(even)": {
    backgroundColor: "#FAFAFA",
  },
  "&:hover": {
    backgroundColor: "#F5F5F5",
  },
}));

const Cell = styled(TableCell)(({ theme }) => ({
  color: "#212121",
  fontFamily: "Open Sans, sans-serif",
  verticalAlign: "middle",
}));

const ActionCell = styled('div')(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  justifyContent: "center",
}));

const RefreshButton = styled(Button)(({ theme }) => ({
  backgroundColor: "#351153",
  color: "white",
  marginBottom: theme.spacing(2),
  "&:hover": {
    backgroundColor: "#5a2d8a",
  },
}));

const HeaderCell = styled(TableCell)(({ theme }) => ({
  textAlign: "center",
  color: "white !important",
  backgroundColor: "#351153",
}));

const AdminLeaveRequests = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("leave");
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // Filter states
  const [branchFilter, setBranchFilter] = useState("all");
  const [branches, setBranches] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [employeeIdFilter, setEmployeeIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
      const client = JSON.parse(localStorage.getItem("loggedInClient")); 

  const getApiErrorMessage = (err, fallback = "Request failed") => {
    const responseData = err?.response?.data;
    if (typeof responseData === "string" && responseData.trim()) {
      return responseData.trim();
    }
    if (responseData?.message) {
      return responseData.message;
    }
    return err?.message || fallback;
  };

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const isDesktop = windowWidth >= 768;

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const fetchLeaves = async () => {
    try {
      setError("");
      setLoading(true);
      
      const res = await axios.get(`${API_BASE_URL}/api/leaves/all?clientId=${client?.id}`, {
        timeout: 10000,
      });
      
      if (res.data && Array.isArray(res.data)) {
        setLeaves(res.data);
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (err) {
      console.error("Failed to fetch leave requests", err);
      const errorMessage = getApiErrorMessage(
        err,
        "Failed to fetch leave requests. Please check your connection."
      );
      setError(errorMessage);
      showSnackbar(errorMessage, "error");
      setLeaves([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateStatus = async (leaveId, status) => {
  let originalLeaves;
  
  try {
    setRefreshing(true);
    
    if (!leaveId) {
      throw new Error("Invalid leave ID");
    }

    // Store original leaves for rollback
    originalLeaves = [...leaves];
    
    // Optimistic update
    setLeaves((prevLeaves) =>
      prevLeaves.map((leave) =>
        leave.id === leaveId ? { ...leave, status } : leave
      )
    );

    // ✅ CORRECTED ENDPOINT: Fixed the URL syntax
    const response = await axios.put(
      `${API_BASE_URL}/api/leaves/status/${leaveId}?status=${status}&clientId=${client?.id}`,
      {}, // Empty body since we're using query parameters
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );

    if (response.status !== 200 && response.status !== 201) {
      throw new Error("Failed to update status");
    }

    showSnackbar(`Leave request ${status} successfully!`, "success");
    
    await fetchLeaves();
  } catch (err) {
    console.error("Error updating leave status:", err);
    
    // Revert optimistic update
    if (originalLeaves) {
      setLeaves(originalLeaves);
    }
    
    const errorMessage = getApiErrorMessage(err, "Failed to update leave status");
    showSnackbar(errorMessage, "error");
  } finally {
    setRefreshing(false);
  }
};
  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaves();
  };

  useEffect(() => {
    fetchLeaves();
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
        console.error("Failed to fetch branches from Location Set:", error);
        if (active) setBranches([]);
      }
    };

    fetchBranches();

    return () => {
      active = false;
    };
  }, [client?.id]);

  const formatDate = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
      return "";
    }
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const parseDate = (dateString) => {
    if (!dateString) return new Date();
    try {
      const [day, month, year] = dateString.split("/").map(Number);
      return new Date(year, month - 1, day);
    } catch (error) {
      console.error("Error parsing date:", error);
      return new Date();
    }
  };

  const filterAndSortRequests = (requests) => {
    if (!Array.isArray(requests)) return [];
    
    let filtered = [...requests];

    if (branchFilter !== "all") {
      filtered = filtered.filter(
        (request) => request.employee?.branch === branchFilter
      );
    }

    if (employeeIdFilter) {
      filtered = filtered.filter(
        (request) => String(request.employee?.id) === employeeIdFilter
      );
    }

    if (dateFilter) {
      filtered = filtered.filter((request) => request.date === dateFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((request) => request.status === statusFilter);
    }

    return filtered.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;

      const branchA = a.employee?.branch || "zzz";
      const branchB = b.employee?.branch || "zzz";
      if (branchA < branchB) return -1;
      if (branchA > branchB) return 1;

      try {
        const dateA = parseDate(a.date).getTime();
        const dateB = parseDate(b.date).getTime();
        return dateB - dateA;
      } catch (error) {
        return 0;
      }
    });
  };

  const handleDateChange = (date) => {
    if (date) {
      setSelectedDate(date);
      setDateFilter(formatDate(date));
    }
    setShowDatePicker(false);
  };

  const clearFilters = () => {
    setBranchFilter("all");
    setDateFilter("");
    setEmployeeIdFilter("");
    setStatusFilter("all");
  };

  const leaveRequests = filterAndSortRequests(
    leaves.filter((item) => 
      item && item.leaveType && item.leaveType.toLowerCase() !== "permission"
    )
  );
  
  const permissionRequests = filterAndSortRequests(
    leaves.filter((item) => 
      item && item.leaveType && item.leaveType.toLowerCase() === "permission"
    )
  );

  const renderDatePickerDialog = () => (
    <Dialog open={showDatePicker} onClose={() => setShowDatePicker(false)}>
      <DialogTitle>Select Date</DialogTitle>
      <DialogContent>
        <input
          type="date"
          value={selectedDate.toISOString().split("T")[0]}
          onChange={(e) => {
            handleDateChange(new Date(e.target.value));
          }}
          style={{
            padding: "8px",
            borderRadius: "8px",
            border: "1px solid #ddd",
            fontSize: "16px",
            width: "100%",
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowDatePicker(false)} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderFilters = () => (
    <FilterContainer>
      <FilterRow>
        <FilterControl variant="outlined" size="small">
          <InputLabel>Branch</InputLabel>
          <Select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            label="Branch"
          >
            <MenuItem value="all">All Branches</MenuItem>
            {branches.map((branch) => (
              <MenuItem key={branch} value={branch}>
                {branch}
              </MenuItem>
            ))}
          </Select>
        </FilterControl>

        <FilterControl variant="outlined" size="small">
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label="Status"
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FilterControl>

        <TextField
          label="Employee ID"
          variant="outlined"
          value={employeeIdFilter}
          onChange={(e) => setEmployeeIdFilter(e.target.value)}
          sx={{ minWidth: 180 }}
          size="small"
        />

        <DateInput
          label="Applied Date"
          value={dateFilter}
          onClick={() => setShowDatePicker(true)}
          InputProps={{
            readOnly: true,
            endAdornment: (
              <>
                <DateRangeIcon color="action" />
                {dateFilter && (
                  <ClearButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDateFilter("");
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </ClearButton>
                )}
              </>
            ),
          }}
          size="small"
        />
      </FilterRow>

      <Button
        variant="outlined"
        onClick={clearFilters}
        startIcon={<ClearIcon />}
        size="small"
      >
        Clear Filters
      </Button>

      {renderDatePickerDialog()}
    </FilterContainer>
  );

  const renderMobileLeaveItem = (leave) => (
    <Card key={leave.id}>
      <CardHeader>
        <CardTitle variant="subtitle1">
          {leave.employee?.firstName || "Unknown"} (ID:{" "}
          {leave.employee?.id || "N/A"}) -{" "}
          {leave.employee?.branch || "No Branch"}
        </CardTitle>
        <StatusBadge 
          label={leave.status.toUpperCase()} 
          status={leave.status}
          size="small" 
        />
      </CardHeader>
      <div>
        <InfoRow>
          <InfoLabel variant="body2">Type:</InfoLabel>
          <InfoValue variant="body2">{leave.leaveType}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel variant="body2">Dates:</InfoLabel>
          <InfoValue variant="body2">
            {leave.startDate} - {leave.endDate}
          </InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel variant="body2">Reason:</InfoLabel>
          <InfoValue variant="body2">{leave.reason}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel variant="body2">Applied:</InfoLabel>
          <InfoValue variant="body2">{leave.date}</InfoValue>
        </InfoRow>
      </div>
      <CardFooter>
        <Tooltip
          title={leave.status === "rejected" ? "Already Rejected" : "Reject"}
        >
          <span>
            <ActionIcon
              actiontype="reject"
              disabled={leave.status === "approved"}
              onClick={
                leave.status !== "approved"
                  ? () => updateStatus(leave.id, "rejected")
                  : null
              }
            >
              <CloseIcon />
            </ActionIcon>
          </span>
        </Tooltip>
        <Tooltip
          title={leave.status === "approved" ? "Already Approved" : "Approve"}
        >
          <ActionIcon
            actiontype="approve"
            onClick={() => updateStatus(leave.id, "approved")}
          >
            <CheckIcon />
          </ActionIcon>
        </Tooltip>
      </CardFooter>
    </Card>
  );

  const renderMobilePermissionItem = (permission) => (
    <Card key={permission.id}>
      <CardHeader>
        <CardTitle variant="subtitle1">
          {permission.employee?.firstName || "Unknown"} (ID:{" "}
          {permission.employee?.id || "N/A"}) -{" "}
          {permission.employee?.branch || "No Branch"}
        </CardTitle>
        <StatusBadge 
          label={permission.status.toUpperCase()} 
          status={permission.status}
          size="small" 
        />
      </CardHeader>
      <div>
        <InfoRow>
          <InfoLabel variant="body2">Type:</InfoLabel>
          <InfoValue variant="body2">{permission.leaveType}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel variant="body2">Date:</InfoLabel>
          <InfoValue variant="body2">{permission.date}</InfoValue>
        </InfoRow>
        {permission.startTime && permission.endTime && (
          <InfoRow>
            <InfoLabel variant="body2">Time:</InfoLabel>
            <InfoValue variant="body2">
              {permission.startTime} - {permission.endTime}
            </InfoValue>
          </InfoRow>
        )}
        <InfoRow>
          <InfoLabel variant="body2">Reason:</InfoLabel>
          <InfoValue variant="body2">{permission.reason}</InfoValue>
        </InfoRow>
      </div>
      <CardFooter>
        <Tooltip
          title={
            permission.status === "rejected" ? "Already Rejected" : "Reject"
          }
        >
          <span>
            <ActionIcon
              actiontype="reject"
              disabled={permission.status === "approved"}
              onClick={
                permission.status !== "approved"
                  ? () => updateStatus(permission.id, "rejected")
                  : null
              }
            >
              <CloseIcon />
            </ActionIcon>
          </span>
        </Tooltip>
        <Tooltip
          title={
            permission.status === "approved" ? "Already Approved" : "Approve"
          }
        >
          <ActionIcon
            actiontype="approve"
            onClick={() => updateStatus(permission.id, "approved")}
          >
            <CheckIcon />
          </ActionIcon>
        </Tooltip>
      </CardFooter>
    </Card>
  );

  const renderDesktopLeaveTable = () => (
    <StyledTableContainer>
      <StyledTable aria-label="leave requests table">
        <TableHeader>
          <TableRow>
            <HeaderCell align="center">ID</HeaderCell>
            <HeaderCell align="center">Name</HeaderCell>
            <HeaderCell align="center">Branch</HeaderCell>
            <HeaderCell align="center">Leave Type</HeaderCell>
            <HeaderCell align="center">Start Date</HeaderCell>
            <HeaderCell align="center">End Date</HeaderCell>
            <HeaderCell align="center">Reason</HeaderCell>
            <HeaderCell align="center">Applied On</HeaderCell>
            <HeaderCell align="center">Status</HeaderCell>
            <HeaderCell align="center">Actions</HeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaveRequests.map((leave) => (
            <TableRowStyled key={leave.id}>
              <Cell align="center">{leave.id}</Cell>
              <Cell align="center">
                {leave.employee?.firstName || "Unknown"} (ID:{" "}
                {leave.employee?.id || "N/A"})
              </Cell>
              <Cell align="center">
                {leave.employee?.branch || "-"}
              </Cell>
              <Cell align="center">{leave.leaveType}</Cell>
              <Cell align="center">{leave.startDate}</Cell>
              <Cell align="center">{leave.endDate}</Cell>
              <Cell align="center">{leave.reason}</Cell>
              <Cell align="center">{leave.date}</Cell>
              <Cell align="center">
                <StatusBadge 
                  label={leave.status.toUpperCase()} 
                  status={leave.status}
                  size="small" 
                />
              </Cell>
              <Cell align="center">
                <ActionCell>
                  <Tooltip
                    title={
                      leave.status === "rejected"
                        ? "Already Rejected"
                        : "Reject"
                    }
                  >
                    <span>
                      <ActionIcon
                        actiontype="reject"
                        disabled={leave.status === "approved"}
                        onClick={
                          leave.status !== "approved"
                            ? () => updateStatus(leave.id, "rejected")
                            : null
                        }
                      >
                        <CloseIcon />
                      </ActionIcon>
                    </span>
                  </Tooltip>
                  <Tooltip
                    title={
                      leave.status === "approved"
                        ? "Already Approved"
                        : "Approve"
                    }
                  >
                    <ActionIcon
                      actiontype="approve"
                      onClick={() => updateStatus(leave.id, "approved")}
                    >
                      <CheckIcon />
                    </ActionIcon>
                  </Tooltip>
                </ActionCell>
              </Cell>
            </TableRowStyled>
          ))}
        </TableBody>
      </StyledTable>
    </StyledTableContainer>
  );

  const renderDesktopPermissionTable = () => (
    <StyledTableContainer>
      <StyledTable aria-label="permission requests table">
        <TableHeader>
          <TableRow>
            <HeaderCell align="center">ID</HeaderCell>
            <HeaderCell align="center">Name</HeaderCell>
            <HeaderCell align="center">Branch</HeaderCell>
            <HeaderCell align="center">Permission</HeaderCell>
            <HeaderCell align="center">Date</HeaderCell>
            {permissionRequests.some((p) => p.startTime && p.endTime) && (
              <>
                <HeaderCell align="center">Start Time</HeaderCell>
                <HeaderCell align="center">End Time</HeaderCell>
              </>
            )}
            <HeaderCell align="center">Reason</HeaderCell>
            <HeaderCell align="center">Status</HeaderCell>
            <HeaderCell align="center">Actions</HeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {permissionRequests.map((permission) => (
            <TableRowStyled key={permission.id}>
              <Cell align="center">{permission.id}</Cell>
              <Cell align="center">
                {permission.employee?.firstName || "Unknown"} (ID:{" "}
                {permission.employee?.id || "N/A"})
              </Cell>
              <Cell align="center">
                {permission.employee?.branch || "-"}
              </Cell>
              <Cell align="center">Permission</Cell>
              <Cell align="center">{permission.date}</Cell>
              {permissionRequests.some((p) => p.startTime && p.endTime) && (
                <>
                  <Cell align="center">{permission.startTime || "-"}</Cell>
                  <Cell align="center">{permission.endTime || "-"}</Cell>
                </>
              )}
              <Cell align="center">{permission.reason}</Cell>
              <Cell align="center">
                <StatusBadge 
                  label={permission.status.toUpperCase()} 
                  status={permission.status}
                  size="small" 
                />
              </Cell>
              <Cell align="center">
                <ActionCell>
                  <Tooltip
                    title={
                      permission.status === "rejected"
                        ? "Already Rejected"
                        : "Reject"
                    }
                  >
                    <span>
                      <ActionIcon
                        actiontype="reject"
                        disabled={permission.status === "approved"}
                        onClick={
                          permission.status !== "approved"
                            ? () => updateStatus(permission.id, "rejected")
                            : null
                        }
                      >
                        <CloseIcon />
                      </ActionIcon>
                    </span>
                  </Tooltip>
                  <Tooltip
                    title={
                      permission.status === "approved"
                        ? "Already Approved"
                        : "Approve"
                    }
                  >
                    <ActionIcon
                      actiontype="approve"
                      onClick={() => updateStatus(permission.id, "approved")}
                    >
                      <CheckIcon />
                    </ActionIcon>
                  </Tooltip>
                </ActionCell>
              </Cell>
            </TableRowStyled>
          ))}
        </TableBody>
      </StyledTable>
    </StyledTableContainer>
  );

  const renderError = () => (
    <EmptyState>
      <ErrorText variant="body1">
        {error}
      </ErrorText>
      <Button 
        variant="contained" 
        onClick={fetchLeaves}
        sx={{ mt: 2 }}
      >
        Try Again
      </Button>
    </EmptyState>
  );

  return (
    <Container>
      <Heading variant="h4">
        Leave & Permission Management
      </Heading>

      <RefreshButton
        variant="contained"
        onClick={onRefresh}
        startIcon={<RefreshIcon />}
        disabled={refreshing || loading}
      >
        {refreshing ? "Refreshing..." : "Refresh Data"}
      </RefreshButton>

      {renderFilters()}

      <TabContainer>
        <TabButton 
          active={activeTab === "leave"}
          onClick={() => setActiveTab("leave")}
        >
          <TabText 
            variant="body1" 
            active={activeTab === "leave"}
          >
            Leave Requests ({leaveRequests.length})
          </TabText>
        </TabButton>
        <TabButton 
          active={activeTab === "permission"}
          onClick={() => setActiveTab("permission")}
        >
          <TabText 
            variant="body1" 
            active={activeTab === "permission"}
          >
            Permission Requests ({permissionRequests.length})
          </TabText>
        </TabButton>
      </TabContainer>

      {error ? (
        renderError()
      ) : loading ? (
        <LoaderContainer>
          <CircularProgress style={{ color: "#351153" }} />
          <LoadingText variant="body1">
            Loading requests...
          </LoadingText>
        </LoaderContainer>
      ) : isDesktop ? (
        activeTab === "leave" ? (
          leaveRequests.length > 0 ? (
            renderDesktopLeaveTable()
          ) : (
            <EmptyState>
              <EmptyStateText variant="body1">
                {branchFilter !== "all" ||
                dateFilter ||
                employeeIdFilter ||
                statusFilter !== "all"
                  ? "No matching leave requests found"
                  : "No leave requests found"}
              </EmptyStateText>
            </EmptyState>
          )
        ) : permissionRequests.length > 0 ? (
          renderDesktopPermissionTable()
        ) : (
          <EmptyState>
            <EmptyStateText variant="body1">
              {branchFilter !== "all" ||
              dateFilter ||
              employeeIdFilter ||
              statusFilter !== "all"
                ? "No matching permission requests found"
                : "No permission requests found"}
            </EmptyStateText>
          </EmptyState>
        )
      ) : (
        <div>
          {activeTab === "leave" ? (
            leaveRequests.length > 0 ? (
              <div>{leaveRequests.map(renderMobileLeaveItem)}</div>
            ) : (
              <EmptyState>
                <EmptyStateText variant="body1">
                  {branchFilter !== "all" ||
                  dateFilter ||
                  employeeIdFilter ||
                  statusFilter !== "all"
                    ? "No matching leave requests found"
                    : "No leave requests found"}
                </EmptyStateText>
              </EmptyState>
            )
          ) : permissionRequests.length > 0 ? (
            <div>{permissionRequests.map(renderMobilePermissionItem)}</div>
          ) : (
            <EmptyState>
              <EmptyStateText variant="body1">
                {branchFilter !== "all" ||
                dateFilter ||
                employeeIdFilter ||
                statusFilter !== "all"
                  ? "No matching permission requests found"
                  : "No permission requests found"}
              </EmptyStateText>
            </EmptyState>
          )}
        </div>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AdminLeaveRequests;





