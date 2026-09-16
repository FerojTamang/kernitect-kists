import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { traineeNavigation } from './features/trainee/navigation';
import { adminNavigation } from './features/admin/navigation';
import { AppLayout } from './layouts/AppLayout';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route element={<ProtectedRoute role="trainee" />}>
        <Route
          path="/trainee"
          element={
            <AppLayout
              audience="Trainee"
              basePath="/trainee"
              navigation={traineeNavigation}
            />
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          {traineeNavigation.map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={
                <PlaceholderPage
                  title={item.label}
                  description={item.description}
                />
              }
            />
          ))}
        </Route>
      </Route>
      <Route element={<ProtectedRoute role="administrator" />}>
        <Route
          path="/admin"
          element={
            <AppLayout
              audience="Administrator"
              basePath="/admin"
              navigation={adminNavigation}
            />
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          {adminNavigation.map((item) => (
            <Route
              key={item.path}
              path={item.path}
              element={
                <PlaceholderPage
                  title={item.label}
                  description={item.description}
                />
              }
            />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
