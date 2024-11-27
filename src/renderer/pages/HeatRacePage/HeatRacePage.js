/* eslint-disable camelcase */
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
        const fetchedEventData =
          await window.electron.sqlite.eventDB.readEventById(event.event_id);
        setEventData(fetchedEventData);
      } catch (error) {
        // Handle the error appropriately
        console.error(`Error fetching event: ${error.message}`);
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

  const handleSubmitScores = async (placeNumbers) => {
    console.log('Submitted place numbers:', placeNumbers);
    const boatDetailsPromises = placeNumbers.map(
      async ({ boatNumber, place }) => {
        const boats = await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
          selectedHeat.heat_id,
        );
        const boatDetails = boats.find(
          (boat) => boat.sail_number === boatNumber,
        );
        return { ...boatDetails, place };
      },
    );

    const boatDetails = await Promise.all(boatDetailsPromises);
    boatDetails.forEach(
      ({ boat_id, sail_number, country, model, name, surname, place }) => {
        console.log(
          `Boat ID: ${boat_id}, Sail Number: ${sail_number}, Country: ${country}, Model: ${model}, Skipper: ${name} ${surname}, Place: ${place}`,
        );
      },
    );
  };

  if (!event) {
    return <p>No event data available.</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={isScoring ? handleBackToHeats : () => navigate(-1)}
      >
        {isScoring ? 'Back to Heats' : 'Back'}
      </button>
      {!isScoring ? (
        <>
          <HeatComponent
            event={event}
            onHeatSelect={handleHeatSelect}
            clickable
          />
          {selectedHeat && (
            <button type="button" onClick={handleStartScoring}>
              Start Scoring
            </button>
          )}
        </>
      ) : (
        <ScoringInputComponent
          heat={selectedHeat}
          onSubmit={handleSubmitScores}
          onBack={handleBackToHeats}
        />
      )}
    </div>
  );
}

export default HeatRacePage;
