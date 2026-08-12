import React, { useEffect, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faFilter,
  faImage,
  faMapMarkerAlt,
  faTimes,
  faSignOutAlt,
  faSignInAlt,
} from "@fortawesome/free-solid-svg-icons";
import { styled } from "@mui/material/styles";
import CircularProgress from "@mui/material/CircularProgress";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import axios from "axios";
import "react-datepicker/dist/react-datepicker.css";
import { API_BASE_URL, fetchWithTimeout, resolveBackendAssetUrl } from "../config/api";
import { fetchBranchesFromLocationSet, withAllBranchesOption } from "../utils/branchSource";

const DASHBOARD_MODAL_TIMEOUT_MS = 8000;

// Styled components (moved outside component)
const SafeArea = styled("div")({
  flex: 1,
  backgroundColor: "#F5F5F5",
  minHeight: "100vh",
});

const Container = styled("div")(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(0, 2),
  maxWidth: "100%",
  overflowX: "auto",
  [theme.breakpoints.up("md")]: {
    padding: theme.spacing(0, 3),
  },
  "&::-webkit-scrollbar": {
    display: "none",
  },
  scrollbarWidth: "none",
  msOverflowStyle: "none",
}));

const Header = styled("div")(({ theme }) => ({
  padding: theme.spacing(2, 0),
  marginBottom: theme.spacing(2),
  [theme.breakpoints.up("md")]: {
    padding: theme.spacing(3, 0),
  },
}));

const HeaderText = styled("div")(({ theme }) => ({
  color: "#351153",
  fontSize: 20,
  fontWeight: 700,
  fontFamily: '"Montserrat", sans-serif',
}));

const SubHeaderText = styled("div")(({ theme }) => ({
  color: "#757575",
  fontSize: 14,
  marginTop: theme.spacing(0.5),
  fontFamily: '"Open Sans", sans-serif',
}));

const SummaryCard = styled("div")(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: 12,
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexDirection: "row",
  width: "100%",
  position: "relative",
  boxShadow: "0 3px 6px rgba(0,0,0,0.1)",
}));

const FilterContainer = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  gap: theme.spacing(1),
  marginLeft: theme.spacing(-1),
}));

const FilterButton = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "row",
  gap: 6,
  padding: theme.spacing(1, 1.5),
  backgroundColor: "#EDE7F6",
  borderRadius: 8,
  cursor: "pointer",
  position: "relative",
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    backgroundColor: "#D1C4E9",
    transform: "scale(1.02)",
  },
}));

const FilterButtonText = styled("div")(({ theme }) => ({
  color: "#351153",
  fontWeight: 600,
  fontSize: 14,
  fontFamily: '"Montserrat", sans-serif',
}));

const TableContainer = styled("div")(({ theme }) => ({
  width: "100%",
  overflowX: "auto",
  borderRadius: 8,
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
}));

const Table = styled("table")(({ theme }) => ({
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  tableLayout: "fixed",
}));

const TableHeader = styled("thead")(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: 1,
}));

const TableRow = styled("tr")(({ theme }) => ({
  backgroundColor: "white",
  "&:nth-of-type(even)": {
    backgroundColor: "#FAFAFA",
  },
  "&:hover": {
    backgroundColor: "#F5F5F5",
  },
}));

const EmptyStateText = styled("div")(({ theme }) => ({
  color: "#757575",
  marginTop: theme.spacing(2),
  textAlign: "center",
  fontSize: 15,
  fontFamily: '"Open Sans", sans-serif',
}));

const Dropdown = styled("div")(({ theme }) => ({
  position: "absolute",
  top: "100%",
  right: 0,
  backgroundColor: "white",
  borderRadius: 8,
  border: "1px solid #E1BEE7",
  boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
  zIndex: 10,
  width: 200,
  marginTop: theme.spacing(1),
}));

const DropdownItem = styled("div")(({ theme, selected }) => ({
  padding: theme.spacing(1.5, 2),
  cursor: "pointer",
  backgroundColor: selected ? "#F3E5F5" : "white",
  "&:hover": {
    backgroundColor: "#F3E5F5",
  },
}));

const DropdownItemText = styled("div")(({ theme }) => ({
  fontSize: 14,
  color: "#212121",
  fontFamily: '"Open Sans", sans-serif',
}));

// Modal Styled Components
const ModalOverlay = styled("div")(({ theme }) => ({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: theme.spacing(2),
}));

const ModalContent = styled("div")(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: 12,
  maxWidth: "900px",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  position: "relative",
  animation: "slideUp 0.3s ease-out",
  "@keyframes slideUp": {
    from: {
      transform: "translateY(20px)",
      opacity: 0,
    },
    to: {
      transform: "translateY(0)",
      opacity: 1,
    },
  },
}));

const ModalHeader = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(2.5),
  borderBottom: "1px solid #E0E0E0",
  backgroundColor: "#351153",
  color: "white",
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
}));

const ModalTitle = styled("div")(({ theme }) => ({
  fontSize: 18,
  fontWeight: 700,
  fontFamily: '"Montserrat", sans-serif',
}));

const CloseButton = styled("button")(({ theme }) => ({
  backgroundColor: "transparent",
  border: "none",
  color: "white",
  fontSize: 24,
  cursor: "pointer",
  padding: 0,
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  "&:hover": {
    opacity: 0.8,
  },
}));

const ModalBody = styled("div")(({ theme }) => ({
  padding: theme.spacing(3),
}));

const ImageSection = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(3),
  backgroundColor: "#F9FAFB",
  borderRadius: 8,
  padding: theme.spacing(2),
  border: "1px solid #E5E7EB",
}));

const ImageSectionTitle = styled("div")(({ theme }) => ({
  fontSize: 16,
  fontWeight: 600,
  color: "#351153",
  marginBottom: theme.spacing(1.5),
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

const AttendanceImage = styled("img")(({ theme }) => ({
  width: "100%",
  maxHeight: 400,
  borderRadius: 8,
  objectFit: "cover",
  backgroundColor: "#E5E7EB",
  border: "1px solid #D1D5DB",
}));

const TimeInfo = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(1, 0),
  marginBottom: theme.spacing(1),
}));

const TimeLabel = styled("span")(({ theme }) => ({
  fontSize: 13,
  color: "#6B7280",
  fontWeight: 500,
}));

const TimeValue = styled("span")(({ theme }) => ({
  fontSize: 16,
  fontWeight: 600,
  color: "#351153",
}));

const LocationCard = styled("div")(({ theme }) => ({
  backgroundColor: "#E3F2FD",
  border: "1px solid #90CAF9",
  borderRadius: 8,
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  display: "flex",
  gap: theme.spacing(2),
  alignItems: "flex-start",
}));

const LocationIcon = styled("div")(({ theme }) => ({
  fontSize: 20,
  color: "#1976D2",
  marginTop: 4,
}));

const LocationInfo = styled("div")(({ theme }) => ({
  flex: 1,
}));

const LocationTitle = styled("div")(({ theme }) => ({
  fontSize: 14,
  fontWeight: 600,
  color: "#1976D2",
  marginBottom: 4,
}));

const LocationText = styled("div")(({ theme }) => ({
  fontSize: 14,
  color: "#374151",
  wordBreak: "break-word",
}));

const NoImageText = styled("div")(({ theme }) => ({
  textAlign: "center",
  padding: theme.spacing(3),
  color: "#9CA3AF",
  fontSize: 14,
}));

const ViewImageButton = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  backgroundColor: "#351153",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: '"Montserrat", sans-serif',
  transition: "all 0.2s ease",
  "&:hover": {
    backgroundColor: "#4A1D6D",
    transform: "translateY(-2px)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
}));

// Styled component for location display to prevent text cutoff
const LocationDisplay = styled("div")(({ theme }) => ({
  fontSize: 12,
  color: "#757575",
  textAlign: "left",
  display: "flex",
  alignItems: "flex-start",
  gap: 4,
  width: "100%",
  padding: theme.spacing(0.5, 0),
  wordBreak: "break-word",
  whiteSpace: "normal",
  lineHeight: 1.4,
}));

const OnTime = () => {
  const client = JSON.parse(localStorage.getItem("loggedInClient"));
  const companyCode = String(client?.companyCode || "").trim().toLowerCase();
  const tenantOrigin = companyCode ? API_BASE_URL : "";
  const fallbackOrigin = API_BASE_URL;

  const buildApiUrl = (origin, path) => `${origin}${path}`;
  const shouldRetryWithFallback = (error) =>
    !error?.response &&
    (error?.code === "ERR_NETWORK" ||
      error?.name === "TypeError" ||
      error?.message?.includes("Failed to fetch"));

  const fetchWithFallback = async (path, options) => {
    const primaryUrl = buildApiUrl(tenantOrigin || fallbackOrigin, path);
    try {
      return await fetchWithTimeout(primaryUrl, options, DASHBOARD_MODAL_TIMEOUT_MS);
    } catch (error) {
      if (
        tenantOrigin &&
        (error?.name === "TypeError" || error?.message?.includes("Failed to fetch"))
      ) {
        return fetchWithTimeout(buildApiUrl(fallbackOrigin, path), options, DASHBOARD_MODAL_TIMEOUT_MS);
      }
      throw error;
    }
  };

  const axiosGetWithFallback = async (path, config) => {
    const primaryUrl = buildApiUrl(tenantOrigin || fallbackOrigin, path);
    try {
      return await axios.get(primaryUrl, config);
    } catch (error) {
      if (tenantOrigin && shouldRetryWithFallback(error)) {
        return axios.get(buildApiUrl(fallbackOrigin, path), config);
      }
      throw error;
    }
  };

  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [branches, setBranches] = useState(["All"]);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(null);
  const branchFilterRef = useRef(null);

  const getEmployeeNumericId = (emp) => emp?.employeeId ?? emp?.id ?? null;

  // Dynamic styled components that depend on state
  const TableHeaderCell = styled("th")(({ theme }) => ({
    padding: theme.spacing(1.5),
    textAlign: "center",
    fontWeight: 600,
    fontFamily: '"Montserrat", sans-serif',
    fontSize: isDesktop ? 14 : 13,
    backgroundColor: "#351153",
    color: "white",
    position: "sticky",
    top: 0,
    borderRight: "1px solid rgba(255,255,255,0.1)",
    "&:first-of-type": {
      borderTopLeftRadius: 8,
      textAlign: "left",
      paddingLeft: theme.spacing(2.5),
      borderRight: "none",
    },
    "&:last-of-type": {
      borderTopRightRadius: 8,
      borderRight: "none",
    },
  }));

  const TableCell = styled("td")(({ theme }) => ({
    padding: theme.spacing(1.5),
    borderBottom: "1px solid #EDE7F6",
    fontSize: isDesktop ? 14 : 13,
    fontFamily: '"Open Sans", sans-serif',
    color: "#212121",
    verticalAlign: "middle",
    borderRight: "1px solid #F0F0F0",
    "&:first-of-type": {
      textAlign: "left",
      paddingLeft: theme.spacing(2.5),
      borderRight: "none",
    },
    "&:last-of-type": {
      borderRight: "none",
    },
  }));

  const StatusBadge = styled("div")(({ theme, status }) => {
    let backgroundColor, color;
    switch (status) {
      case "Late":
        backgroundColor = "#FFF3E0";
        color = "#E65100";
        break;
      case "Present":
        backgroundColor = "#E8F5E9";
        color = "#2E7D32";
        break;
      case "Checked Out":
        backgroundColor = "#E3F2FD";
        color = "#1565C0";
        break;
      default:
        backgroundColor = "#F5F5F5";
        color = "#757575";
    }
    return {
      backgroundColor,
      color,
      padding: theme.spacing(0.5, 1),
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      textAlign: "center",
      display: "inline-block",
      minWidth: 70,
      margin: "0 auto",
    };
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        branchFilterRef.current &&
        !branchFilterRef.current.contains(event.target)
      ) {
        setIsBranchDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchBranches = async () => {
      if (!client?.id) {
        if (active) setBranches(["All"]);
        return;
      }
      try {
        const names = await fetchBranchesFromLocationSet(client.id);
        if (active) setBranches(withAllBranchesOption(names));
      } catch (error) {
        console.error("Failed to fetch branches from Location Set:", error);
        if (active) setBranches(["All"]);
      }
    };

    fetchBranches();

    return () => {
      active = false;
    };
  }, [client?.id]);

  useEffect(() => {
    fetchEmployees();
  }, [selectedBranch]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      // Check if client exists
      if (!client?.companyCode || !client?.id) {
        throw new Error("Client information not found. Please log in again.");
      }
      
      console.log("Fetching today's time-in data...");
      const params = new URLSearchParams({
        clientId: String(client.id),
      });
      if (selectedBranch !== "All") {
        params.set("branch", selectedBranch);
      }
      const response = await fetchWithFallback(
        `/api/attendance/today-timein?${params.toString()}`
      );

      if (!response.ok) {
        let message = `HTTP Error! Status: ${response.status}`;
        try {
          const body = await response.json();
          message = body?.message || message;
        } catch (parseError) {
          // Keep the status-based message when the server did not return JSON.
        }
        throw new Error(message);
      }

      const data = await response.json();
      const rows = Array.isArray(data) ? data : [];
      console.log("Today-timein API response:", rows);

      // Remove duplicates based on employee ID
      const uniqueEmployees = rows.reduce((acc, current) => {
        const exists = acc.find((item) => item.employeeId === current.employeeId);
        return exists ? acc : acc.concat([current]);
      }, []);

      const enrichedEmployees = uniqueEmployees.map((emp) => ({
        ...emp,
        name:
          emp.name ||
          [emp.firstName, emp.lastName].filter(Boolean).join(" ") ||
          `Employee ${emp.employeeId}`,
        branch: emp.branch || "Unknown",
        profileImage: emp.profileImage,
        mobile: emp.mobile || "N/A",
        timeIn: emp.timeIn || null,
        timeOut: emp.timeOut || null,
        locationIn: emp.locationIn || emp.location || null,
        locationOut: emp.locationOut || null,
        hasCheckedOut: Boolean(emp.hasCheckedOut || emp.timeOut),
        status: emp.status || "Present",
      }));

      console.log("Final enriched employees:", enrichedEmployees);
      setFilteredEmployees(enrichedEmployees);

      setError(null);
    } catch (err) {
      setFilteredEmployees([]);
      setError(null);
      console.error("Error fetching employee data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceImages = async (employee) => {
    try {
      setImageLoading(true);
      setImageError(null);
      setSelectedEmployee(employee);
      setImageModalOpen(true);

      if (!client?.companyCode) {
        setImageError("Company code is missing. Please log in again.");
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const employeeId = getEmployeeNumericId(employee);
      if (!employeeId) {
        setImageError("Employee ID is missing for image lookup.");
        return;
      }

      const response = await axiosGetWithFallback(
        `/api/attendance/${employeeId}/${today}?clientId=${client?.id}`,
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Attendance images API response:", response.data);
      
      // DON'T use locationIn as fallback for locationOut
      // Only use actual checkout location if it exists
      const processedData = {
        ...response.data,
        locationOut: response.data.locationOut || null,
      };
      
      setAttendanceData(processedData);
    } catch (err) {
      setImageError(err.message || "Failed to fetch attendance images");
      console.error("Error fetching attendance images:", err);
    } finally {
      setImageLoading(false);
    }
  };

  const closeImageModal = () => {
    setImageModalOpen(false);
    setSelectedEmployee(null);
    setAttendanceData(null);
    setImageError(null);
  };

  const formatTime = (dateTimeString) => {
    if (!dateTimeString) return "--:--";
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch (e) {
      console.error("Error formatting time:", e);
      return "--:--";
    }
  };

  const getAvatarUrl = (employee) => {
    if (employee.profileImage) return resolveBackendAssetUrl(employee.profileImage);
    const name = employee.name || employee.firstName || `Employee ${employee.employeeId}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=F0E6F6&color=351153&bold=true`;
  };

  const handleRetry = () => {
    setError(null);
    fetchEmployees();
  };

  const getFormattedEmployeeId = (employee) => {
    if (!client?.companyCode) {
      return employee.employeeId ?? employee.id ?? "N/A";
    }
    const companyCode = client.companyCode.toUpperCase();
    const empId = employee.employeeId ?? employee.id ?? "N/A";
    return `${companyCode}.EMP${empId}`;
  };

  // Function to get status badge based on check-in and check-out status
  const getEmployeeStatus = (employee) => {
    if (employee.hasCheckedOut) {
      return "Checked Out";
    }
    return employee.status || "Present";
  };

  // Helper function to get time color
  const getTimeColor = (time, isCheckIn) => {
    if (!time) return "#757575";
    return isCheckIn ? "#2E7D32" : "#1976D2";
  };

  // Function to render time for table cells - REMOVED LOCATION DISPLAY
  const renderTimeOnly = (time, isCheckIn = true) => {
    const timeColor = getTimeColor(time, isCheckIn);
    
    return (
      <div style={{ 
        fontWeight: 500, 
        fontSize: isDesktop ? 14 : 13,
        textAlign: "center",
        color: timeColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4
      }}>
        {time ? (
          <>
            <FontAwesomeIcon 
              icon={isCheckIn ? faSignInAlt : faSignOutAlt} 
              style={{ fontSize: 12 }} 
            />
            {formatTime(time)}
          </>
        ) : (
          "--:--"
        )}
      </div>
    );
  };

  // UPDATED FUNCTION: Render location with proper wrapping and full text display
  const renderLocation = (location, employee) => {
    const locationToShow = employee.locationIn || location || "N/A";
    
    if (locationToShow === "N/A") {
      return (
        <div style={{
          fontSize: 12,
          color: "#9CA3AF",
          textAlign: "center",
          fontStyle: "italic"
        }}>
          N/A
        </div>
      );
    }
    
    return (
      <LocationDisplay title={locationToShow}>
        <FontAwesomeIcon 
          icon={faMapMarkerAlt} 
          style={{ 
            fontSize: 12, 
            color: "#1976D2",
            flexShrink: 0,
            marginTop: 2
          }} 
        />
        <span style={{ flex: 1 }}>{locationToShow}</span>
      </LocationDisplay>
    );
  };

  if (loading) {
    return (
      <SafeArea>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <CircularProgress style={{ color: "#351153" }} />
          <div style={{ marginLeft: 16, color: "#351153" }}>Loading on-time employees...</div>
        </div>
      </SafeArea>
    );
  }

  if (error) {
    return (
      <SafeArea>
        <Container>
          <Header>
            <HeaderText>On Time Employees Today</HeaderText>
          </Header>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              color: "#F44336",
              textAlign: "center",
            }}
          >
            <InfoOutlinedIcon style={{ fontSize: 48, color: "#F44336", marginBottom: 16 }} />
            <EmptyStateText style={{ color: "#F44336", marginBottom: 16 }}>
              Error: {error}
            </EmptyStateText>
            <button
              onClick={handleRetry}
              style={{
                padding: "10px 20px",
                backgroundColor: "#351153",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: '"Montserrat", sans-serif',
                transition: "all 0.2s ease",
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = "#4A1D6D"}
              onMouseOut={(e) => e.target.style.backgroundColor = "#351153"}
              onFocus={(e) => e.target.style.backgroundColor = "#4A1D6D"}
              onBlur={(e) => e.target.style.backgroundColor = "#351153"}
            >
              Retry
            </button>
          </div>
        </Container>
      </SafeArea>
    );
  }

  return (
    <SafeArea>
      <Container>
        <Header>
          <HeaderText>On Time Employees Today</HeaderText>
          <SubHeaderText>
            Showing {filteredEmployees.length} record{filteredEmployees.length === 1 ? '' : 's'}
            {selectedBranch === "All" ? " across all branches" : ` in ${selectedBranch}`}
          </SubHeaderText>
        </Header>

        <SummaryCard>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FontAwesomeIcon
              icon={faClock}
              style={{ color: "#351153", fontSize: 18 }}
            />
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: "#212121",
                fontFamily: '"Montserrat", sans-serif',
              }}
            >
              {selectedBranch === "All" ? "All Branches" : `${selectedBranch}`}
            </div>
          </div>
          <FilterContainer>
            <div ref={branchFilterRef} style={{ position: "relative" }}>
              <FilterButton
                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
              >
                <FilterButtonText>Branch</FilterButtonText>
                <FontAwesomeIcon
                  icon={faFilter}
                  style={{ color: "#351153", fontSize: 14 }}
                />
              </FilterButton>
              {isBranchDropdownOpen && (
                <Dropdown>
                  <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                    {branches.map((branch) => (
                      <DropdownItem
                        key={branch}
                        selected={selectedBranch === branch}
                        onClick={() => {
                          setSelectedBranch(branch);
                          setIsBranchDropdownOpen(false);
                        }}
                      >
                        <DropdownItemText>{branch}</DropdownItemText>
                      </DropdownItem>
                    ))}
                  </div>
                </Dropdown>
              )}
            </div>
          </FilterContainer>
        </SummaryCard>

        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHeaderCell style={{ width: isDesktop ? "20%" : "25%", textAlign: "left" }}>
                  Employee
                </TableHeaderCell>
                {isDesktop && (
                  <TableHeaderCell style={{ width: "12%" }}>
                    Branch
                  </TableHeaderCell>
                )}
                <TableHeaderCell style={{ width: isDesktop ? "12%" : "15%" }}>
                  Time In
                </TableHeaderCell>
                <TableHeaderCell style={{ width: isDesktop ? "12%" : "15%" }}>
                  Time Out
                </TableHeaderCell>
                {/* LOCATION COLUMN - Increased width for better text display */}
                <TableHeaderCell style={{ width: isDesktop ? "18%" : "20%" }}>
                  Location
                </TableHeaderCell>
                <TableHeaderCell style={{ width: isDesktop ? "12%" : "15%" }}>
                  Images
                </TableHeaderCell>
                <TableHeaderCell style={{ width: isDesktop ? "14%" : "10%" }}>
                  Status
                </TableHeaderCell>
                {!isDesktop && (
                  <TableHeaderCell style={{ width: "15%" }}>
                    Branch
                  </TableHeaderCell>
                )}
              </tr>
            </TableHeader>
            <tbody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.employeeId || employee.id}>
                  <TableCell style={{ textAlign: "left" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <img
                        src={getAvatarUrl(employee)}
                        alt={employee.name || `Employee ${employee.employeeId}`}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          objectFit: "cover",
                          backgroundColor: "#f5f5f5",
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentNode.innerHTML = `
                            <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #F0E6F6; display=flex; align-items: center; justify-content: center; color: #351153; font-weight: bold;">
                              ${(employee.name || 'E').charAt(0).toUpperCase()}
                            </div>
                          `;
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 500, textAlign: "left", fontSize: isDesktop ? 14 : 13 }}>
                          {employee.name || `Employee ${employee.employeeId}`}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#757575",
                            textAlign: "left",
                          }}
                        >
                          ID: {getFormattedEmployeeId(employee)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  {isDesktop && (
                    <TableCell>
                      <div style={{ 
                        textAlign: "center",
                        fontSize: isDesktop ? 14 : 13 
                      }}>
                        {employee.branch || "Unknown"}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    {renderTimeOnly(employee.timeIn, true)}
                  </TableCell>
                  <TableCell>
                    {renderTimeOnly(employee.timeOut, false)}
                  </TableCell>
                  {/* LOCATION COLUMN CONTENT - Now with proper wrapping */}
                  <TableCell style={{ padding: "12px 8px" }}>
                    {renderLocation(employee.locationIn, employee)}
                  </TableCell>
                  <TableCell>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "center",
                      alignItems: "center"
                    }}>
                      <ViewImageButton onClick={() => fetchAttendanceImages(employee)}>
                        <FontAwesomeIcon icon={faImage} />
                        View
                      </ViewImageButton>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "center",
                      alignItems: "center"
                    }}>
                      <StatusBadge status={getEmployeeStatus(employee)}>
                        {getEmployeeStatus(employee)}
                      </StatusBadge>
                    </div>
                  </TableCell>
                  {!isDesktop && (
                    <TableCell>
                      <div style={{ 
                        fontSize: 12, 
                        color: "#757575",
                        textAlign: "center" 
                      }}>
                        {employee.branch || "Unknown"}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </tbody>
          </Table>
        </TableContainer>

        {filteredEmployees.length === 0 && !loading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              padding: 32,
            }}
          >
            <InfoOutlinedIcon style={{ fontSize: 40, color: "#B39DDB", marginBottom: 16 }} />
            <EmptyStateText>
              No on-time employees found for the selected criteria
            </EmptyStateText>
            <div style={{ fontSize: 14, color: "#757575", marginTop: 8, textAlign: "center" }}>
              Try selecting a different branch or check back later
            </div>
          </div>
        )}
      </Container>

      {/* Image Modal */}
      {imageModalOpen && (
        <ModalOverlay onClick={closeImageModal}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>
                <FontAwesomeIcon icon={faImage} style={{ marginRight: 10 }} />
                Attendance Images - {selectedEmployee?.name || "Employee"}
              </ModalTitle>
              <CloseButton onClick={closeImageModal}>
                <FontAwesomeIcon icon={faTimes} />
              </CloseButton>
            </ModalHeader>

            <ModalBody>
              {imageLoading && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 40 }}>
                  <CircularProgress style={{ color: "#351153" }} />
                  <div style={{ marginLeft: 16, color: "#351153", fontWeight: 500 }}>
                    Loading attendance images...
                  </div>
                </div>
              )}
              {!imageLoading && imageError && (
                <div style={{ padding: 20, backgroundColor: "#FFEBEE", borderRadius: 8, border: "1px solid #EF5350" }}>
                  <div style={{ color: "#C62828", fontWeight: 600, marginBottom: 8 }}>Error</div>
                  <div style={{ color: "#D32F2F" }}>{imageError}</div>
                </div>
              )}
              {!imageLoading && !imageError && attendanceData && (
                <>
                  {/* Time In Section with Location */}
                  <ImageSection>
                    <ImageSectionTitle>
                      <FontAwesomeIcon icon={faClock} />
                      Time In 
                    </ImageSectionTitle>
                    <TimeInfo>
                      <TimeLabel>Check-in Time:</TimeLabel>
                      <TimeValue>{formatTime(attendanceData.timeIn)}</TimeValue>
                    </TimeInfo>
                    {(attendanceData.location || attendanceData.locationIn) && (
                      <LocationCard style={{ marginTop: 12, marginBottom: 12 }}>
                        <LocationIcon>
                          <FontAwesomeIcon icon={faMapMarkerAlt} />
                        </LocationIcon>
                        <LocationInfo>
                          <LocationTitle>Check-in Location</LocationTitle>
                          <LocationText>{attendanceData.locationIn || attendanceData.location}</LocationText>
                        </LocationInfo>
                      </LocationCard>
                    )}
                    {attendanceData.imageInBase64 ? (
                      <AttendanceImage
                        src={`data:image/jpeg;base64,${attendanceData.imageInBase64}`}
                        alt="Time In Image"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.parentNode.innerHTML = "<div style='padding: 20px; text-align: center; color: #999;'>Failed to load image</div>";
                        }}
                      />
                    ) : (
                      <NoImageText>No time-in image available</NoImageText>
                    )}
                  </ImageSection>

                  {/* Time Out Section with Location - UPDATED */}
                  <ImageSection>
                    <ImageSectionTitle>
                      <FontAwesomeIcon icon={faClock} />
                      Time Out
                    </ImageSectionTitle>
                    <TimeInfo>
                      <TimeLabel>Check-out Time:</TimeLabel>
                      <TimeValue>{formatTime(attendanceData.timeOut) || "Not checked out yet"}</TimeValue>
                    </TimeInfo>
                    {/* Only show location if user has actually checked out AND location exists */}
                    {attendanceData.timeOut && attendanceData.locationIn && (
                      <LocationCard style={{ marginTop: 12, marginBottom: 12 }}>
                        <LocationIcon>
                          <FontAwesomeIcon icon={faMapMarkerAlt} />
                        </LocationIcon>
                        <LocationInfo>
                          <LocationTitle>Check-out Location</LocationTitle>
                          <LocationText>{attendanceData.locationIn || attendanceData.location}</LocationText>
                        </LocationInfo>
                      </LocationCard>
                    )}
                    {attendanceData.imageOutBase64 ? (
                      <AttendanceImage
                        src={`data:image/jpeg;base64,${attendanceData.imageOutBase64}`}
                        alt="Time Out Image"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.parentNode.innerHTML = "<div style='padding: 20px; text-align: center; color: #999;'>Failed to load image</div>";
                        }}
                      />
                    ) : (
                      <NoImageText>No time-out image available</NoImageText>
                    )}
                  </ImageSection>
                </>
              )}
              {!imageLoading && !imageError && !attendanceData && (
                <NoImageText>No attendance data found for this date</NoImageText>
              )}
            </ModalBody>
          </ModalContent>
        </ModalOverlay>
      )}
    </SafeArea>
  );
};

export default OnTime;





