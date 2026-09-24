import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaBars,
  FaBullhorn,
  FaCalendarCheck,
  FaClipboardList,
  FaDollarSign,
  FaExchangeAlt,
  FaHome,
  FaHourglassHalf,
  FaLifeRing,
  FaMapMarkedAlt,
  FaMapMarkerAlt,
  FaRegCalendarAlt,
  FaSignOutAlt,
  FaUserClock,
  FaUserPlus,
} from "react-icons/fa";
import logo from "../logo.png";
import "./AdminLayout.css";

const NAV_ITEMS = [
  { label: "Overview", path: "/AdminDashboard", icon: <FaHome /> },
  { label: "Add Employee", path: "/add-employee", icon: <FaUserPlus /> },
  { label: "Leave & Permissions", path: "/leaveadmin", icon: <FaCalendarCheck /> },
  { label: "Attendance Records", path: "/AttendanceRecords", icon: <FaClipboardList /> },
  { label: "Overtime Requests", path: "/OvertimeRequests", icon: <FaHourglassHalf /> },
  { label: "Weekoff Requests", path: "/WeekoffRequests", icon: <FaExchangeAlt /> },
  { label: "Support Requests", path: "/AttendanceSupportRequests", icon: <FaLifeRing /> },
  { label: "Holiday Calendar", path: "/HolidayCalendar", icon: <FaRegCalendarAlt /> },
  { label: "Announcements", path: "/Announcements", icon: <FaBullhorn /> },
  { label: "Payroll", path: "/Payroll", icon: <FaDollarSign /> },
  { label: "LocationSet", path: "/LocationSet", icon: <FaMapMarkerAlt /> },
  { label: "Location Requests", path: "/LocationRequests", icon: <FaMapMarkedAlt /> },
  { label: "Notifications", path: "/Notifications", icon: <FaBell /> },
  { label: "MissedTimes", path: "/MissedTimes", icon: <FaUserClock /> },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboardRoute = location.pathname.toLowerCase() === "/admindashboard";
  const [dashboardDetailOpen, setDashboardDetailOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 900 && window.location.pathname.toLowerCase() === "/admindashboard");
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < 900);
  const client = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("loggedInClient") || "{}");
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    const onResize = () => {
      const compact = window.innerWidth < 900;
      setIsCompact(compact);
      setSidebarOpen(!compact && isDashboardRoute && !dashboardDetailOpen);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isDashboardRoute, dashboardDetailOpen]);

  useEffect(() => {
    setSidebarOpen(!isCompact && isDashboardRoute && !dashboardDetailOpen);
  }, [isCompact, isDashboardRoute, dashboardDetailOpen]);

  useEffect(() => {
    const handleDashboardDetail = (event) => {
      setDashboardDetailOpen(Boolean(event.detail?.open));
    };

    window.addEventListener("admin-dashboard-detail", handleDashboardDetail);
    return () => window.removeEventListener("admin-dashboard-detail", handleDashboardDetail);
  }, []);

  const handleToggle = () => {
    setSidebarOpen((value) => !value);
  };

  const handleLinkClick = () => {
    if (isCompact) {
      setSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("AdminActive");
    navigate("/");
  };

  const companyName = [client?.companyName, client?.companyCode].filter(Boolean).join(" ");

  return (
    <div className={`admin-layout ${sidebarOpen ? "sidebar-visible" : "sidebar-hidden"}`}>
      {isCompact && sidebarOpen ? (
        <button
          type="button"
          className="admin-layout-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className="admin-global-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-header">
          <img src={logo} alt="ZenTime Logo" className="admin-sidebar-logo" />
          <div className="admin-sidebar-title">{companyName || "Zen Time"}</div>
        </div>

        <nav className="admin-sidebar-menu">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `admin-sidebar-link ${isActive ? "active" : ""}`
              }
              onClick={handleLinkClick}
            >
              <span className="admin-sidebar-icon">{item.icon}</span>
              <span className="admin-sidebar-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button type="button" className="admin-sidebar-logout" onClick={handleLogout}>
          <span className="admin-sidebar-icon"><FaSignOutAlt /></span>
          <span className="admin-sidebar-text">Logout</span>
        </button>
      </aside>

      <button
        type="button"
        className="admin-sidebar-toggle"
        onClick={handleToggle}
        aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
        title={sidebarOpen ? "Close navigation" : "Open navigation"}
      >
        <FaBars />
      </button>

      <main className="admin-layout-content">{children}</main>
    </div>
  );
}
