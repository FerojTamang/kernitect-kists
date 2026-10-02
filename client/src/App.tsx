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
import { TraineeProgress } from './features/trainee/TraineeProgress';
import { TraineeResources } from './features/trainee/TraineeResources';
import { TraineeSettings } from './features/trainee/TraineeSettings';
import { TraineeScenario } from './features/scenarios/TraineeScenario';
import { TraineeScenarios } from './features/trainee/TraineeScenarios';
import { TraineeAssessment } from './features/assessments/TraineeAssessment';
import { TraineeAssessments } from './features/assessments/TraineeAssessments';
import {
  TraineeCertificateDetail,
  TraineeCertificates,
} from './features/certificates/TraineeCertificates';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { AdminUsers } from './features/admin/AdminUsers';
import { AdminAssignments } from './features/admin/AdminAssignments';
import { AdminProgress } from './features/admin/AdminProgress';
import { AdminSettings } from './features/admin/AdminSettings';
import { AdminTrainingContent } from './features/admin/AdminTrainingContent';
import { TraineeHelp } from './features/support/TraineeHelp';
import { TraineeSupport } from './features/support/TraineeSupport';
import { TraineeAiAssistant } from './features/support/TraineeAiAssistant';
import { AdminSupportMessages } from './features/support/AdminSupportMessages';

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
          <Route path="progress" element={<TraineeProgress />} />
          <Route path="resources" element={<TraineeResources />} />
          <Route path="help" element={<TraineeHelp />} />
          <Route path="help/ai-assistant" element={<TraineeAiAssistant />} />
          <Route path="support" element={<TraineeSupport />} />
          <Route path="settings" element={<TraineeSettings />} />
          <Route path="scenarios" element={<TraineeScenarios />} />
          <Route path="certificates" element={<TraineeCertificates />} />
          <Route
            path="certificates/:certificateId"
            element={<TraineeCertificateDetail />}
          />
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
              item.path !== 'progress' &&
              item.path !== 'resources' &&
              item.path !== 'settings' &&
              item.path !== 'certificates' &&
              item.path !== 'assessments' && (
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
          <Route path="assessments" element={<TraineeAssessments />} />
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
          <Route path="support" element={<AdminSupportMessages />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="training" element={<AdminTrainingContent />} />
          <Route path="training/:moduleId" element={<AdminTrainingContent />} />
          {adminNavigation.map(
            (item) =>
              item.path !== 'dashboard' &&
              item.path !== 'users' &&
              item.path !== 'assignments' &&
              item.path !== 'progress' &&
              item.path !== 'support' &&
              item.path !== 'settings' &&
              item.path !== 'training' && (
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
