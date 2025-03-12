import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

const LeaderboardComponent = lazy(() => import('../../components/Leaderboard'));

function LeaderboardPage() {
  const location = useLocation();
  const { eventId } = location.state || {};

  return (
    <div>
      <button type="button" onClick={() => window.history.back()}>
        Back
      </button>
      <Suspense fallback={<div>Loading Leaderboard...</div>}>
        <LeaderboardComponent eventId={eventId} />
      </Suspense>
    </div>
  );
}

export default LeaderboardPage;
