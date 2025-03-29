/* eslint-disable no-console */
/* eslint-disable prettier/prettier */
// src/pages/LandingPage/LandingPage.js
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EventForm from '../../components/EventForm';
import GlobalLeaderboardComponent from '../../components/GlobalLeaderboard';

function LandingPage() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const navigate = useNavigate();
  console.log('LandingPage component rendered');

  const handleOpenLeaderboard = useCallback(() => {
    setShowLeaderboard(true);
  }, []);
  const handleCloseLeaderboard = useCallback(() => {
    setShowLeaderboard(false);
  }, []);

  const handleOpenSailorList = () => {
    navigate('landingSailorList');
  };

  if (showLeaderboard) {
    return (
      <div>
        <button type="button" onClick={handleCloseLeaderboard}>
          Back
        </button>
        <GlobalLeaderboardComponent />
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={handleOpenLeaderboard}>
        Open Leaderboard
      </button>
      <button type="button" onClick={handleOpenSailorList}>
        Open Sailor List
      </button>
      <h1>Create a New Event</h1>
      <EventForm />
    </div>
  );
}

export default LandingPage;
