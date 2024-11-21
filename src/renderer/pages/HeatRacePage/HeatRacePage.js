import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HeatComponent from '../../components/HeatComponent';
import ScoringInputComponent from '../../components/ScoringInputComponent';
import './HeatRacePage.css';

function HeatRacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { event } = location.state;
  const [eventData, setEventData] = useState(event || null);
  const [selectedHeat, setSelectedHeat] = useState(null);
  const [isScoring, setIsScoring] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const eventData = await window.electron.sqlite.eventDB.readEventById(event.event_id);
        setEventData(eventData);
      } catch (error) {
        console.error('Error fetching event:', error);
      }
    };

    if (!eventData && event) {
      fetchEvent();
    }
  }, [eventData, event]);

  const handleHeatSelect = (heat) => {
    setSelectedHeat(heat);
  };

  const handleStartScoring = () => {
    setIsScoring(true);
  };

  const handleBackToHeats = () => {
    setIsScoring(false);
  };

  if (!event) {
    return <p>No event data available.</p>;
  }

  return (
    <div>
      <button onClick={isScoring ? handleBackToHeats : () => navigate(-1)}>
        {isScoring ? 'Back to Heats' : 'Back'}
      </button>
      {!isScoring ? (
        <>
          <HeatComponent event={event} onHeatSelect={handleHeatSelect} clickable={true} />
          {selectedHeat && (
            <button onClick={handleStartScoring}>Start Scoring</button>
          )}
        </>
      ) : (
        <ScoringInputComponent heat={selectedHeat} onBack={handleBackToHeats} />
      )}
    </div>
  );
}

export default HeatRacePage;
