import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Assessment, AssessmentSubmission } from '../types';
import { useAuth } from '../components/AuthProvider';

const StudentEntry: React.FC = () => {
  const { user, mainSiteUrl } = useAuth();
  const [loading, setLoading] = useState(true);
  const [targetPath, setTargetPath] = useState<string | null>(null);

  useEffect(() => {
    const determineRoute = async () => {
      if (!user) return;
      try {
        const [assessmentsList, submissionsList] = await Promise.all([
          api.assessments.list(),
          api.submissions.list()
        ]);
        
        const activeAssessments = assessmentsList.filter((a: Assessment) => a.active);
        
        if (activeAssessments.length === 0) {
          // If no active assessments, bounce back to profile
          window.location.href = `${mainSiteUrl}/ProfileDashboard?tab=psycheTest`;
          return;
        }

        // Just take the first active assessment for the candidate
        const primaryAssessment = activeAssessments[0];
        const submission = submissionsList.find((s: AssessmentSubmission) => s.assessmentId === primaryAssessment.id);

        if (!submission) {
          // Candidate hasn't started yet. Go straight to intro screen.
          setTargetPath(`/assessment/${primaryAssessment.id}`);
        } else if (
          submission.status === 'PENDING_UPLOAD' || 
          submission.status === 'COMPLETED' || 
          submission.status === 'UPLOADED' || 
          submission.status === 'REPORT_RELEASED' || 
          submission.status === 'MEETING_SCHEDULED'
        ) {
          // Finished the timed test. The upload now happens on the main site ProfileDashboard.
          window.location.href = `${mainSiteUrl}/ProfileDashboard?tab=psycheTest`;
        } else {
          // IN_PROGRESS or ASSIGNED
          setTargetPath(`/assessment/${primaryAssessment.id}`);
        }

      } catch (error) {
        console.error('Failed to fetch evaluation data:', error);
        window.location.href = `${mainSiteUrl}/ProfileDashboard`;
      } finally {
        setLoading(false);
      }
    };

    determineRoute();
  }, [user, mainSiteUrl]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg text-app-text-main">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-app-accent"></div>
      </div>
    );
  }

  if (targetPath) {
    return <Navigate to={targetPath} replace />;
  }

  return null;
};

export default StudentEntry;
