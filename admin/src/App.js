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
  return (
    <Router>
      <SessionInactivityGuard />
      <div className="admin-app-shell">
        <Routes>
          <Route path="/" element={<LoginPage />} />

          <Route path="AdminDashboard" element={
            <ProtectedRoute><Home /></ProtectedRoute>
          } />

          <Route path="ontime" element={
            <ProtectedRoute><OnTime /></ProtectedRoute>
          } />

          <Route path="LateArrival" element={
            <ProtectedRoute><LateArrival /></ProtectedRoute>
          } />

          <Route path="add-employee" element={
            <ProtectedRoute><AddEmployee /></ProtectedRoute>
          } />

          <Route path="add-employee/:id" element={
            <ProtectedRoute><AddEmployee /></ProtectedRoute>
          } />

          <Route path="leaveadmin" element={
            <ProtectedRoute><LeaveAdmin /></ProtectedRoute>
          } />

          <Route path="Attendancerecords" element={
            <ProtectedRoute><AttendanaceRecords /></ProtectedRoute>
          } />

          <Route path="Announcements" element={
            <ProtectedRoute><Announcements /></ProtectedRoute>
          } />

          <Route path="MissedTimes" element={
            <ProtectedRoute><Missedtimes /></ProtectedRoute>
          } />

          <Route path="Payroll" element={
            <ProtectedRoute><Payroll /></ProtectedRoute>
          } />

          <Route path="Notifications" element={
            <ProtectedRoute><Notifications /></ProtectedRoute>
          } />

          <Route path="LocationSet" element={
            <ProtectedRoute><LocationSet /></ProtectedRoute>
          } />

          <Route path="LocationRequests" element={
            <ProtectedRoute><LocationRequests /></ProtectedRoute>
          } />

          <Route path="HolidayCalendar" element={
            <ProtectedRoute><HolidayCalendar /></ProtectedRoute>
          } />

          <Route path="OvertimeRequests" element={
            <ProtectedRoute><OvertimeRequests /></ProtectedRoute>
          } />

          <Route path="WeekoffRequests" element={
            <ProtectedRoute><WeekoffRequests /></ProtectedRoute>
          } />

          <Route path="AttendanceSupportRequests" element={
            <ProtectedRoute><AttendanceSupportRequests /></ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
