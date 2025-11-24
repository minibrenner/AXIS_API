import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import CashClosingReportPage from "./cash/CashClosingReportPage";
import AxisAdminDashboardPage from "./admin-dashboard/AxisAdminDashboardPage";
import { AxisLoginPage, ResetPasswordPage, SuperAdminLoginPage } from "./login";
import SuperAdminDashboardPage from "./super-admin/SuperAdminDashboardPage";

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<AxisLoginPage />} />
        <Route path="/super-admin/login" element={<SuperAdminLoginPage />} />
        <Route
          path="/super-admin/dashboard"
          element={<SuperAdminDashboardPage />}
        />
        <Route path="/admin/dashboard" element={<AxisAdminDashboardPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
