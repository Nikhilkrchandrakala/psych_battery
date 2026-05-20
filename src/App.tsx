import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './components/AuthProvider';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import Dashboard from './pages/Dashboard';
import AssessmentEngine from './pages/AssessmentEngine'; 
import SubmissionUpload from './pages/SubmissionUpload';
import AssessorDashboard from './pages/AssessorDashboard';
import SubmissionReview from './pages/SubmissionReview';
import AdminDashboard from './pages/AdminDashboard';
import AssessmentEditor from './pages/AssessmentEditor';

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
      
      {/* Routes with Sidebar Layout */}
      <Route element={<Layout />}>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload/:id" element={<SubmissionUpload />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['assessor', 'admin']} />}>
          <Route path="/assessor" element={<AssessorDashboard />} />
          <Route path="/review/:id" element={<SubmissionReview />} />
        </Route>

        <Route element={<ProtectedRoute requireAdmin />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Route>

      {/* Fullscreen Routes (No Sidebar) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/assessment/:id" element={<AssessmentEngine />} />
      </Route>

      <Route element={<ProtectedRoute requireAdmin />}>
        <Route path="/admin/assessment/:id" element={<AssessmentEditor />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
