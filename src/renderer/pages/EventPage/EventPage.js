/* eslint-disable no-console */
/* eslint-disable no-alert */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Select from 'react-select';
import { useLocation, useNavigate } from 'react-router-dom';
import SailorForm from '../../components/SailorForm';
import SailorList from '../../components/SailorList';
import Navbar from '../../components/Navbar';
import './EventPage.css';

import CSVUpload from '../../components/CSVUpload';
import printStartingList from '../../../main/functions/printStartingList';

function EventPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { event } = location.state || {};

  // Redirect if event data is missing
  useEffect(() => {
    if (!event) {
      navigate('/');
    }
  }, [event, navigate]);

  // Component state
  const [boats, setBoats] = useState([]);
  const [allBoats, setAllBoats] = useState([]);
  const [selectedBoats, setSelectedBoats] = useState([]);
  const [isSailorFormVisible, setIsSailorFormVisible] = useState(false);
  const [raceHappened, setRaceHappened] = useState(false);
  const [isEventLocked, setIsEventLocked] = useState(event?.is_locked === 1);
  const [exportFormat, setExportFormat] = useState('excel');

  // Fetch functions
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(
        `An error occurred while fetching boat and sailor data. Details: ${
          errorMessage
        }`,
      );
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

  const checkIfRaceHappened = useCallback(async () => {
    try {
      const heats = await window.electron.sqlite.heatRaceDB.readAllHeats(
        event.event_id,
      );
      const racePromises = heats.map((heat) =>
        window.electron.sqlite.heatRaceDB.readAllRaces(heat.heat_id),
      );
      const races = await Promise.all(racePromises);
      const anyRaceHappened = races.some((raceArray) => raceArray.length > 0);
      setRaceHappened(anyRaceHappened);
    } catch (error) {
      console.error('Error checking if race happened:', error);
    }
  }, [event.event_id]);

  const fetchEventLockStatus = useCallback(async () => {
    try {
      const events = await window.electron.sqlite.eventDB.readAllEvents();
      const currentEvent = events.find((e) => e.event_id === event.event_id);
      setIsEventLocked(currentEvent.is_locked === 1);
    } catch (error) {
      console.error('Error fetching event lock status:', error);
    }
  }, [event.event_id]);

  // Combined effect to fetch initial data
  useEffect(() => {
    if (event) {
      fetchBoatsWithSailors();
      fetchAllBoats();
      checkIfRaceHappened();
      fetchEventLockStatus();
    }
  }, [
    event,
    fetchBoatsWithSailors,
    fetchAllBoats,
    checkIfRaceHappened,
    fetchEventLockStatus,
  ]);

  // Keep allBoats updated when boats change
  useEffect(() => {
    setAllBoats((prevBoats) =>
      prevBoats.filter(
        (boat) =>
          !boats.some((eventBoat) => eventBoat.boat_id === boat.boat_id),
      ),
    );
  }, [boats]);

  // Derived values
  const availableBoats = useMemo(
    () =>
      allBoats.filter(
        (boat) =>
          !boats.some((eventBoat) => eventBoat.boat_id === boat.boat_id),
      ),
    [allBoats, boats],
  );

  const boatOptions = useMemo(
    () =>
      availableBoats.map((boat) => ({
        value: boat.boat_id,
        label: `${boat.boat_country} ${boat.sail_number} - ${boat.model} (Sailor: ${boat.name} ${boat.surname})`,
      })),
    [availableBoats],
  );

  // Handlers
  const handleAddSailor = () => {
    fetchBoatsWithSailors();
  };

  const handleHeatRaceClick = () => {
    navigate(`/event/${event.event_name}/heat-race`, { state: { event } });
  };

  const toggleSailorFormVisibility = () => {
    if (raceHappened) {
      alert(
        'Registration error: A race has already been conducted, so new sailors cannot be added.',
      );
      return;
    }
    setIsSailorFormVisible(!isSailorFormVisible);
  };

  const handleBoatSelection = async (e) => {
    e.preventDefault();

    if (raceHappened) {
      alert(
        'Registration error: A race has already occurred, so you cannot add new boats.',
      );
      return;
    }

    try {
      const boatIds = selectedBoats.map((option) => option.value);
      await Promise.all(
        boatIds.map((boatId) =>
          window.electron.sqlite.eventDB.associateBoatWithEvent(
            boatId,
            event.event_id,
          ),
        ),
      );
      fetchBoatsWithSailors();
      setAllBoats((prevBoats) =>
        prevBoats.filter((boat) => !boatIds.includes(boat.boat_id)),
      );
      setSelectedBoats([]); // Clear the selected boats
    } catch (error) {
      console.error('Error associating boats with event:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(
        `An error occurred while associating boats with the event. Details: ${
          errorMessage
        }`,
      );
    }
  };

  const handleBoatChange = (selectedOptions) => {
    setSelectedBoats(selectedOptions);
  };

  const handleOpenLeaderboard = () => {
    navigate('/leaderboard', { state: { eventId: event.event_id } });
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

  const handleLockEvent = async () => {
    try {
      if (isEventLocked) {
        await window.electron.sqlite.eventDB.unlockEvent(event.event_id);
        setIsEventLocked(false);
        alert(
          'Success: The event has been unlocked. Registrations are now enabled.',
        );
      } else {
        await window.electron.sqlite.eventDB.lockEvent(event.event_id);
        setIsEventLocked(true);
        alert(
          'Success: The event has been locked. No further registrations are allowed.',
        );
      }
    } catch (error) {
      console.error('Error locking/unlocking event:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(
        `An error occurred while updating the event lock status. Details: ${
          errorMessage
        }`,
      );
    }
  };

  const handleLockEventClick = () => {
    const userConfirmed = window.confirm(
      'Warning: Locking the event will prevent any further registrations. Do you wish to continue?',
    );
    if (userConfirmed) {
      handleLockEvent();
    }
  };

  if (!event) {
    return null; // Render nothing if event is not available
  }

  const handlePrintStartingList = async () => {
    try {
      await printStartingList(event, boats, exportFormat);
    } catch (error) {
      console.error('Error printing starting list:', error);
    }
  };

  return (
    <div>
      <Navbar
        onOpenLeaderboard={handleOpenLeaderboard}
        isEventLocked={isEventLocked}
        onHeatRaceClick={handleHeatRaceClick}
      />
      <h1>{event.event_name}</h1>
      <p>Start Date: {event.start_date}</p>
      <p>End Date: {event.end_date}</p>
      {raceHappened || isEventLocked ? (
        <div className="warning">
          <p>
            Registrations Disabled: A race has occurred or the event is
            currently locked.
          </p>
        </div>
      ) : (
        <>
          <h2>Register New Sailors</h2>
          <button type="button" onClick={toggleSailorFormVisibility}>
            {isSailorFormVisible
              ? 'Close Registration Form'
              : 'Open Registration Form'}
          </button>
          {isSailorFormVisible && (
            <SailorForm
              onAddSailor={handleAddSailor}
              eventId={event.event_id}
            />
          )}
          <h2>Associate Existing Boat With Event</h2>
          <form onSubmit={handleBoatSelection}>
            <Select
              isMulti
              value={selectedBoats}
              onChange={handleBoatChange}
              options={boatOptions}
              closeMenuOnSelect={false}
            />
            <button type="submit">Add Boat(s) to Event</button>
          </form>
        </>
      )}
      <CSVUpload
        eventId={event.event_id}
        onImportComplete={fetchBoatsWithSailors}
      />
      <select
        id="exportFormat"
        value={exportFormat}
        onChange={(e) => setExportFormat(e.target.value)}
        style={{ maxWidth: '80px' }}
      >
        <option value="excel">Excel</option>
        <option value="pdf">PDF</option>
        <option value="html">HTML</option>
      </select>
      <button type="button" onClick={handlePrintStartingList}>
        Generate Competitor List Printout
      </button>

      <h3>Participating Boats &amp; Sailors</h3>
      <SailorList
        sailors={Array.isArray(boats) ? boats : []}
        onRemoveBoat={handleRemoveBoat}
        onRefreshSailors={fetchBoatsWithSailors}
        raceHappened={raceHappened} // Pass raceHappened state to SailorList
      />
      <button
        type="button"
        onClick={handleLockEventClick}
        style={{ backgroundColor: 'red', color: 'white' }}
      >
        {isEventLocked ? 'Unlock Event' : 'Lock Event'}
      </button>
    </div>
  );
}

export default EventPage;
