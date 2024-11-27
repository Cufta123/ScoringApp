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

    // Fetch the current races for the selected heat
    const races = await window.electron.sqlite.heatRaceDB.readAllRaces(
      selectedHeat.heat_id,
    );
    const nextRaceNumber = races.length + 1;

    // Insert a new race for the selected heat
    const { lastInsertRowid: raceId } =
      await window.electron.sqlite.heatRaceDB.insertRace(
        selectedHeat.heat_id,
        nextRaceNumber,
      );

    // Insert scores for the new race
    const scorePromises = placeNumbers.map(
      async ({ boatNumber, place, status }) => {
        const boats = await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
          selectedHeat.heat_id,
        );
        const boatDetails = boats.find(
          (boat) => boat.sail_number === boatNumber,
        );
        if (boatDetails) {
          await window.electron.sqlite.heatRaceDB.insertScore(
            raceId,
            boatDetails.boat_id,
            place,
            place,
            status, // Pass the correct status
          );
        }
      },
    );

    await Promise.all(scorePromises);

    console.log(
      `Scores for race ${nextRaceNumber} in heat ${selectedHeat.heat_name} have been submitted.`,
    );
    setIsScoring(false);

    // Update the selected heat with the new race number
    setSelectedHeat({ ...selectedHeat, raceNumber: nextRaceNumber });
  };

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
