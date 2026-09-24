import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef } from 'react';
import Home from './pages/Home';
import OnTime from './pages/OnTime.js';
import LateArrival from './pages/LateArrival.js';
import AddEmployee from './pages/AddEmployee.js';
import LeaveAdmin from './pages/LeaveAdmin.js';
import AttendanaceRecords from './pages/AttendanaceRecords.js';
import Announcements from './pages/Announcements.js';
import Missedtimes from './pages/MissedTimes.js';
import Payroll from './pages/Payroll.js';
import Notifications from './pages/Notifications.js';
import LocationSet from './pages/LocationSet.js';
import LocationRequests from './pages/LocationRequests.js';
import LoginPage from './pages/LoginPage.js';
import ProtectedRoute from './pages/ProtectedRoute';
import HolidayCalendar from './pages/HolidayCalendar';
import OvertimeRequests from './pages/OvertimeRequests';
import WeekoffRequests from './pages/WeekoffRequests';
import AttendanceSupportRequests from './pages/AttendanceSupportRequests';
import AdminLayout from './component/AdminLayout';

const INACTIVITY_MS = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'adminLastActivity';

function SessionInactivityGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const timeoutRef = useRef(null);

  const clearAdminSession = useCallback(() => {
    localStorage.removeItem('AdminActive');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    navigate('/', { replace: true });
  }, [navigate]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const isLoggedIn = localStorage.getItem('AdminActive') === 'true';
    if (!isLoggedIn || location.pathname === '/') {
      return;
    }

    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    timeoutRef.current = setTimeout(() => {
      clearAdminSession();
    }, INACTIVITY_MS);
  }, [clearAdminSession, location.pathname]);

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('AdminActive') === 'true';
    if (!isLoggedIn) {
      return;
    }

    const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
    if (lastActivity > 0 && Date.now() - lastActivity >= INACTIVITY_MS) {
      clearAdminSession();
      return;
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const onActivity = () => resetTimer();

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    resetTimer();

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location.pathname, resetTimer, clearAdminSession]);

  return null;
}

function App() {
  const protectedPage = (children) => (
    <ProtectedRoute>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  );

  return (
    <Router>
      <SessionInactivityGuard />
      <div className="admin-app-shell">
        <Routes>
          <Route path="/" element={<LoginPage />} />

          <Route path="AdminDashboard" element={
            protectedPage(<Home />)
          } />

          <Route path="ontime" element={
            protectedPage(<OnTime />)
          } />

          <Route path="LateArrival" element={
            protectedPage(<LateArrival />)
          } />

          <Route path="add-employee" element={
            protectedPage(<AddEmployee />)
          } />

          <Route path="add-employee/:id" element={
            protectedPage(<AddEmployee />)
          } />

          <Route path="leaveadmin" element={
            protectedPage(<LeaveAdmin />)
          } />

          <Route path="Attendancerecords" element={
            protectedPage(<AttendanaceRecords />)
          } />

          <Route path="Announcements" element={
            protectedPage(<Announcements />)
          } />

          <Route path="MissedTimes" element={
            protectedPage(<Missedtimes />)
          } />

          <Route path="Payroll" element={
            protectedPage(<Payroll />)
          } />

          <Route path="Notifications" element={
            protectedPage(<Notifications />)
          } />

          <Route path="LocationSet" element={
            protectedPage(<LocationSet />)
          } />

          <Route path="LocationRequests" element={
            protectedPage(<LocationRequests />)
          } />

          <Route path="HolidayCalendar" element={
            protectedPage(<HolidayCalendar />)
          } />

          <Route path="OvertimeRequests" element={
            protectedPage(<OvertimeRequests />)
          } />

          <Route path="WeekoffRequests" element={
            protectedPage(<WeekoffRequests />)
          } />

          <Route path="AttendanceSupportRequests" element={
            protectedPage(<AttendanceSupportRequests />)
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
