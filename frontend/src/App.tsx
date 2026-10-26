import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireRole } from '@/auth/RequireRole';
import { canUpload, canUseAi, isAdminOrOpsManager } from '@/components/layout/navConfig';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardSkeleton } from '@/components/ui/Skeleton';

// Route-level code splitting: each page becomes its own chunk instead of all
// of them landing in one ~850KB bundle that has to load before anything can
// render — the login screen doesn't need the bookings dashboard's code, etc.
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);
const OverviewPage = lazy(() => import('@/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const AssistantPage = lazy(() => import('@/pages/AssistantPage').then((m) => ({ default: m.AssistantPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BookingsDashboardPage = lazy(() =>
  import('@/pages/reporting/BookingsDashboardPage').then((m) => ({ default: m.BookingsDashboardPage }))
);
const InvestorsDashboardPage = lazy(() =>
  import('@/pages/reporting/InvestorsDashboardPage').then((m) => ({ default: m.InvestorsDashboardPage }))
);
const ExpensesDashboardPage = lazy(() =>
  import('@/pages/reporting/ExpensesDashboardPage').then((m) => ({ default: m.ExpensesDashboardPage }))
);
const DataImportPage = lazy(() =>
  import('@/pages/management/DataImportPage').then((m) => ({ default: m.DataImportPage }))
);
const PendingRegistrationsPage = lazy(() =>
  import('@/pages/management/PendingRegistrationsPage').then((m) => ({ default: m.PendingRegistrationsPage }))
);
const AllUsersPage = lazy(() =>
  import('@/pages/management/AllUsersPage').then((m) => ({ default: m.AllUsersPage }))
);
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<DashboardSkeleton />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/reporting/bookings" element={<BookingsDashboardPage />} />
              <Route path="/reporting/investors" element={<InvestorsDashboardPage />} />
              <Route path="/reporting/expenses" element={<ExpensesDashboardPage />} />
              <Route
                path="/assistant"
                element={
                  <RequireRole allow={canUseAi} reason="You don't have access to the AI assistant.">
                    <AssistantPage />
                  </RequireRole>
                }
              />
              <Route
                path="/management/pending"
                element={
                  <RequireRole allow={isAdminOrOpsManager} reason="You don't have access to registration approvals.">
                    <PendingRegistrationsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/management/users"
                element={
                  <RequireRole allow={isAdminOrOpsManager} reason="You don't have access to user management.">
                    <AllUsersPage />
                  </RequireRole>
                }
              />
              <Route
                path="/management/import"
                element={
                  <RequireRole allow={canUpload} reason="You don't have upload access. Ask an admin to grant it.">
                    <DataImportPage />
                  </RequireRole>
                }
              />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
