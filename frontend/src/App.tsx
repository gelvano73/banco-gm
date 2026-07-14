import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { PixPage } from './pages/PixPage';
import { TransfersPage } from './pages/TransfersPage';
import { CardsPage } from './pages/CardsPage';
import { LoansPage } from './pages/LoansPage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { StatementPage } from './pages/StatementPage';
import { SecurityPage } from './pages/SecurityPage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/pix" element={<PixPage />} />
          <Route path="/transferencias" element={<TransfersPage />} />
          <Route path="/cartoes" element={<CardsPage />} />
          <Route path="/emprestimos" element={<LoansPage />} />
          <Route path="/investimentos" element={<InvestmentsPage />} />
          <Route path="/extrato" element={<StatementPage />} />
          <Route path="/seguranca" element={<SecurityPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
