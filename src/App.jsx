import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import PayrollRun from './pages/PayrollRun.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Employees from './pages/Employees.jsx';
import EmployeeProfile from './pages/EmployeeProfile.jsx';
import Compensation from './pages/Compensation.jsx';
import Attendance from './pages/Attendance.jsx';
import Tax from './pages/Tax.jsx';
import Payslips from './pages/Payslips.jsx';
import PayslipsViewer from './pages/PayslipsViewer.jsx';
import Claims from './pages/Claims.jsx';
import LogClaim from './pages/LogClaim.jsx';
import ClaimTracker from './pages/ClaimTracker.jsx';
import Benefits from './pages/Benefits.jsx';
import BenefitPlans from './pages/BenefitPlans.jsx';
import ThirteenthMonth from './pages/ThirteenthMonth.jsx';
import Settings from './pages/Settings.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Archive from './pages/Archive.jsx';

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employees/:id" element={<EmployeeProfile />} />
        <Route path="compensation" element={<Compensation />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="payroll-run" element={<PayrollRun />} />
        <Route path="tax" element={<Tax />} />
        <Route path="payslips" element={<Payslips />} />
        <Route path="payslips-viewer" element={<PayslipsViewer />} />
        <Route path="claims" element={<Claims />} />
        <Route path="claims/new" element={<LogClaim />} />
        <Route path="claims/tracker" element={<ClaimTracker />} />
        <Route path="benefits" element={<Benefits />} />
        <Route path="benefit-plans" element={<BenefitPlans />} />
        <Route path="thirteenth-month" element={<ThirteenthMonth />} />
        <Route path="settings" element={<Settings />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="archive" element={<Archive />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
