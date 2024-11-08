import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import './HeatRacePage.css';

function HeatRacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { event } = location.state;
  const [heats, setHeats] = useState([]);
  const [races, setRaces] = useState([]);
  const [scores, setScores] = useState([]);
  const [sailors, setSailors] = useState([]);
  const [boats, setBoats] = useState([]);
  const [selectedHeat, setSelectedHeat] = useState(null);
  const [selectedRace, setSelectedRace] = useState(null);

  const fetchSailorsAndBoats = useCallback(async () => {
    try {
      const fetchedSailors = await window.electron.sqlite.sailorDB.readAllSailors(event.event_id);
      const fetchedBoats =await window.electron.sqlite.eventDB.readBoatsByEvent(event.event_id);
      setSailors(Array.isArray(fetchedSailors) ? fetchedSailors : []);
      setBoats(Array.isArray(fetchedBoats) ? fetchedBoats : []);
    } catch (error) {
      console.error('Error fetching sailors and boats:', error);
      setSailors([]);
      setBoats([]);
    }
  }, [event.event_id]);

  const generateInitialHeats = (boats) => {
    const sortedBoats = [...boats].sort((a, b) => a.sail_number - b.sail_number);
    const heats = [];
    const numHeats = Math.ceil(boats.length / 10); // Example: 10 boats per heat

    for (let i = 0; i < numHeats; i++) {
      heats.push([]);
    }

    sortedBoats.forEach((boat, index) => {
      const heatIndex = index % numHeats;
      heats[heatIndex].push(boat);
    });

    return heats;
  };

  const assignBoatsToHeats = (previousResults) => {
    const heats = [];
    const numHeats = Math.ceil(previousResults.length / 10); // Example: 10 boats per heat

    for (let i = 0; i < numHeats; i++) {
      heats.push([]);
    }

    previousResults.forEach((result, index) => {
      const heatIndex = index % numHeats;
      heats[heatIndex].push(result.boat);
    });

    return heats;
  };

  const handleFinalSeriesTransition = (qualifyingResults) => {
    const sortedResults = [...qualifyingResults].sort((a, b) => a.rank - b.rank);
    const heats = [];
    const numHeats = Math.ceil(sortedResults.length / 10); // Example: 10 boats per heat

    for (let i = 0; i < numHeats; i++) {
      heats.push([]);
    }

    sortedResults.forEach((result, index) => {
      const heatIndex = index % numHeats;
      heats[heatIndex].push(result.boat);
    });

    return heats;
  };

  useEffect(() => {
    fetchSailorsAndBoats();
  }, [fetchSailorsAndBoats]);

  useEffect(() => {
    if (boats.length > 0) {
      const initialHeats = generateInitialHeats(boats);
      setHeats(initialHeats);
    }
  }, [boats]);

  const fetchHeats = useCallback(async () => {
    try {
      const fetchedHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);
      setHeats(Array.isArray(fetchedHeats) ? fetchedHeats : []);
    } catch (error) {
      console.error('Error fetching heats:', error);
      setHeats([]);
    }
  }, [event.event_id]);

  const fetchRaces = useCallback(async (heat_id) => {
    try {
      const fetchedRaces = await window.electron.sqlite.heatRaceDB.readAllRaces(heat_id);
      setRaces(Array.isArray(fetchedRaces) ? fetchedRaces : []);
    } catch (error) {
      console.error('Error fetching races:', error);
      setRaces([]);
    }
  }, []);

  const fetchScores = useCallback(async (race_id) => {
    try {
      const fetchedScores = await window.electron.sqlite.heatRaceDB.readAllScores(race_id);
      setScores(Array.isArray(fetchedScores) ? fetchedScores : []);
    } catch (error) {
      console.error('Error fetching scores:', error);
      setScores([]);
    }
  }, []);

  useEffect(() => {
    fetchHeats();
  }, [fetchHeats]);

  const handleAddHeat = async (heat_name, heat_type) => {
    try {
      await window.electron.sqlite.heatRaceDB.insertHeat(event.event_id, heat_name, heat_type);
      fetchHeats();
    } catch (error) {
      console.error('Error adding heat:', error);
    }
  };

  const handleAddRace = async (heat_id, race_number) => {
    try {
      await window.electron.sqlite.heatRaceDB.insertRace(heat_id, race_number);
      fetchRaces(heat_id);
    } catch (error) {
      console.error('Error adding race:', error);
    }
  };

  const handleAddScore = async (race_id, boat_id, position, points, status) => {
    try {
      await window.electron.sqlite.heatRaceDB.insertScore(race_id, boat_id, position, points, status);
      fetchScores(race_id);
    } catch (error) {
      console.error('Error adding score:', error);
    }
  };

  const handleHeatChange = (selectedOption) => {
    setSelectedHeat(selectedOption);
    fetchRaces(selectedOption.value);
  };

  const handleRaceChange = (selectedOption) => {
    setSelectedRace(selectedOption);
    fetchScores(selectedOption.value);
  };

  const heatOptions = heats.map((heat) => ({
    value: heat.heat_id,
    label: `${heat.heat_name} (${heat.heat_type})`,
  }));

  const raceOptions = races.map((race) => ({
    value: race.race_id,
    label: `Race ${race.race_number}`,
  }));

  return (
    <div>
      <div className="button-container">
        <button type="button" onClick={() => navigate(-1)}>
          Back to Event Page
        </button>
      </div>

      <h1>{event.event_name} - Heat and Race Management</h1>
      <p>Start Date: {event.start_date}</p>
      <p>End Date: {event.end_date}</p>

      <h2>Add Heat</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const heat_name = e.target.heat_name.value;
          const heat_type = e.target.heat_type.value;
          handleAddHeat(heat_name, heat_type);
        }}
      >
        <input type="text" name="heat_name" placeholder="Heat Name" required />
        <select name="heat_type" required>
          <option value="Qualifying">Qualifying</option>
          <option value="Final">Final</option>
        </select>
        <button type="submit">Add Heat</button>
      </form>

      <h2>Select Heat</h2>
      <Select
        value={selectedHeat}
        onChange={handleHeatChange}
        options={heatOptions}
      />

      {selectedHeat && (
        <>
          <h2>Add Race</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const race_number = e.target.race_number.value;
              handleAddRace(selectedHeat.value, race_number);
            }}
          >
            <input type="number" name="race_number" placeholder="Race Number" required />
            <button type="submit">Add Race</button>
          </form>

          <h2>Select Race</h2>
          <Select
            value={selectedRace}
            onChange={handleRaceChange}
            options={raceOptions}
          />

          {selectedRace && (
            <>
              <h2>Add Score</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const boat_id = e.target.boat_id.value;
                  const position = e.target.position.value;
                  const points = e.target.points.value;
                  const status = e.target.status.value;
                  handleAddScore(selectedRace.value, boat_id, position, points, status);
                }}
              >
                <input type="text" name="boat_id" placeholder="Boat ID" required />
                <input type="number" name="position" placeholder="Position" required />
                <input type="number" name="points" placeholder="Points" required />
                <select name="status" required>
                  <option value="Finished">Finished</option>
                  <option value="DNF">DNF</option>
                  <option value="RET">RET</option>
                  <option value="NSC">NSC</option>
                  <option value="OCS">OCS</option>
                  <option value="DNS">DNS</option>
                  <option value="DNC">DNC</option>
                  <option value="WTH">WTH</option>
                  <option value="UFD">UFD</option>
                  <option value="BFD">BFD</option>
                  <option value="DSQ">DSQ</option>
                  <option value="DNE">DNE</option>
                </select>
                <button type="submit">Add Score</button>
              </form>

              <h3>Scores</h3>
              <ul>
                {scores.map((score) => (
                  <li key={score.score_id}>
                    Boat ID: {score.boat_id}, Position: {score.position}, Points: {score.points}, Status: {score.status}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default HeatRacePage;
