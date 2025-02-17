import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

function Navbar({ onOpenLeaderboard, isEventLocked, onHeatRaceClick }) {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate('/');
  };

  return (
    <div
      className="navbar"
      style={{ display: 'flex', justifyContent: 'flex-start' }}
    >
      <button
        type="button"
        onClick={handleBackClick}
        style={{ margin: '10px' }}
      >
        Back to Landing Page
      </button>
      <button
        type="button"
        onClick={onOpenLeaderboard}
        style={{ margin: '10px' }}
      >
        Open Leaderboard
      </button>
      {!isEventLocked && (
        <button
          type="button"
          onClick={onHeatRaceClick}
          style={{ margin: '10px' }}
        >
          Go to Scoring
        </button>
      )}
    </div>
  );
}
Navbar.propTypes = {
  onOpenLeaderboard: PropTypes.func.isRequired,
  isEventLocked: PropTypes.bool.isRequired,
  onHeatRaceClick: PropTypes.func.isRequired,
};

export default Navbar;
