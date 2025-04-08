/* eslint-disable no-console */
/* eslint-disable no-displayAlert */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Select from 'react-select';
import { useLocation, useNavigate } from 'react-router-dom';
import SailorForm from '../../components/SailorForm';
import SailorList from '../../components/SailorList';
import Navbar from '../../components/Navbar';
import ConfirmDialog from '../../components/ConfirmDialog'; // new import
import './EventPage.css';

import CSVUpload from '../../components/CSVUpload';
import printStartingList from '../../../main/functions/printStartingList';
// Add alert state and helper at the top (after your imports)

// Update the helper to accept a minimum candidate value
const findNextFreeNumber = (numbers, minCandidate = 1) => {
  if (numbers.length === 0) return minCandidate;
  const numSet = new Set(numbers);
  const maxNum = Math.max(...numbers, minCandidate);
  for (let candidate = minCandidate; candidate <= maxNum + 1; candidate += 1) {
    if (!numSet.has(candidate)) return candidate;
  }
  return maxNum + 1;
};

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
  const [alertMessage, setAlertMessage] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [lockConfirmVisible, setLockConfirmVisible] = useState(false);

  const displayAlert = (message) => {
    setAlertMessage(message);
    setAlertVisible(true);
  };
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
      displayAlert(
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
    // Map sail numbers to integers (filtering out invalid entries)
    const sailNums = boats
      .map((boat) => parseInt(boat.sail_number.toString().trim(), 10))
      .filter((num) => !Number.isNaN(num));
    const sailNumberCounts = boats.reduce((acc, boat) => {
      const number = boat.sail_number.toString().trim();
      acc[number] = (acc[number] || 0) + 1;
      return acc;
    }, {});
    const duplicates = Object.keys(sailNumberCounts).filter(
      (number) => sailNumberCounts[number] > 1,
    );
    if (duplicates.length > 0) {
      // Determine the digit length from a sample sail number (assumes uniform digit count)
      const digitLength =
        boats.length > 0 ? String(boats[0].sail_number).trim().length : 1;
      const minCandidate = Math.pow(10, digitLength - 1);
      const candidate = findNextFreeNumber(sailNums, minCandidate);
      displayAlert(
        `Error: Duplicate sail numbers detected (${duplicates.join(
          ', ',
        )}). Suggested next free sail number is ${candidate}. Please update the entries so that each boat in the event has a unique sail number.`,
      );
      return;
    }
    navigate(`/event/${event.event_name}/heat-race`, { state: { event } });
  };

  const toggleSailorFormVisibility = () => {
    if (raceHappened) {
      displayAlert(
        'Registration error: A race has already been conducted, so new sailors cannot be added.',
      );
      return;
    }
    setIsSailorFormVisible(!isSailorFormVisible);
  };

  const handleBoatSelection = async (e) => {
    e.preventDefault();

    if (raceHappened) {
      displayAlert(
        'Registration error: A race has already occurred, so you cannot add new boats.',
      );
      return;
    }

    // Check for a duplicate sail number in the event using array iteration
    const allBoatsMap = new Map(allBoats.map((boat) => [boat.boat_id, boat]));
    const duplicateOption = selectedBoats.find((option) => {
      const selectedBoat = allBoatsMap.get(option.value);
      return (
        selectedBoat &&
        boats.some(
          (b) =>
            b.sail_number.toString().trim() ===
            String(selectedBoat.sail_number).trim(),
        )
      );
    });
    if (duplicateOption) {
      const selectedBoat = allBoatsMap.get(duplicateOption.value);
      displayAlert(
        `Boat with sail number ${selectedBoat.sail_number} is already associated with this event.`,
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
      displayAlert(
        `An error occurred while associating boats with the event. Details: ${errorMessage}`,
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
        displayAlert(
          'Success: The event has been unlocked. Registrations are now enabled.',
        );
      } else {
        await window.electron.sqlite.eventDB.lockEvent(event.event_id);
        setIsEventLocked(true);
        displayAlert(
          'Success: The event has been locked. No further registrations are allowed.',
        );
      }
    } catch (error) {
      console.error('Error locking/unlocking event:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      displayAlert(
        `An error occurred while updating the event lock status. Details: ${
          errorMessage
        }`,
      );
    }
  };

  const handleLockEventClick = () => {
    setLockConfirmVisible(true);
  };

  const confirmLockEvent = () => {
    handleLockEvent();
    setLockConfirmVisible(false);
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
          <button
            type="button"
            className="btn-primary"
            onClick={toggleSailorFormVisibility}
          >
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
            <button type="submit" className="btn-primary">
              Add Boat(s) to Event
            </button>
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
      <button
        type="button"
        className="btn-secondary"
        onClick={handlePrintStartingList}
      >
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
        className="btn-danger"
        onClick={handleLockEventClick}
      >
        {isEventLocked ? 'Unlock Event' : 'Lock Event'}
      </button>
      {lockConfirmVisible && (
        <ConfirmDialog
          message="Warning: Locking the event will prevent any further registrations. Do you wish to continue?"
          onConfirm={confirmLockEvent}
          onCancel={() => setLockConfirmVisible(false)}
        />
      )}
      {alertVisible && (
        <div
          className="custom-alert-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="custom-alert-window"
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '5px',
              textAlign: 'center',
            }}
          >
            <p>{alertMessage}</p>
            <button type="button" onClick={() => setAlertVisible(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventPage;
