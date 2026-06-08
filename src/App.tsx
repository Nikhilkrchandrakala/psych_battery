import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './components/AuthProvider';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import StudentEntry from './pages/StudentEntry';
import AssessmentEngine from './pages/AssessmentEngine';
import SubmissionUpload from './pages/SubmissionUpload';
import AssessorDashboard from './pages/AssessorDashboard';
import SubmissionReview from './pages/SubmissionReview';
import AdminDashboard from './pages/AdminDashboard';
import AssessmentEditor from './pages/AssessmentEditor';
import { AssessmentAdminPreview } from './pages/AssessmentAdminPreview';
import Meetings from './pages/Meetings';

/**
 * Redirects users to their role-appropriate home page on root visit.
 * - Admins    → /admin
 * - Assessors → /assessor
 * - Students  → auto-routed to assessment via StudentEntry
 */
const RoleRedirect: React.FC = () => {
  const { profile } = useAuth();
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile?.role === 'assessor') return <Navigate to="/assessor" replace />;
  return <StudentEntry />;
};

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg text-app-text-main">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-accent"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Legacy /login route — redirect to home (ProtectedRoute handles auth) */}
      <Route path="/login" element={<Navigate to="/" replace />} />

      {/* SSO Auth Sync — token is read by AuthProvider from URL params, then redirects based on role */}
      <Route path="/auth-sync" element={<RoleRedirect />} />

      {/* Routes with Sidebar Layout */}
      <Route element={<Layout />}>
        <Route element={<ProtectedRoute />}>
          {/* Root redirects based on role — students see Dashboard, others redirect */}
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/upload/:id" element={<SubmissionUpload />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['assessor']} />}>
          <Route path="/assessor" element={<AssessorDashboard />} />
          <Route path="/meetings" element={<Meetings />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['assessor', 'admin']} />}>
          <Route path="/review/:id" element={<SubmissionReview />} />
        </Route>

        <Route element={<ProtectedRoute requireAdmin />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Route>

      {/* Fullscreen Routes (No Sidebar) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/assessment/:id" element={<AssessmentEngine />} />
        <Route path="/presentation/:id" element={<div className="h-screen w-screen"><AssessmentAdminPreview /></div>} />
      </Route>

      <Route element={<ProtectedRoute requireAdmin />}>
        <Route path="/admin/assessment/:id" element={<AssessmentEditor />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
