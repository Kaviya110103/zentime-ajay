import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
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
  return "#FFC107";
};

export default function WeekoffRequests() {
  const client = JSON.parse(localStorage.getItem("loggedInClient"));
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedBranch, setSelectedBranch] = useState("");

  const buildParams = () => {
    const params = {
      clientId: client?.id,
      requestType: "swap weekoff",
    };
    if (selectedMonth instanceof Date && !Number.isNaN(selectedMonth.getTime())) {
      params.month = getMonth(selectedMonth) + 1;
      params.year = getYear(selectedMonth);
    }
    if (selectedBranch) {
      params.branch = selectedBranch;
    }
    return params;
  };

  const fetchRequests = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/leaves/all`,
        { params: buildParams() }
      );
      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to fetch swap weekoff requests:", error);
      alert("Failed to fetch swap weekoff requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, selectedMonth, selectedBranch]);

  const updateStatus = async (requestId, status) => {
    try {
      setRefreshing(true);
      await axios.put(`${API_BASE_URL}/api/leaves/status/${requestId}`, null, {
        params: { status, clientId: client?.id },
      });
      await fetchRequests();
    } catch (error) {
      console.error("Failed to update swap weekoff request status:", error);
      alert("Failed to update request status.");
      setRefreshing(false);
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        background: "#f5f5f5",
        minHeight: "100vh",
      }}
    >
      <Typography
        variant="h4"
      sx={{ color: "#351153", fontWeight: 700, mb: 2, fontFamily: "Montserrat, sans-serif" }}
      >
        Swap Weekoff Requests
      </Typography>

      <RequestFilterBar
        clientId={client?.id}
        selectedMonth={selectedMonth}
        selectedBranch={selectedBranch}
        onMonthChange={(value) => setSelectedMonth(value || new Date())}
        onBranchChange={setSelectedBranch}
        onRefresh={() => {
          setRefreshing(true);
          fetchRequests();
        }}
        refreshing={refreshing}
      />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress sx={{ color: "#351153" }} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>ID</TableCell>
                <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Employee</TableCell>
                <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Branch</TableCell>
                <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Actual Weekoff</TableCell>
                <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Swap Day</TableCell>
                <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Reason</TableCell>
                <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Status</TableCell>
                <TableCell align="center" sx={{ backgroundColor: "#351153", color: "#fff" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No swap weekoff requests found.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => {
                  const isPending = normalize(request.status) === "pending";
                  return (
                    <TableRow key={request.id}>
                      <TableCell align="center">{request.id}</TableCell>
                      <TableCell align="center">
                        {request.employee?.firstName || "Unknown"} (ID: {request.employee?.id || "N/A"})
                      </TableCell>
                      <TableCell align="center">{request.employee?.branch || "-"}</TableCell>
                      <TableCell align="center">{request.employee?.weekOff || "-"}</TableCell>
                      <TableCell align="center">{request.startDate || request.date || "-"}</TableCell>
                      <TableCell align="center">{request.reason || "-"}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={String(request.status || "pending").toUpperCase()}
                          sx={{ color: "#fff", backgroundColor: statusColor(request.status), fontWeight: 700 }}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Approve">
                          <span>
                            <IconButton
                              onClick={() => updateStatus(request.id, "approved")}
                              disabled={!isPending || refreshing}
                              sx={{ color: "#4CAF50" }}
                            >
                              <CheckIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <span>
                            <IconButton
                              onClick={() => updateStatus(request.id, "rejected")}
                              disabled={!isPending || refreshing}
                              sx={{ color: "#F44336" }}
                            >
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
        </TableContainer>
      )}
    </Box>
  );
}
