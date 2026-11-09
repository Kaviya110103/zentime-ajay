import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ArchiveIcon from "@mui/icons-material/Archive";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RefreshIcon from "@mui/icons-material/Refresh";
import { API_BASE_URL, fetchWithTimeout } from "../config/api";

const getEmployeeName = (employee) =>
  `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "Unnamed Employee";

export default function Archives() {
  const navigate = useNavigate();
  const client = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("loggedInClient") || "{}");
    } catch {
      return {};
    }
  }, []);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadArchivedEmployees = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: "ARCHIVED" });
      if (client?.id != null) params.set("clientId", String(client.id));
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/employees?${params.toString()}`);
      if (!response.ok) throw new Error(`Unable to load archives (${response.status})`);
      const data = await response.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load archived employees");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchivedEmployees();
  }, []);

  const viewAttendance = (employee) => {
    const params = new URLSearchParams({
      employeeId: String(employee.id),
      employeeName: getEmployeeName(employee),
    });
    navigate(`/AttendanceRecords?${params.toString()}`);
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#351153", fontWeight: 800 }}>Employee Archives</Typography>
          <Typography sx={{ color: "text.secondary", mt: 0.5 }}>Archived employees are excluded from active operations while their history remains available.</Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadArchivedEmployees} disabled={loading}>Refresh</Button>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Paper elevation={0} sx={{ border: "1px solid #e6dced", borderRadius: 2, overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}><CircularProgress /></Box>
        ) : employees.length === 0 ? (
          <Box sx={{ py: 9, textAlign: "center" }}>
            <ArchiveIcon sx={{ fontSize: 48, color: "#8c6aa8" }} />
            <Typography sx={{ mt: 1, fontWeight: 700 }}>No archived employees</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: "#f5eff9" }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Employee Code</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Branch</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Position</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>Attendance History</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{getEmployeeName(employee)}</Typography>
                      <Typography variant="body2" color="text.secondary">{employee.email || employee.mobile || "-"}</Typography>
                    </TableCell>
                    <TableCell>{employee.employeeCode || employee.id}</TableCell>
                    <TableCell>{employee.branch || "-"}</TableCell>
                    <TableCell>{employee.position || "-"}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" startIcon={<VisibilityIcon />} onClick={() => viewAttendance(employee)} sx={{ backgroundColor: "#351153", textTransform: "none", "&:hover": { backgroundColor: "#4a1d6d" } }}>
                        View Attendance
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
}
