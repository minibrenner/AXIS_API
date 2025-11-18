import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import CashClosingReportPage from "./cash/CashClosingReportPage";
import { AxisLoginPage, ResetPasswordPage } from "./login";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AxisLoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<CashClosingReportPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
