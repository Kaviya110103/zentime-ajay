import React, { useEffect, useState } from "react";
import axios from "axios";
import { styled } from "@mui/material/styles";
import { API_BASE_URL, API_REQUEST_TIMEOUT_MS } from "../config/api";
import { fetchBranchesFromLocationSet } from "../utils/branchSource";
import {
  FilterList,
  Check,
  Close,
  PeopleAltOutlined,
  Phone,
} from "@mui/icons-material";
import {
  CircularProgress,
  Button,
  Avatar,
  Modal,
  Box,
  Typography,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";

const DASHBOARD_MODAL_TIMEOUT_MS = Math.min(API_REQUEST_TIMEOUT_MS, 8000);
const ABSENT_GROUP_TABS = [
  { key: "absent", label: "Absent" },
  { key: "weekOff", label: "Week Off" },
  { key: "holiday", label: "Holiday" },
];

const safelyParseJson = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Invalid JSON found in localStorage for loggedInClient");
    return null;
  }
};

const SafeArea = styled("div")(({ theme }) => ({
  backgroundColor: "#F5F5F5",
  minHeight: "100vh",
  padding: theme.spacing(2),
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1),
  },
}));
const Container = styled("div")(({ theme }) => ({
  maxWidth: "1200px",
  margin: "0 auto",
  backgroundColor: "white",
  borderRadius: "12px",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.05)",
  overflow: "hidden",
  [theme.breakpoints.down("sm")]: {
    borderRadius: "8px",
  },
}));

const TopBar = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(2, 3),
  backgroundColor: "white",
  borderBottom: "1px solid #EAEAEA",
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1.5, 2),
  },
}));

const SummaryCard = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(2, 3),
  backgroundColor: "white",
  borderBottom: "1px solid #EAEAEA",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
  },
}));

const FilterButton = styled(Button)(({ theme }) => ({
  color: "#351153",
  borderColor: "#351153",
  borderRadius: "8px",
  textTransform: "none",
  padding: theme.spacing(1, 2),
  "&:hover": {
    backgroundColor: "#F5F0FA",
    borderColor: "#351153",
  },
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    justifyContent: "flex-start",
  },
}));

const FilterOptionsContainer = styled("div")(({ theme }) => ({
  backgroundColor: "white",
  padding: theme.spacing(1, 0),
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  borderRadius: "8px",
  margin: theme.spacing(1, 3),
  zIndex: 1,
  [theme.breakpoints.down("sm")]: {
    margin: theme.spacing(1, 2),
    width: "calc(100% - 32px)",
  },
}));

const FilterOption = styled(Button)(({ selected, theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  padding: theme.spacing(1.5, 3),
  textTransform: "none",
  color: selected ? "#351153" : "#757575",
  backgroundColor: selected ? "#F5F0FA" : "transparent",
  "&:hover": {
    backgroundColor: "#F5F0FA",
  },
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1.5, 2),
  },
}));

const TableHeader = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns:
    "minmax(200px, 3fr) minmax(150px, 2fr) minmax(130px, 1.5fr) minmax(150px, 2fr)",
  padding: theme.spacing(1.5, 3),
  backgroundColor: "#351153",
  color: "white",
  fontWeight: 600,
  fontSize: "14px",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}));

const HeaderCell = styled("div")(({ align }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent:
    align === "center"
      ? "center"
      : align === "right"
      ? "flex-end"
      : "flex-start",
}));

const EmployeeRow = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns:
    "minmax(200px, 3fr) minmax(150px, 2fr) minmax(130px, 1.5fr) minmax(150px, 2fr)",
  alignItems: "center",
  padding: theme.spacing(2, 3),
  borderBottom: "1px solid #EAEAEA",
  cursor: "pointer",
  transition: "background-color 200ms ease-in-out",
  "&:hover": {
    backgroundColor: "#F5F5F5",
  },
  "&:nth-of-type(odd)": {
    backgroundColor: "#FAFAFA",
    "&:hover": {
      backgroundColor: "#F0F0F0",
    },
  },
  [theme.breakpoints.down("sm")]: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    padding: theme.spacing(2),
    gap: theme.spacing(1),
  },
}));

const SegmentedTabs = styled("div")(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  padding: theme.spacing(2, 3, 1),
  backgroundColor: "white",
  borderBottom: "1px solid #EAEAEA",
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1.5, 2, 1),
    overflowX: "auto",
  },
}));

const SegmentButton = styled(Button)(({ active, theme }) => ({
  borderRadius: "999px",
  border: "1px solid #351153",
  backgroundColor: active ? "#351153" : "white",
  color: active ? "white" : "#351153",
  textTransform: "none",
  minWidth: "112px",
  "&:hover": {
    backgroundColor: active ? "#351153" : "#F5F0FA",
  },
}));

const EmployeeCell = styled("div")(({ align, theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent:
    align === "right"
      ? "flex-end"
      : align === "center"
      ? "center"
      : "flex-start",
  gap: theme.spacing(1.5),
  overflow: "hidden",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    justifyContent: "space-between",
    padding: theme.spacing(0.5, 0),
    borderBottom: "1px solid #f0f0f0",
    "&:last-child": {
      borderBottom: "none",
      justifyContent: "flex-start",
    },
  },
}));

const EmployeeAvatar = styled(Avatar)(({ theme }) => ({
  width: "40px",
  height: "40px",
  backgroundColor: "#351153",
  [theme.breakpoints.down("sm")]: {
    width: "36px",
    height: "36px",
  },
}));

const EmployeeName = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  color: "#212121",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  [theme.breakpoints.down("sm")]: {
    fontSize: "0.875rem",
  },
}));

const BranchText = styled(Typography)(({ theme }) => ({
  color: "#757575",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  [theme.breakpoints.down("sm")]: {
    fontSize: "0.75rem",
  },
}));

const MobileLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: "#351153",
  fontSize: "0.75rem",
  minWidth: "80px",
}));

const MobileInfo = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
}));

const ModalContainer = styled(Modal)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(2px)",
});

const ModalContent = styled(Box)(({ theme }) => ({
  backgroundColor: "white",
  borderRadius: "12px",
  width: "400px",
  maxWidth: "90%",
  outline: "none",
  [theme.breakpoints.down("sm")]: {
    width: "95%",
  },
}));

const ModalHeader = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(2, 3),
  borderBottom: "1px solid #EAEAEA",
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1.5, 2),
  },
}));

const ModalEmployeeHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  padding: theme.spacing(3),
  borderBottom: "1px solid #EAEAEA",
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(2),
    gap: theme.spacing(1.5),
  },
}));

const ModalInfoSection = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  padding: theme.spacing(2, 3),
  "&:not(:last-child)": {
    borderBottom: "1px solid #EAEAEA",
  },
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1.5, 2),
  },
}));

const ModalInfoLabel = styled(Typography)(({ theme }) => ({
  color: "#757575",
  fontSize: "14px",
  marginBottom: theme.spacing(0.5),
  [theme.breakpoints.down("sm")]: {
    fontSize: "0.875rem",
  },
}));

const ModalInfoText = styled(Typography)(({ theme }) => ({
  color: "#212121",
  fontWeight: 500,
  [theme.breakpoints.down("sm")]: {
    fontSize: "0.875rem",
  },
}));

const NoResults = styled("div")(({ theme }) => ({
  padding: theme.spacing(3),
  textAlign: "center",
  color: "#757575",
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(2),
  },
}));

const TodayAbsent = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const client = safelyParseJson(localStorage.getItem("loggedInClient"));
  const companyCode = String(client?.companyCode || "").trim().toLowerCase();
  const tenantOrigin = companyCode ? API_BASE_URL : "";
  const fallbackOrigin = API_BASE_URL;

  const [employeeGroups, setEmployeeGroups] = useState({
    absent: [],
    weekOff: [],
    holiday: [],
  });
  const [nonPresentCount, setNonPresentCount] = useState(0);
  const [activeTab, setActiveTab] = useState("absent");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buildApiUrl = (origin, path) => `${origin}${path}`;
  const filteredEmployees = employeeGroups[activeTab] || [];
  const activeTabLabel =
    ABSENT_GROUP_TABS.find((tab) => tab.key === activeTab)?.label || "Absent";
  const totalGroupedEmployees = ABSENT_GROUP_TABS.reduce(
    (total, tab) => total + (employeeGroups[tab.key]?.length || 0),
    0
  );
  const displayNonPresentCount = Number.isFinite(Number(nonPresentCount))
    ? Number(nonPresentCount)
    : totalGroupedEmployees;
  const shouldRetryWithFallback = (requestError) =>
    !requestError?.response &&
    (requestError?.code === "ERR_NETWORK" ||
      requestError?.name === "TypeError" ||
      requestError?.message?.includes("Failed to fetch"));

  const axiosGetWithFallback = async (path) => {
    const primaryUrl = buildApiUrl(tenantOrigin || fallbackOrigin, path);
    const config = { timeout: DASHBOARD_MODAL_TIMEOUT_MS };
    try {
      return await axios.get(primaryUrl, config);
    } catch (requestError) {
      if (tenantOrigin && shouldRetryWithFallback(requestError)) {
        return axios.get(buildApiUrl(fallbackOrigin, path), config);
      }
      throw requestError;
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [selectedBranch]);

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

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (client?.id) {
        params.set("clientId", client.id);
      }
      if (selectedBranch) {
        params.set("branch", selectedBranch);
      }
      const response = await axiosGetWithFallback(
        `/api/attendance/today-absent?${params.toString()}`
      );
      const payload = response?.data;
      const normalizeEmployee = (emp, fallbackStatus) => ({
        id: emp.id,
        name: emp.name,
        branch: emp.branch,
        mobileNo: emp.mobile,
        date: emp.date,
        status: emp.status || emp.displayStatus || fallbackStatus,
      });
      const normalizeList = (items, fallbackStatus) => {
        const records = Array.isArray(items) ? items : [];
        const uniqueEmployees = records.reduce((acc, current) => {
          const exists = acc.find((item) => item.id === current.id);
          return exists ? acc : acc.concat([current]);
        }, []);
        return uniqueEmployees.map((employee) =>
          normalizeEmployee(employee, fallbackStatus)
        );
      };

      setEmployeeGroups({
        absent: normalizeList(
          Array.isArray(payload) ? payload : payload?.absent,
          "Absent"
        ),
        weekOff: normalizeList(payload?.weekOff, "Week Off"),
        holiday: normalizeList(payload?.holiday, "Holiday"),
      });
      setNonPresentCount(
        Array.isArray(payload) ? payload.length : payload?.nonPresentCount ?? 0
      );
      setLoading(false);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setEmployeeGroups({ absent: [], weekOff: [], holiday: [] });
      setNonPresentCount(0);
      setError(null);
      setLoading(false);
    }
  };

  const toggleFilterOptions = () => {
    setShowFilterOptions(!showFilterOptions);
  };

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch);
    setShowFilterOptions(false);
  };

  const formatMobileNumber = (number) => {
    if (!number) return "--";
    // Remove any non-digit characters first
    const cleaned = number.toString().replace(/\D/g, "");
    // Format as XXX-XXX-XXXX
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  };

  // Generate initials from name
  const getInitials = (name) => {
    if (!name) return "?";
    const names = name.split(" ");
    let initials = names[0].substring(0, 1).toUpperCase();
    if (names.length > 1) {
      initials += names[names.length - 1].substring(0, 1).toUpperCase();
    }
    return initials;
  };

  // Generate consistent color based on employee ID
  const getColorFromId = (id) => {
    const colors = [
      "#351153",
      "#4A148C",
      "#6A1B9A",
      "#8E24AA",
      "#9C27B0",
      "#AB47BC",
      "#BA68C8",
      "#CE93D8",
      "#E1BEE7",
      "#F3E5F5",
    ];
    return colors[Math.abs(id) % colors.length];
  };

  if (loading) {
    return (
      <SafeArea>
        <Container>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "200px",
            }}
          >
            <CircularProgress style={{ color: "#351153" }} />
          </Box>
        </Container>
      </SafeArea>
    );
  }

  if (error) {
    return (
      <SafeArea>
        <Container>
          <Box p={3} textAlign="center">
            <Typography color="error" gutterBottom>
              {error}
            </Typography>
            <Button
              style={{ backgroundColor: "#351153" }}
              variant="contained"
              onClick={fetchEmployees}
            >
              Retry
            </Button>
          </Box>
        </Container>
      </SafeArea>
    );
  }

  return (
    <SafeArea>
      <Container>
        {/* Summary Card */}
        <SummaryCard>
          <Box display="flex" alignItems="center" gap={2}>
            <PeopleAltOutlined
              style={{ color: "#351153", fontSize: isMobile ? "20px" : "24px" }}
            />
            <Typography
              variant="body1"
              style={{
                fontFamily: "Open Sans, sans-serif",
                fontSize: isMobile ? "0.875rem" : "1rem",
              }}
            >
              {displayNonPresentCount} Employees Not Present Today
              {selectedBranch && ` (${selectedBranch})`}
            </Typography>
          </Box>
          <FilterButton
            variant="outlined"
            startIcon={
              <FilterList style={{ fontSize: isMobile ? "18px" : "20px" }} />
            }
            onClick={toggleFilterOptions}
          >
            Branch
          </FilterButton>
        </SummaryCard>

        {/* Filter Options */}
        {showFilterOptions && (
          <FilterOptionsContainer>
            <FilterOption
              selected={!selectedBranch}
              onClick={() => handleBranchSelect(null)}
            >
              <Typography style={{ fontSize: isMobile ? "0.875rem" : "1rem" }}>
                All Branches
              </Typography>
              {!selectedBranch && <Check style={{ color: "#351153" }} />}
            </FilterOption>

            {branches.map((branch) => (
              <FilterOption
                key={branch}
                selected={selectedBranch === branch}
                onClick={() => handleBranchSelect(branch)}
              >
                <Typography
                  style={{ fontSize: isMobile ? "0.875rem" : "1rem" }}
                >
                  {branch}
                </Typography>
                {selectedBranch === branch && (
                  <Check style={{ color: "#351153" }} />
                )}
              </FilterOption>
            ))}
          </FilterOptionsContainer>
        )}

        <SegmentedTabs>
          {ABSENT_GROUP_TABS.map((tab) => (
            <SegmentButton
              key={tab.key}
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label} ({employeeGroups[tab.key]?.length || 0})
            </SegmentButton>
          ))}
        </SegmentedTabs>

        {/* Table Header - Desktop only */}
        {!isMobile && (
          <TableHeader>
            <HeaderCell>Employee</HeaderCell>
            <HeaderCell align="center">Branch</HeaderCell>
            <HeaderCell align="center">Status</HeaderCell>
            <HeaderCell align="right">Mobile No</HeaderCell>
          </TableHeader>
        )}

        {/* Employee List */}
        {filteredEmployees.length > 0 ? (
          filteredEmployees.map((employee) => (
            <EmployeeRow
              key={employee.id}
              onClick={() => {
                setSelectedEmployee(employee);
                setModalVisible(true);
              }}
            >
              {/* Employee Name */}
              <EmployeeCell>
                {isMobile && <MobileLabel>Employee</MobileLabel>}
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <EmployeeAvatar
                    sx={{ backgroundColor: getColorFromId(employee.id) }}
                  >
                    {getInitials(employee.name)}
                  </EmployeeAvatar>
                  <EmployeeName>{employee.name}</EmployeeName>
                </Box>
              </EmployeeCell>

              {/* Branch */}
              <EmployeeCell align="center">
                {isMobile && <MobileLabel>Branch</MobileLabel>}
                <BranchText>{employee.branch || "--"}</BranchText>
              </EmployeeCell>

              <EmployeeCell align="center">
                {isMobile && <MobileLabel>Status</MobileLabel>}
                <BranchText>{employee.status || activeTabLabel}</BranchText>
              </EmployeeCell>

              {/* Mobile No */}
              <EmployeeCell align="right">
                {isMobile && <MobileLabel>Mobile No</MobileLabel>}
                <MobileInfo>
                  {isMobile && <Phone fontSize="small" color="action" />}
                  <BranchText>
                    {formatMobileNumber(employee.mobileNo)}
                  </BranchText>
                </MobileInfo>
              </EmployeeCell>
            </EmployeeRow>
          ))
        ) : (
          <NoResults>
            <Typography style={{ fontSize: isMobile ? "0.875rem" : "1rem" }}>
              No absent employees found
              {selectedBranch ? ` in ${selectedBranch}` : ""}
              {` for ${activeTabLabel}`}
            </Typography>
          </NoResults>
        )}

        {/* Employee Details Modal */}
        <ModalContainer
          open={modalVisible}
          onClose={() => setModalVisible(false)}
        >
          <ModalContent>
            <ModalHeader>
              <Typography
                variant="h6"
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: isMobile ? "1.1rem" : "1.25rem",
                }}
              >
                Employee Details
              </Typography>
              <IconButton
                onClick={() => setModalVisible(false)}
                size={isMobile ? "small" : "medium"}
              >
                <Close style={{ fontSize: isMobile ? "20px" : "24px" }} />
              </IconButton>
            </ModalHeader>

            {selectedEmployee && (
              <>
                <ModalEmployeeHeader>
                  <Avatar
                    sx={{
                      width: isMobile ? "48px" : "64px",
                      height: isMobile ? "48px" : "64px",
                      backgroundColor: getColorFromId(selectedEmployee.id),
                      fontSize: isMobile ? "1.25rem" : "1.5rem",
                    }}
                  >
                    {getInitials(selectedEmployee.name)}
                  </Avatar>
                  <div>
                    <Typography
                      variant="h6"
                      style={{
                        fontFamily: "Montserrat, sans-serif",
                        fontSize: isMobile ? "1rem" : "1.25rem",
                      }}
                    >
                      {selectedEmployee.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      style={{ fontSize: isMobile ? "0.75rem" : "0.875rem" }}
                    >
                      ID: {selectedEmployee.id}
                    </Typography>
                  </div>
                </ModalEmployeeHeader>

                <ModalInfoSection>
                  <ModalInfoLabel>Branch</ModalInfoLabel>
                  <ModalInfoText>
                    {selectedEmployee.branch || "--"}
                  </ModalInfoText>
                </ModalInfoSection>

                <ModalInfoSection>
                  <ModalInfoLabel>Mobile No</ModalInfoLabel>
                  <ModalInfoText>
                    {formatMobileNumber(selectedEmployee.mobileNo) || "--"}
                  </ModalInfoText>
                </ModalInfoSection>

                <ModalInfoSection>
                  <ModalInfoLabel>Status</ModalInfoLabel>
                  <ModalInfoText>
                    {selectedEmployee.status || activeTabLabel}
                  </ModalInfoText>
                </ModalInfoSection>

                <ModalInfoSection>
                  <ModalInfoLabel>Date</ModalInfoLabel>
                  <ModalInfoText>
                    {selectedEmployee.date || "--/--"}
                  </ModalInfoText>
                </ModalInfoSection>
              </>
            )}
          </ModalContent>
        </ModalContainer>
      </Container>
    </SafeArea>
  );
};

export default TodayAbsent;





