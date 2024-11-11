/* eslint-disable prettier/prettier */
import React, { useState, useEffect, useCallback } from 'react';
import Select from 'react-select';
import { useLocation, useNavigate } from 'react-router-dom';
import SailorForm from '../../components/SailorForm';
import SailorList from '../../components/SailorList';
import './EventPage.css';

function EventPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { event } = location.state;
  const [boats, setBoats] = useState([]);
  const [allBoats, setAllBoats] = useState([]);
  const [selectedBoats, setSelectedBoats] = useState([]);
  const [isSailorFormVisible, setIsSailorFormVisible] = useState(false);
  const [heats, setHeats] = useState([]);

  const fetchBoatsWithSailors = useCallback(async () => {
    try {
      const boatsWithSailors =
        await window.electron.sqlite.eventDB.readBoatsByEvent(event.event_id);
      console.log('Fetched boats with sailors:', boatsWithSailors);
      const mappedBoats = boatsWithSailors.map((boat) => ({
        ...boat,
        sailor: boat.name,
        club: boat.club_name, // Map club_name to club
        country: boat.boat_country, // Map country_name to country
        category: boat.category_name, // Map category_name to category
      }));
      setBoats(mappedBoats);
    } catch (error) {
      alert('Error fetching boats with sailors. Please try again later.');
    }
  }, [event.event_id]);

  const fetchAllBoats = useCallback(async () => {
    try {
      const fetchedBoats = await window.electron.sqlite.sailorDB.readAllBoats();
      setAllBoats(fetchedBoats);
    } catch (error) {
      console.error('Error fetching all boats:', error);
    }
  }, []);

  useEffect(() => {
    fetchBoatsWithSailors();
    fetchAllBoats();
  }, [fetchBoatsWithSailors, fetchAllBoats]);

  const handleAddSailor = () => {
    fetchBoatsWithSailors();
  };

  const handleBackClick = () => {
    navigate('/');
  };
  const handleHeatRaceClick = () => {
    navigate(`/event/${event.event_name}/heat-race`, { state: { event } });
  };
  const toggleSailorFormVisibility = () => {
    setIsSailorFormVisible(!isSailorFormVisible);
  };
 const handleBoatSelection = async (e) => {
    e.preventDefault();
    try {
      const boatIds = selectedBoats.map(option => option.value);
      await Promise.all(boatIds.map(boatId =>
        window.electron.sqlite.eventDB.associateBoatWithEvent(boatId, event.event_id)
      ));
      fetchBoatsWithSailors();
      setAllBoats((prevBoats) =>
        prevBoats.filter((boat) => !boatIds.includes(boat.boat_id)),
      );
      setSelectedBoats([]); // Clear the selected boats
    } catch (error) {
      console.error('Error associating boats with event:', error);
    }
  };
  const handleBoatChange = (selectedOptions) => {
    setSelectedBoats(selectedOptions);
  };

  // Filter out boats that are already added to the event
  const availableBoats = allBoats.filter(
    (boat) => !boats.some((eventBoat) => eventBoat.boat_id === boat.boat_id),
  );

  const boatOptions = availableBoats.map((boat) => ({
    value: boat.boat_id,
    label: `${boat.boat_country} ${boat.sail_number} - ${boat.model} (Sailor: ${boat.name} ${boat.surname})`
  }));

  const handleRemoveBoat = async (boatId) => {
    try {
      await window.electron.sqlite.eventDB.removeBoatFromEvent(
        boatId,
        event.event_id,
      );

      // Find the removed boat
      const removedBoat = boats.find((boat) => boat.boat_id === boatId);

      // Remove the boat from the boats state first
      setBoats((prevBoats) =>
        prevBoats.filter((boat) => boat.boat_id !== boatId),
      );

      // Then add the removed boat to the allBoats state
      if (removedBoat) {
        setAllBoats((prevBoats) => [...prevBoats, removedBoat]);
      }
    } catch (error) {
      console.error('Error removing boat from event:', error);
    }
  };
  const handleCreateHeats = async () => {
    try {
      // Fetch all boats for the event
      const eventBoats = await window.electron.sqlite.eventDB.readBoatsByEvent(event.event_id);

      // Sort boats by sail number (or any other criteria if needed)
      eventBoats.sort((a, b) => a.sail_number - b.sail_number);

      // Determine the number of heats
      const numHeats = Math.ceil(eventBoats.length / 10); // Example: 10 boats per heat

      // Create heats
      const heatPromises = [];
      for (let i = 0; i < numHeats; i += 1) {
        const heatName = `Heat ${String.fromCharCode(65 + i)}`; // A, B, C, ...
        const heatType = 'Qualifying';
        heatPromises.push(window.electron.sqlite.heatRaceDB.insertHeat(event.event_id, heatName, heatType));
      }
      await Promise.all(heatPromises);

      // Fetch the created heats
      const FetchedHeats = await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);

      // Assign boats to heats
      const racePromises = [];
      for (let i = 0; i < eventBoats.length; i += 1) {
        const heatIndex = i % numHeats;
        const heat = FetchedHeats[heatIndex];
        racePromises.push(window.electron.sqlite.heatRaceDB.insertRace(heat.heat_id, i + 1));
      }
      await Promise.all(racePromises);

      alert('Heats created successfully!');
    } catch (error) {
      console.error('Error creating heats:', error);
      alert('Error creating heats. Please try again later.');
    }
  };
  const handleDisplayHeats = async () => {
    try {
      // Fetch all heats for the event
      const heatsToDisplay = await window.electron.sqlite.heatRaceDB.readAllHeats(event.event_id);

      // Fetch all boats for the event
      const boatsToDisplay = await window.electron.sqlite.eventDB.readBoatsByEvent(event.event_id);

      // Fetch all races for each heat and map boats to heats
      const heatDetailsPromises = heatsToDisplay.map(async (heat) => {
        const races = await window.electron.sqlite.heatRaceDB.readAllRaces(heat.heat_id);
        const boatsInHeat = races.map((race) => {
          const boat = boatsToDisplay.find((b) => b.boat_id === race.boat_id);
          return {
            ...boat,
            race_number: race.race_number,
          };
        });
        return {
          ...heat,
          boats: boatsInHeat,
        };
      });

      const heatDetails = await Promise.all(heatDetailsPromises);

      // Display the heats and sailors
      console.log('Heats and Sailors:', heatDetails);
      setHeats(heatDetails);
    } catch (error) {
      console.error('Error displaying heats and sailors:', error);
      alert('Error displaying heats and sailors. Please try again later.');
    }
  };

  useEffect(() => {
    // Ensure that the allBoats state is updated when boats state changes
    setAllBoats((prevBoats) => {
      const updatedBoats = prevBoats.filter(
        (boat) =>
          !boats.some((eventBoat) => eventBoat.boat_id === boat.boat_id),
      );
      return updatedBoats;
    });
  }, [boats]);



  return (
    <div>
      <div className="button-container">
        <button type="button" onClick={handleBackClick}>
          Back to Landing Page
        </button>
        <button type="button" onClick={handleHeatRaceClick} className="heat-race-button">
          Manage Heats and Races
        </button>
        <button type="button" onClick={handleCreateHeats}>
          Create Heats
        </button>
      </div>

      <h1>{event.event_name}</h1>
      <p>Start Date: {event.start_date}</p>
      <p>End Date: {event.end_date}</p>

      <h2>Add Sailors</h2>
      <button type="button" onClick={toggleSailorFormVisibility}>
        {isSailorFormVisible ? 'Hide Sailor Form' : 'Show Sailor Form'}
      </button>
      {isSailorFormVisible && (
        <SailorForm onAddSailor={handleAddSailor} eventId={event.event_id} />
      )}
      <button type="button" onClick={handleDisplayHeats}>
  Display Heats and Sailors
</button>
      <h2>Add Existing Boat to Event</h2>
      <form onSubmit={handleBoatSelection}>
        <Select
          isMulti
          value={selectedBoats}
          onChange={handleBoatChange}
          options={boatOptions}
          closeMenuOnSelect={false}
        />
        <button type="submit">Add Boats</button>
      </form>
      <h3>Boats and Sailors</h3>
      <SailorList
        sailors={Array.isArray(boats) ? boats : []}
        onRemoveBoat={handleRemoveBoat}
        onRefreshSailors={fetchBoatsWithSailors}
      />
    <h3>Heats and Sailors</h3>
    {heats.map((heat) => (
      <div key={heat.heat_id}>
        <h4>{heat.heat_name} ({heat.heat_type})</h4>
        <ul>
          {heat.boats.map((boat) => (
            <li key={boat.boat_id}>
              {boat.sail_number} - {boat.name} {boat.surname} (Race {boat.race_number})
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);
}
export default EventPage;
