/* eslint-disable prettier/prettier */
import React, { useState, useEffect, useCallback } from 'react';
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
  const [selectedBoatId, setSelectedBoatId] = useState('');

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

  const handleBoatSelection = async (e) => {
    e.preventDefault();
    try {
      await window.electron.sqlite.eventDB.associateBoatWithEvent(
        selectedBoatId,
        event.event_id,
      );
      fetchBoatsWithSailors();
      setAllBoats((prevBoats) =>
        prevBoats.filter((boat) => boat.boat_id !== selectedBoatId),
      );
      setSelectedBoatId(''); // Clear the selected boat
    } catch (error) {
      console.error('Error associating boat with event:', error);
    }
  };

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

  // Filter out boats that are already added to the event
  const availableBoats = allBoats.filter(
    (boat) => !boats.some((eventBoat) => eventBoat.boat_id === boat.boat_id),
  );

  return (
    <div>
      <button type="button" onClick={handleBackClick}>
        Back to Landing Page
      </button>
      <h1>{event.event_name}</h1>
      <p>Start Date: {event.start_date}</p>
      <p>End Date: {event.end_date}</p>

      <h2>Add Sailors</h2>
      <SailorForm onAddSailor={handleAddSailor} eventId={event.event_id} />

      <h2>Add Existing Boat to Event</h2>
      <form onSubmit={handleBoatSelection}>
        <select
          value={selectedBoatId}
          onChange={(e) => setSelectedBoatId(e.target.value)}
          required
        >
          <option value="" disabled>
            Select a boat
          </option>
          {availableBoats.map((boat) => (
            <option
              key={`${boat.boat_id}-${boat.boat_country}-${boat.sail_number}-${event.event_id}`}
              value={boat.boat_id}
            >
              {boat.boat_country} {boat.sail_number} - {boat.model} (Sailor: {boat.name}{' '}
              {boat.surname} )
            </option>
          ))}
        </select>
        <button type="submit">Add Boat</button>
      </form>
      <h3>Boats and Sailors</h3>
      <SailorList
        sailors={Array.isArray(boats) ? boats : []}
        onRemoveBoat={handleRemoveBoat}
      />
    </div>
  );
}

export default EventPage;
