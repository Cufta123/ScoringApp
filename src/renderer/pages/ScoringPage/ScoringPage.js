import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function ScoringPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { event } = location.state;

  const handleBackClick = () => {
    navigate(`/event/${event.event_name}`, { state: { event } });
  };
  return (
    <div>
      <div>ScoringPage</div>
      <button type="button" onClick={handleBackClick}>
        Back to Landing Page
      </button>
    </div>
  );
}

export default ScoringPage;
