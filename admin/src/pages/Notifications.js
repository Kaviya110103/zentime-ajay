import React, { useEffect, useState } from "react";
import { styled } from "@mui/material/styles";
import { 
  Card, 
  CardContent,
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Box,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  Notifications as NotificationsIcon,
} from "@mui/icons-material";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { fetchBranchesFromLocationSet } from "../utils/branchSource";

// Styled components using MUI v5 styled API
const Container = styled('div')(({ theme }) => ({
  backgroundColor: "#F5F5F5",
  borderRadius: "12px",
  padding: theme.spacing(2),
  maxHeight: "600px",
  overflowY: "auto",
  boxShadow: "0 3px 5px rgba(0,0,0,0.1)",
}));

const Heading = styled(Typography)(({ theme }) => ({
  color: "#351153",
  fontWeight: 700,
  fontSize: "1.5rem",
  marginBottom: theme.spacing(2),
  fontFamily: "Montserrat, sans-serif",
}));

const FilterContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: 12,
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  boxShadow: "0 3px 5px rgba(0,0,0,0.1)",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
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

const EmptyStateText = styled(Typography)(({ theme }) => ({
  color: "#757575",
}));

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: 12,
  boxShadow: "0 3px 5px rgba(0,0,0,0.1)",
  overflowX: "auto",
  maxHeight: "400px",
  overflowY: "auto",
}));

const StyledTable = styled(Table)(({ theme }) => ({
  minWidth: 800,
}));

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  "& .MuiTableCell-head": {
    backgroundColor: "#351153",
    color: "white",
    fontWeight: 600,
    fontFamily: "Montserrat, sans-serif",
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  "&:nth-of-type(even)": {
    backgroundColor: "#FAFAFA",
  },
  "&:hover": {
    backgroundColor: "#F5F5F5",
  },
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
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

const StatusBadge = styled(Chip)(({ theme, status }) => ({
  fontWeight: 600,
  color: "white",
  ...(status === 'pending' && {
    backgroundColor: "#FFC107",
  }),
  ...(status === 'approved' && {
    backgroundColor: "#4CAF50",
  }),
  ...(status === 'rejected' && {
    backgroundColor: "#F44336",
  }),
}));

const DialogTitleStyled = styled(DialogTitle)(({ theme }) => ({
  color: "#351153",
  fontWeight: 600,
}));

const TabContainer = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  minWidth: 120,
  fontWeight: 600,
  color: "#757575",
  "&.Mui-selected": {
    color: "#351153",
  },
}));

const FilterControl = styled(FormControl)(({ theme }) => ({
  minWidth: 180,
  "& .MuiInputBase-root": {
    borderRadius: 8,
  },
}));

const Notifications = ({ refreshParent }) => {
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [branchFilter, setBranchFilter] = useState("all");
  const [branches, setBranches] = useState([]);

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

  const filteredRequests = allRequests.filter((request) => {
    const isPending = request.status === "pending";
    const leaveType = String(request.leaveType || "").toLowerCase();
    const isLeave =
      activeTab === 0 && leaveType !== "permission";
    const isPermission =
      activeTab === 1 && leaveType === "permission";

    return isPending && (isLeave || isPermission);
  });

  const fetchAllRequests = async () => {
    try {
      const params = new URLSearchParams();
      if (client?.id) {
        params.set("clientId", client.id);
      }
      if (branchFilter !== "all") {
        params.set("branch", branchFilter);
      }
      const res = await axios.get(`${API_BASE_URL}/api/leaves/all?${params.toString()}`);
      setAllRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch requests", err);
      alert("Error: Failed to fetch requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllRequests();
  }, [branchFilter]);

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

  const updateStatus = async (requestId, status) => {
    try {
      if (!requestId) {
        throw new Error("Invalid request ID");
      }
      setRefreshing(true);

      setAllRequests((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, status } : req))
      );

      const response = await axios.put(
        `${API_BASE_URL}/api/leaves/status/${requestId}`,
        null,
        {
          params: { status, clientId: client?.id },
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status !== 200) {
        throw new Error("Failed to update status");
      }

      if (refreshParent) {
        refreshParent();
      }
    } catch (err) {
      console.error("Error updating request status:", err);
      fetchAllRequests();
      alert(`Error: Failed to update request status. ${getApiErrorMessage(err, "Unable to update status.")}`);
    } finally {
      setRefreshing(false);
      setOpenDialog(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllRequests();
  };

  const handleViewDetails = (request) => {
    setSelectedRequest(request);
    setOpenDialog(true);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleBranchFilterChange = (event) => {
    setBranchFilter(event.target.value);
  };

  const clearFilters = () => {
    setBranchFilter("all");
  };

  const renderRequestDetails = () => {
    if (!selectedRequest) return null;

    return (
      <Box>
        <Box sx={{ marginBottom: 2 }}>
          <Typography variant="subtitle2" color="textSecondary">
            Employee
          </Typography>
          <Typography variant="body1">
            {selectedRequest.employee?.firstName || "Unknown"} (ID:{" "}
            {selectedRequest.employee?.id || "N/A"}) -{" "}
            {selectedRequest.employee?.branch || "No Branch"}
          </Typography>
        </Box>

        <Box sx={{ marginBottom: 2 }}>
          <Typography variant="subtitle2" color="textSecondary">
            Type
          </Typography>
          <Typography variant="body1">{selectedRequest.leaveType}</Typography>
        </Box>

        {selectedRequest.leaveType.toLowerCase() === "permission" ? (
          <>
            <Box sx={{ marginBottom: 2 }}>
              <Typography variant="subtitle2" color="textSecondary">
                Date
              </Typography>
              <Typography variant="body1">{selectedRequest.date}</Typography>
            </Box>
            {selectedRequest.startTime && selectedRequest.endTime && (
              <Box sx={{ marginBottom: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  Time
                </Typography>
                <Typography variant="body1">
                  {selectedRequest.startTime} - {selectedRequest.endTime}
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <>
            <Box sx={{ marginBottom: 2 }}>
              <Typography variant="subtitle2" color="textSecondary">
                Dates
              </Typography>
              <Typography variant="body1">
                {selectedRequest.startDate} - {selectedRequest.endDate}
              </Typography>
            </Box>
          </>
        )}

        <Box sx={{ marginBottom: 2 }}>
          <Typography variant="subtitle2" color="textSecondary">
            Reason
          </Typography>
          <Typography variant="body1">{selectedRequest.reason}</Typography>
        </Box>

        <Box sx={{ marginBottom: 2 }}>
          <Typography variant="subtitle2" color="textSecondary">
            Applied On
          </Typography>
          <Typography variant="body1">{selectedRequest.date}</Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Container>
      <Heading variant="h4">
        Pending Approval Requests ({filteredRequests.length})
      </Heading>

      <RefreshButton
        variant="contained"
        onClick={onRefresh}
        startIcon={<RefreshIcon />}
        disabled={refreshing}
      >
        {refreshing ? "Refreshing..." : "Refresh"}
      </RefreshButton>

      <FilterContainer>
        <FilterControl variant="outlined">
          <InputLabel>Branch</InputLabel>
          <Select
            value={branchFilter}
            onChange={handleBranchFilterChange}
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

        <Button
          variant="outlined"
          onClick={clearFilters}
          disabled={branchFilter === "all"}
        >
          Clear Filters
        </Button>
      </FilterContainer>

      <TabContainer>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <StyledTab
            label={`Leave (${
              allRequests.filter(
                (r) =>
                  r.status === "pending" &&
                  r.leaveType.toLowerCase() !== "permission"
              ).length
            })`}
          />
          <StyledTab
            label={`Permission (${
              allRequests.filter(
                (r) =>
                  r.status === "pending" &&
                  r.leaveType.toLowerCase() === "permission"
              ).length
            })`}
          />
        </Tabs>
      </TabContainer>

      {loading ? (
        <LoaderContainer>
          <CircularProgress style={{ color: "#351153" }} />
          <LoadingText variant="body1">
            Loading requests...
          </LoadingText>
        </LoaderContainer>
      ) : (
        <StyledTableContainer component={Paper}>
          <StyledTable aria-label="pending requests table" stickyHeader>
            <StyledTableHead>
              <TableRow>
                <StyledTableCell align="center">ID</StyledTableCell>
                <StyledTableCell align="center">Name</StyledTableCell>
                <StyledTableCell align="center">Branch</StyledTableCell>
                <StyledTableCell align="center">Type</StyledTableCell>
                <StyledTableCell align="center">Dates</StyledTableCell>
                <StyledTableCell align="center">Status</StyledTableCell>
                <StyledTableCell align="center">Actions</StyledTableCell>
              </TableRow>
            </StyledTableHead>
            <TableBody>
              {filteredRequests.length > 0 ? (
                filteredRequests.map((request) => (
                  <StyledTableRow key={request.id}>
                    <StyledTableCell align="center">
                      {request.id}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {request.employee?.firstName || "Unknown"}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {request.employee?.branch || "-"}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {String(request.leaveType || "").toLowerCase() === "permission"
                        ? "Permission"
                        : String(request.leaveType || "Leave")}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      {request.leaveType.toLowerCase() === "permission"
                        ? request.date
                        : `${request.startDate} - ${request.endDate}`}
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      <StatusBadge
                        label={request.status.toUpperCase()}
                        status={request.status}
                        size="small"
                      />
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      <ActionCell>
                        <Tooltip title="View Details">
                          <IconButton
                            color="primary"
                            onClick={() => handleViewDetails(request)}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Approve">
                          <IconButton
                            style={{ color: "#4CAF50" }}
                            onClick={() => updateStatus(request.id, "approved")}
                          >
                            <CheckIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <IconButton
                            style={{ color: "#F44336" }}
                            onClick={() => updateStatus(request.id, "rejected")}
                          >
                            <CloseIcon />
                          </IconButton>
                        </Tooltip>
                      </ActionCell>
                    </StyledTableCell>
                  </StyledTableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <EmptyStateText variant="body1">
                      {allRequests.length > 0
                        ? `No pending ${
                            activeTab === 0 ? "leave" : "permission"
                          } requests found${
                            branchFilter !== "all" ? " for selected branch" : ""
                          }`
                        : "No requests found in the system"}
                    </EmptyStateText>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </StyledTable>
        </StyledTableContainer>
      )}

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitleStyled>
          Request Details
        </DialogTitleStyled>
        <DialogContent>
          {renderRequestDetails()}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => updateStatus(selectedRequest?.id, "rejected")}
            style={{ color: "#F44336" }}
          >
            Reject
          </Button>
          <Button
            onClick={() => updateStatus(selectedRequest?.id, "approved")}
            style={{ color: "#4CAF50" }}
            autoFocus
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Notifications;




