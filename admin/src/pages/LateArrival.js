import React, { useEffect, useState, useRef } from "react";
import FilterListIcon from "@mui/icons-material/FilterList";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CircularProgress from "@mui/material/CircularProgress";
import { styled } from "@mui/material/styles";
import { API_BASE_URL, fetchWithTimeout } from "../config/api";
import { fetchBranchesFromLocationSet, withAllBranchesOption } from "../utils/branchSource";

const DASHBOARD_MODAL_TIMEOUT_MS = 8000;

// Get client from localStorage at module level
const client = JSON.parse(localStorage.getItem("loggedInClient"));

// Styled components
const SafeArea = styled("div")({
  flex: 1,
  backgroundColor: "#F5F5F5",
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
  marginBottom: theme.spacing(2),
}));

const Table = styled("table")(({ theme, isMobile }) => ({
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  tableLayout: "fixed",
  minWidth: isMobile ? "100%" : "auto",
}));

const TableHeader = styled("thead")(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: 1,
}));

const TableHeaderCell = styled("th")(({ theme, isDesktop }) => ({
  padding: theme.spacing(1.5),
  textAlign: "center",
  fontWeight: 600,
  fontFamily: '"Montserrat", sans-serif',
  fontSize: isDesktop ? 14 : 13,
  backgroundColor: "#351153",
  color: "white",
  position: "sticky",
  top: 0,
  "&:first-of-type": {
    borderTopLeftRadius: 8,
    textAlign: "left",
  },
  "&:last-of-type": {
    borderTopRightRadius: 8,
  },
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

const TableCell = styled("td")(({ theme, isDesktop }) => ({
  padding: theme.spacing(1.5),
  borderBottom: "1px solid #EDE7F6",
  fontSize: isDesktop ? 14 : 13,
  fontFamily: '"Open Sans", sans-serif',
  color: "#212121",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textAlign: "center",
  "&:first-of-type": {
    textAlign: "left",
  },
}));

const StatusBadge = styled("div")(({ theme }) => ({
  backgroundColor: "#FFF3E0",
  color: "#E65100",
  padding: theme.spacing(0.5, 1),
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  textAlign: "center",
  display: "inline-block",
  minWidth: 70,
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

const LateArrivals = () => {
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [branches, setBranches] = useState(["All"]);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const branchFilterRef = useRef(null);

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
    fetchLateArrivals();
  }, [selectedBranch]);

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
  }, []);

  const fetchLateArrivals = async () => {
    try {
      setLoading(true);
      
      // Check if client exists
      if (!client || !client.companyCode) {
        throw new Error("Client information not found. Please log in again.");
      }
      
      const params = new URLSearchParams();
      if (client?.id) {
        params.set("clientId", client.id);
      }
      if (selectedBranch !== "All") {
        params.set("branch", selectedBranch);
      }
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/attendance/today-time-in-late?${params.toString()}`,
        {},
        DASHBOARD_MODAL_TIMEOUT_MS
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch late arrivals: ${response.status}`);
      }

      const data = await response.json();
      const rows = Array.isArray(data) ? data : [];
      const normalized = rows.map((emp) => ({
        ...emp,
        name: emp.name || [emp.firstName, emp.lastName].filter(Boolean).join(" ") || "Unknown",
        mobile: emp.mobile || "N/A",
        branch: emp.branch || "Unknown",
        status: "Late",
      }));

      setFilteredEmployees(normalized);

      setError(null);
    } catch (err) {
      setFilteredEmployees([]);
      setError(null);
      console.error("Error fetching late arrivals:", err);
    } finally {
      setLoading(false);
    }
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

  const handleRetry = () => {
    setError(null);
    fetchLateArrivals();
  };

  const getFormattedEmployeeId = (employeeId) => {
    if (!client || !client.companyCode) {
      return employeeId || "N/A";
    }
    const companyCode = client.companyCode.toUpperCase();
    return `${companyCode}.EMP${employeeId}`;
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
          <div style={{ marginLeft: 16, color: "#351153" }}>Loading late arrivals...</div>
        </div>
      </SafeArea>
    );
  }

  if (error) {
    return (
      <SafeArea>
        <Container>
          <Header>
            <HeaderText>Late Arrivals</HeaderText>
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
          <HeaderText>Late Arrivals</HeaderText>
          <SubHeaderText>
            Showing {filteredEmployees.length} record{filteredEmployees.length !== 1 ? 's' : ''}
            {selectedBranch !== "All" ? ` in ${selectedBranch}` : " across all branches"}
          </SubHeaderText>
        </Header>

        <SummaryCard>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "#212121",
              fontFamily: '"Montserrat", sans-serif',
            }}
          >
            {selectedBranch !== "All" ? `${selectedBranch}` : "All Branches"}
          </div>
          <FilterContainer>
            <div ref={branchFilterRef} style={{ position: "relative" }}>
              <FilterButton
                onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
              >
                <FilterButtonText>Branch</FilterButtonText>
                <FilterListIcon style={{ fontSize: 16, color: "#351153" }} />
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
          <Table isMobile={!isDesktop}>
            <TableHeader>
              <tr>
                <TableHeaderCell
                  isDesktop={isDesktop}
                  style={{ width: isDesktop ? "30%" : "40%" }}
                >
                  Employee
                </TableHeaderCell>
                {isDesktop && (
                  <TableHeaderCell
                    isDesktop={isDesktop}
                    style={{ width: "20%" }}
                  >
                    Branch
                  </TableHeaderCell>
                )}
                <TableHeaderCell
                  isDesktop={isDesktop}
                  style={{ width: isDesktop ? "15%" : "25%" }}
                >
                  Time In
                </TableHeaderCell>
                <TableHeaderCell
                  isDesktop={isDesktop}
                  style={{ width: isDesktop ? "15%" : "20%" }}
                >
                  Status
                </TableHeaderCell>
                {!isDesktop && (
                  <TableHeaderCell
                    isDesktop={isDesktop}
                    style={{ width: "15%" }}
                  >
                    Branch
                  </TableHeaderCell>
                )}
              </tr>
            </TableHeader>
            <tbody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.employeeId || employee.id}>
                  <TableCell isDesktop={isDesktop}>
                    <div style={{ fontWeight: 500, textAlign: "left" }}>
                      {employee.name || `Employee ${employee.employeeId}`}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#757575",
                        textAlign: "left",
                      }}
                    >
                      ID: {getFormattedEmployeeId(employee.employeeId || employee.id)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#757575",
                        textAlign: "left",
                      }}
                    >
                      📱 {employee.mobile || "N/A"}
                    </div>
                  </TableCell>
                  {isDesktop && (
                    <TableCell isDesktop={isDesktop}>
                      {employee.branch || "Unknown"}
                    </TableCell>
                  )}
                  <TableCell isDesktop={isDesktop}>
                    {formatTime(employee.timeIn)}
                  </TableCell>
                  <TableCell isDesktop={isDesktop}>
                    <StatusBadge>Late</StatusBadge>
                  </TableCell>
                  {!isDesktop && (
                    <TableCell isDesktop={isDesktop}>
                      {employee.branch || "Unknown"}
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
              No late arrivals found for the selected criteria
            </EmptyStateText>
            <div style={{ fontSize: 14, color: "#757575", marginTop: 8, textAlign: "center" }}>
              Try selecting a different branch or check back later
            </div>
          </div>
        )}
      </Container>
    </SafeArea>
  );
};

export default LateArrivals;




