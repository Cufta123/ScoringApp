/* eslint-disable no-console */
/* eslint-disable prettier/prettier */
// src/pages/LandingPage/LandingPage.js
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import EventForm from '../../components/EventForm';
import GlobalLeaderboardComponent from '../../components/GlobalLeaderboard';
import ConfirmDeleteDialog from '../../components/ConfirmDeleteDialog'; // new import

function LandingPage() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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

  // Moved deletion logic to be called only after confirmation.
  const handleConfirmDelete = async () => {
    setShowDeleteDialog(false);
    try {
      await window.electron.ipcRenderer.invoke('nukeDatabase');
      alert('Database nuked successfully. The app will now restart.');
      window.location.reload();
    } catch (error) {
      console.error('Error nuking database:', error);
      alert('Failed to nuke database.');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
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
      {/* Fixed top-right red Delete Database button */}
      <button
        type="button"
        onClick={() => setShowDeleteDialog(true)}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          backgroundColor: 'red',
          color: 'white',
          border: 'none',
          padding: '10px 15px',
          cursor: 'pointer',
        }}
      >
        Delete Database
      </button>

      {showDeleteDialog && (
        <ConfirmDeleteDialog
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

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
