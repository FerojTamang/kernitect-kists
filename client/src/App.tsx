import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { traineeNavigation } from './features/trainee/navigation';
import { adminNavigation } from './features/admin/navigation';
import { AppLayout } from './layouts/AppLayout';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { TraineeDashboard } from './features/trainee/TraineeDashboard';
import { TraineeTrainingModule } from './features/training/TraineeTrainingModule';
import { TraineeTraining } from './features/trainee/TraineeTraining';
import { TraineeScenario } from './features/scenarios/TraineeScenario';
import { TraineeScenarios } from './features/trainee/TraineeScenarios';

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
          <Route path="dashboard" element={<TraineeDashboard />} />
          <Route path="training" element={<TraineeTraining />} />
          <Route path="scenarios" element={<TraineeScenarios />} />
          <Route
            path="training/:assignmentId"
            element={<TraineeTrainingModule />}
          />
          <Route
            path="training/:assignmentId/scenario"
            element={<TraineeScenario />}
          />
          {traineeNavigation.map(
            (item) =>
              item.path !== 'dashboard' &&
              item.path !== 'training' &&
              item.path !== 'scenarios' && (
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
              ),
          )}
          <Route
            path="assessments"
            element={
              <PlaceholderPage
                title="Assessments"
                description="Final graded assessments will become available after the required learning and scenario stages are complete."
              />
            }
          />
          <Route
            path="resources"
            element={
              <PlaceholderPage
                title="Resources"
                description="Additional workplace safety resources will be added as the KISTS prototype develops."
              />
            }
          />
          <Route
            path="settings"
            element={
              <PlaceholderPage
                title="Settings"
                description="Trainee preferences and account settings are outside the current prototype scope."
              />
            }
          />
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
