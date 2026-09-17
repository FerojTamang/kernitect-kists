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
import { TraineeAssessment } from './features/assessments/TraineeAssessment';
import { TraineeCertificates } from './features/certificates/TraineeCertificates';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { AdminUsers } from './features/admin/AdminUsers';
import { AdminAssignments } from './features/admin/AdminAssignments';
import { AdminProgress } from './features/admin/AdminProgress';

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
          <Route path="certificates" element={<TraineeCertificates />} />
          <Route
            path="training/:assignmentId"
            element={<TraineeTrainingModule />}
          />
          <Route
            path="training/:assignmentId/scenario"
            element={<TraineeScenario />}
          />
          <Route
            path="training/:assignmentId/assessment"
            element={<TraineeAssessment />}
          />
          {traineeNavigation.map(
            (item) =>
              item.path !== 'dashboard' &&
              item.path !== 'training' &&
              item.path !== 'scenarios' &&
              item.path !== 'certificates' && (
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
                description="Open an assigned training module and complete its required learning and scenario stages to access the final assessment."
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
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="assignments" element={<AdminAssignments />} />
          <Route path="progress" element={<AdminProgress />} />
          {adminNavigation.map(
            (item) =>
              item.path !== 'dashboard' &&
              item.path !== 'users' &&
              item.path !== 'assignments' &&
              item.path !== 'progress' && (
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
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
