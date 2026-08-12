import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";

export default function LocationRequests() {
  const client = JSON.parse(localStorage.getItem("loggedInClient"));
  const companyCode = String(client?.companyCode || "").trim().toLowerCase();
  const tenantOrigin = companyCode ? API_BASE_URL : "";
  const fallbackOrigin = API_BASE_URL;
  const API_PATH = "/api/location-requests";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const buildApiUrl = (origin, path) => `${origin}${path}`;
  const shouldRetryWithFallback = (error) =>
    !error?.response && error?.code === "ERR_NETWORK";

  const axiosRequestWithFallback = useCallback(
    async (config) => {
      const primaryConfig = {
        ...config,
        url: buildApiUrl(tenantOrigin || fallbackOrigin, config.url),
      };
      try {
        return await axios(primaryConfig);
      } catch (error) {
        if (tenantOrigin && shouldRetryWithFallback(error)) {
          return axios({
            ...config,
            url: buildApiUrl(fallbackOrigin, config.url),
          });
        }
        throw error;
      }
    },
    [tenantOrigin]
  );

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { clientId: client?.id };
      if (statusFilter !== "all") params.status = statusFilter;
      const response = await axiosRequestWithFallback({
        method: "GET",
        url: API_PATH,
        params,
      });
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError("Failed to fetch location requests");
    } finally {
      setLoading(false);
    }
  }, [API_PATH, axiosRequestWithFallback, client?.id, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const updateStatus = async (id, status) => {
    try {
      await axiosRequestWithFallback({
        method: "PUT",
        url: `${API_PATH}/${id}/status`,
        data: null,
        params: {
          status,
          clientId: client?.id,
          reviewedBy: client?.companyCode || "ADMIN",
        },
      });
      setSuccess(`Request ${status} successfully`);
      fetchRequests();
    } catch (err) {
      setError(`Failed to ${status} request`);
    }
  };

  const statusColor = (status) => {
    if (status === "approved") return "success";
    if (status === "rejected") return "error";
    return "warning";
  };

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)),
    [rows]
  );

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: "#351153" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Location Requests
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3, mb: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h5">Outside Location Attendance Requests</Typography>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
            {success}
          </Alert>
        )}

        <Paper>
          {loading ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#351153" }}>
                    <TableCell sx={{ color: "white" }}>ID</TableCell>
                    <TableCell sx={{ color: "white" }}>Employee</TableCell>
                    <TableCell sx={{ color: "white" }}>Branch</TableCell>
                    <TableCell sx={{ color: "white" }}>GPS</TableCell>
                    <TableCell sx={{ color: "white" }}>Address</TableCell>
                    <TableCell sx={{ color: "white" }}>Reason</TableCell>
                    <TableCell sx={{ color: "white" }}>Requested At</TableCell>
                    <TableCell sx={{ color: "white" }}>Status</TableCell>
                    <TableCell sx={{ color: "white" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>
                        {row.employee?.firstName} {row.employee?.lastName || ""}
                      </TableCell>
                      <TableCell>{row.employee?.branch || "-"}</TableCell>
                      <TableCell>
                        {row.currentLatitude}, {row.currentLongitude}
                      </TableCell>
                      <TableCell>{row.currentAddress || "-"}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                      <TableCell>
                        {row.requestedAt ? new Date(row.requestedAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={statusColor(row.status)} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            disabled={row.status !== "pending"}
                            onClick={() => updateStatus(row.id, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="contained"
                            color="error"
                            size="small"
                            disabled={row.status !== "pending"}
                            onClick={() => updateStatus(row.id, "rejected")}
                          >
                            Reject
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!sortedRows.length && (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        No location requests found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Container>
    </>
  );
}






