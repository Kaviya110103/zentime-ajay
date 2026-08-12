import {
  FaUsers,
  FaCalendarMinus,
  FaHourglassHalf,
  FaBell,
  FaSun,
  FaSortAmountDown,
  FaHome,
  FaUserPlus,
  FaCalendarCheck,
  FaClipboardList,
  FaRegCalendarAlt,
  FaBullhorn,
  FaDollarSign,
  FaMapMarkerAlt,
  FaMapMarkedAlt,
  FaUserClock,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaExchangeAlt,
  FaLifeRing,
} from "react-icons/fa";
import axios from "axios";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TotalEmployee from "../component/TotalEmployee";
import OnTime from "./OnTime.js";
import LateArrival from "./LateArrival";
import TodayAbsent from "../component/TodayAbsent";
import MissedTimes from "./MissedTimes";
import Notifications from "./Notifications.js";
import "./Home.css";

// Import the logo directly
import logo from "../logo.png";
import { API_BASE_URL, API_REQUEST_TIMEOUT_MS, fetchWithTimeout } from "../config/api";

export default function Home() {
  const EMPLOYEE_LIMIT_EXCEEDED_MESSAGE =
    "Employee limit exceeded. Kindly contact Super Admin.";
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
  const [isLaptop, setIsLaptop] = useState(window.innerWidth >= 1024 && window.innerWidth < 1440);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1440);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [missedTimesData, setMissedTimesData] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [missedTimeoutCount, setMissedTimeoutCount] = useState(0);
  const [showLimitAlertModal, setShowLimitAlertModal] = useState(false);
  const client = JSON.parse(localStorage.getItem("loggedInClient"));
  const companyCode = String(client?.companyCode || "").trim().toLowerCase();
  const tenantOrigin = companyCode ? API_BASE_URL : "";
  const fallbackOrigin = API_BASE_URL;
  const [attendanceSummary, setAttendanceSummary] = useState({
    lateArrivalsToday: 0,
    lateArrivalsYesterday: 0,
    onTimeChangePercent: 0.0,
    absentToday: 0,
    absentYesterday: 0,
    presentToday: 0,
    lateChangePercent: 0.0,
    onTimeToday: 0,
    absentChangePercent: 0.0,
    totalEmployees: 0,
    presentYesterday: 0,
    onTimeYesterday: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const buildApiUrl = (origin, path) => `${origin}${path}`;
  const shouldRetryWithFallback = (error) =>
    !error?.response &&
    (error?.code === "ERR_NETWORK" ||
      error?.name === "TypeError" ||
      error?.message?.includes("Failed to fetch"));

  const axiosGetWithFallback = async (path) => {
    const primaryUrl = buildApiUrl(tenantOrigin || fallbackOrigin, path);
    const config = { timeout: API_REQUEST_TIMEOUT_MS };
    try {
      return await axios.get(primaryUrl, config);
    } catch (error) {
      if (tenantOrigin && shouldRetryWithFallback(error)) {
        return axios.get(buildApiUrl(fallbackOrigin, path), config);
      }
      throw error;
    }
  };

  const fetchMissedTimeoutCount = async () => {
    if (!client?.id) {
      return 0;
    }

    try {
      const response = await axiosGetWithFallback(
        appendDashboardParams("/api/attendance/missed-timeout/count")
      );
      return Number(response?.data || 0);
    } catch (error) {
      console.warn("Missed timeout count endpoint failed:", error);
      return 0;
    }
  };

  const fetchWithFallback = async (path, options) => {
    const primaryUrl = buildApiUrl(tenantOrigin || fallbackOrigin, path);
    try {
      return await fetchWithTimeout(primaryUrl, options);
    } catch (error) {
      if (tenantOrigin && (error?.name === "TypeError" || error?.message?.includes("Failed to fetch"))) {
        return fetchWithTimeout(buildApiUrl(fallbackOrigin, path), options);
      }
      throw error;
    }
  };

  const appendDashboardParams = (path, extraParams = {}) => {
    const [pathname, rawQuery = ""] = path.split("?");
    const params = new URLSearchParams(rawQuery);
    if (client?.id && !params.has("clientId")) {
      params.set("clientId", client.id);
    }
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, value);
      }
    });
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  };

  useEffect(() => {
    const isAdmin = localStorage.getItem("AdminActive");
    if (!isAdmin) {
      navigate("/");
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      setIsLaptop(width >= 1024 && width < 1440);
      setIsDesktop(width >= 1440);
      
      if (width >= 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [summaryResult, notificationResult, missedCountResult] = await Promise.allSettled([
          axiosGetWithFallback(appendDashboardParams("/api/attendance/summary")),
          axiosGetWithFallback(appendDashboardParams("/api/leaves/status/Pending/count")),
          fetchMissedTimeoutCount(),
        ]);

        if (!active) return;

        if (summaryResult.status === "fulfilled") {
          setAttendanceSummary((prev) => ({
            ...prev,
            ...(summaryResult.value?.data || {}),
          }));
        } else {
          console.error("Error fetching attendance summary:", summaryResult.reason);
        }

        if (notificationResult.status === "fulfilled") {
          setNotificationCount(Number(notificationResult.value?.data || 0));
        } else {
          console.error("Error fetching notification count:", notificationResult.reason);
          setNotificationCount(0);
        }

        if (missedCountResult.status === "fulfilled") {
          setMissedTimeoutCount(Number(missedCountResult.value || 0));
        } else {
          console.error("Error fetching missed timeout count:", missedCountResult.reason);
          setMissedTimeoutCount(0);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, [client?.id]);

  useEffect(() => {
    if (
      selectedIndex !== null &&
      cardData[selectedIndex]?.label === "Clockout Request"
    ) {
      axiosGetWithFallback(appendDashboardParams("/api/attendance/missed-timeout", { limit: 50 }))
        .then((response) => {
          setMissedTimesData(response.data);
        })
        .catch((error) => {
          setMissedTimesData([]);
          console.error("Error fetching missed times:", error);
        });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const time = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setCurrentTime(time);
    }, 1000);

    const now = new Date();
    const options = {
      day: "numeric",
      month: "long",
      year: "numeric",
    };
    const formattedDate = now.toLocaleDateString("en-GB", options);
    setCurrentDate(formattedDate);

    return () => clearInterval(timer);
  }, []);

  const canNavigateToAddEmployee = async () => {
    if (!client?.id) {
      return true;
    }

    try {
      const [clientRes, employeesRes] = await Promise.all([
        fetchWithFallback(`/api/clients/${client.id}`),
        fetchWithFallback(`/api/employees/count?clientId=${client.id}`),
      ]);

      if (!clientRes.ok || !employeesRes.ok) {
        return true;
      }

      const clientData = await clientRes.json();
      const employeeCountPayload = await employeesRes.json();
      const employeeLimit = Number.parseInt(
        clientData?.employeeCount ?? client?.employeeCount,
        10
      );
      const currentCount = Number(
        employeeCountPayload?.count ?? employeeCountPayload ?? 0
      );

      if (
        Number.isFinite(employeeLimit) &&
        employeeLimit > 0 &&
        currentCount >= employeeLimit
      ) {
        setShowLimitAlertModal(true);
        return false;
      }
    } catch (error) {
      console.error("Add employee pre-navigation limit check failed:", error);
    }

    return true;
  };

  const calculatePercentageText = (today, yesterday) => {
    if (yesterday === 0) {
      return "No data from yesterday";
    }
    const change = today - yesterday;
    const percent = (change / yesterday) * 100;
    const direction = change >= 0 ? "Increase" : "Decrease";
    return `${Math.abs(percent).toFixed(1)}% ${direction} than yesterday`;
  };

  const cardData = [
    {
      count: attendanceSummary.totalEmployees,
      label: "Employees",
      icon: <FaUsers />,
      bottomText: "United as one team",
      statusColor: "#4CAF50",
      showOnMobile: true,
      component: <TotalEmployee />,
    },
    {
      count: missedTimeoutCount,
      label: "Clockout Request",
      icon: <FaUsers />,
      bottomText: "Timely action keeps things on track",
      statusColor: "#2196F3",
      showOnMobile: false,
      component: <MissedTimes data={missedTimesData} />,
    },
    {
      count: attendanceSummary.presentToday,
      label: "Present",
      icon: <FaUsers />,
      bottomText: "Consistency builds strong routines",
      statusColor: "#4CAF50",
      showOnMobile: true,
      component: <OnTime />,
    },
    {
      count: attendanceSummary.absentToday,
      label: "Absent",
      icon: <FaCalendarMinus />,
      bottomText: "Gaps impact the workflow",
      statusColor: "#F44336",
      showOnMobile: true,
      component: <TodayAbsent />,
    },
    {
      count: attendanceSummary.lateArrivalsToday,
      label: "Late Arrival",
      icon: <FaHourglassHalf />,
      bottomText: "Punctuality sets the day's rhythm",
      statusColor: "#FFC107",
      showOnMobile: true,
      component: <LateArrival data={LateArrival} />,
    },
    {
      count: notificationCount,
      label: "Notifications",
      icon: <FaBell />,
      bottomText: "You're all caught up",
      statusColor: "#351153",
      showOnMobile: false,
      component: <Notifications />,
    },
  ];

  const handleMenuClick = async (label) => {
    if (label === "Add Employee") {
      const canProceed = await canNavigateToAddEmployee();
      if (!canProceed) {
        if (isMobile) {
          setSidebarOpen(false);
        }
        return;
      }
      navigate("/add-employee");
    }
    if (label === "Leave & Permissions") {
      navigate("/leaveadmin");
    }
    if (label === "Attendance Records") {
      navigate("/AttendanceRecords");
    }
    if (label === "Overtime Requests") {
      navigate("/OvertimeRequests");
    }
    if (label === "Weekoff Requests") {
      navigate("/WeekoffRequests");
    }
    if (label === "Support Requests") {
      navigate("/AttendanceSupportRequests");
    }
    if (label === "Announcements") {
      navigate("/Announcements");
    }
    if (label === "Holiday Calendar") {
      navigate("/HolidayCalendar");
    }
    if (label === "MissedTimes") {
      navigate("/MissedTimes");
    }
    if (label === "Payroll") {
      navigate("/Payroll");
    }
    if (label === "LocationSet") {
      navigate("/LocationSet");
    }
    if (label === "Location Requests") {
      navigate("/LocationRequests");
    }
    if (label === "Logout") {
      localStorage.removeItem("AdminActive");
      navigate("/");
    }
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  const handleCardClick = (index) => {
    setSelectedIndex(index);
  };

  const closeModal = () => {
    setSelectedIndex(null);
  };

  const closeLimitAlertModal = () => {
    setShowLimitAlertModal(false);
  };

  return (
    <div className="container">
      {isMobile && (
        <div className="mobile-header">
          <div className="hamburger-menu" onClick={toggleSidebar}>
            <FaBars style={{ color: "#351153", fontSize: "24px" }} />
          </div>
          <img src={logo} alt="ZenTime Logo" className="mobile-logo" />
          <div className="mobile-app-name">Zen Time</div>
        </div>
      )}

      {isMobile && (
        <div
          className={`overlay ${isMobile && sidebarOpen ? "visible" : ""}`}
          onClick={closeSidebar}
        />
      )}

      <div
        className={`sidebar ${
          isMobile ? (sidebarOpen ? "open" : "closed") : ""
        }`}
      >
        <div className="sidebar-header">
          <img src={logo} alt="ZenTime Logo" className="logo" />
          <div className="app-name">{client.companyName} {client.companyCode}</div>
        </div>
        <div className="menu-scroll">
          <div className="menu-section">
            <MenuItem label="Overview" icon={<FaHome />} active />
            <MenuItem
              label="Add Employee"
              icon={<FaUserPlus />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="Leave & Permissions"
              icon={<FaCalendarCheck />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="Attendance Records"
              icon={<FaClipboardList />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="Overtime Requests"
              icon={<FaHourglassHalf />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="Weekoff Requests"
              icon={<FaExchangeAlt />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="Support Requests"
              icon={<FaLifeRing />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="Holiday Calendar"
              icon={<FaRegCalendarAlt />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="Announcements"
              icon={<FaBullhorn />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="Payroll"
              icon={<FaDollarSign />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="LocationSet"
              icon={<FaMapMarkerAlt />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="Location Requests"
              icon={<FaMapMarkedAlt />}
              onClick={handleMenuClick}
            />
          </div>

          <div className="menu-section-border">
            <MenuItem
              label="MissedTimes"
              icon={<FaUserClock />}
              onClick={handleMenuClick}
            />
            <MenuItem
              label="Logout"
              icon={<FaSignOutAlt />}
              onClick={handleMenuClick}
            />
          </div>
        </div>
      </div>

      <div
        className={`main-content ${
          isMobile ? (sidebarOpen ? "shifted" : "") : ""
        }`}
      >
        {!isMobile ? (
          <div className="content-header">
            <div className="time-card">
              <div className="time-section">
                <FaSun className="sun-icon" />
                <div>
                  <div className="time-text">{currentTime}</div>
                  <div className="insight-text">Realtime Insight</div>
                </div>
              </div>

              <div className="date-section">
                <div className="today-text">Today:</div>
                <div className="date-text">{currentDate}</div>
              </div>

              <button
                className="attendance-button"
                onClick={() => navigate("/OnTime")}
              >
                View Attendance
              </button>
            </div>

            {loading ? (
              <div className="loading-spinner">Loading data...</div>
            ) : (
              <div className="dashboard-grid">
                {cardData.map((card, index) => (
                  <div
                    key={index}
                    className={`dashboard-card ${
                      selectedIndex === index ? "active" : ""
                    }`}
                    onClick={() => handleCardClick(index)}
                    style={{ "--status-color": card.statusColor }}
                  >
                    <div className="card-top-row">
                      <div className="card-count">{card.count}</div>
                      <div className="card-icon-container">{card.icon}</div>
                    </div>

                    <div className="card-label">{card.label}</div>

                    <div className="card-bottom-row">
                      <div className="small-icon-container">
                        <FaSortAmountDown
                          style={{
                            color:
                              selectedIndex === index
                                ? "white"
                                : card.statusColor,
                          }}
                        />
                      </div>
                      <div className="bottom-text">{card.bottomText}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mobile-content">
            <div className="mobile-time-card">
              <div className="mobile-time-section">
                <FaSun className="mobile-sun-icon" />
                <div>
                  <div className="mobile-time-text">{currentTime}</div>
                  <div className="mobile-insight-text">Realtime Insight</div>
                </div>
              </div>

              <div className="mobile-date-section">
                <div className="mobile-today-text">Today:</div>

                <div className="mobile-date-text">{currentDate}</div>
              </div>

              <button
                className="mobile-attendance-button"
                onClick={() => navigate("/OnTime")}
              >
                View Attendance
              </button>
            </div>

            {loading ? (
              <div className="loading-spinner">Loading data...</div>
            ) : (
              <div className="mobile-dashboard-grid">
                {cardData
                  .filter((card) => card.showOnMobile)
                  .map((card, filteredIndex) => {
                    const originalIndex = cardData.findIndex(
                      (c) => c.label === card.label
                    );
                    return (
                      <div
                        key={originalIndex}
                        className={`mobile-dashboard-card ${
                          selectedIndex === originalIndex ? "active" : ""
                        }`}
                        onClick={() => handleCardClick(originalIndex)}
                        style={{ "--status-color": card.statusColor }}
                      >
                        <div className="card-top-row">
                          <div className="card-count">{card.count}</div>
                          <div className="card-icon-container">{card.icon}</div>
                        </div>

                        <div className="card-label">{card.label}</div>

                        <div className="card-bottom-row">
                          <div className="small-icon-container">
                            <FaSortAmountDown
                              style={{
                                color:
                                  selectedIndex === originalIndex
                                    ? "white"
                                    : card.statusColor,
                              }}
                            />
                          </div>
                          <div className="bottom-text">{card.bottomText}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedIndex !== null && cardData[selectedIndex] && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{cardData[selectedIndex].label}</h3>
              <button className="modal-close-btn" onClick={closeModal}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              {cardData[selectedIndex].component}
            </div>
          </div>
        </div>
      )}

      {showLimitAlertModal && (
        <div className="limit-alert-overlay" onClick={closeLimitAlertModal}>
          <div className="limit-alert-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="limit-alert-title">Employee Limit Alert</h3>
            <p className="limit-alert-message">{EMPLOYEE_LIMIT_EXCEEDED_MESSAGE}</p>
            <button className="limit-alert-button" onClick={closeLimitAlertModal}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  icon,
  active = false,
  hasNotification = false,
  onClick,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick(label);
    }
  };

  return (
    <div
      className={`menu-item-container ${active || isHovered ? "active" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className={`menu-icon ${active || isHovered ? "active" : ""}`}>
        {icon}
      </div>
      <div className={`menu-text ${active || isHovered ? "active" : ""}`}>
        {label}
      </div>
      {hasNotification && <div className="notification-badge" />}
    </div>
  );
}





