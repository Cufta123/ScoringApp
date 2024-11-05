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
  const handleNextClick = () => {
    navigate(`/event/${event.event_name}/scoring`, { state: { event } });
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
      <button type="button" onClick={handleNextClick} className="next-button">
        Continue to scoring
      </button>
    </div>

      <h1>{event.event_name}</h1>
      <p>Start Date: {event.start_date}</p>
      <p>End Date: {event.end_date}</p>

      <h2>Add Sailors</h2>
      <SailorForm onAddSailor={handleAddSailor} eventId={event.event_id} />

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
    </div>
  );
}

export default EventPage;
