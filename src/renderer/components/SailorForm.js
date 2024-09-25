/* eslint-disable camelcase */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

function SailorForm({ onAddSailor, eventId }) {
  SailorForm.propTypes = {
    onAddSailor: PropTypes.func.isRequired,
    eventId: PropTypes.number.isRequired,
  };

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [birthday, setBirthday] = useState('');
  const [club, setClub] = useState('');
  const [clubs, setClubs] = useState([]);
  const [sailNumber, setSailNumber] = useState('');
  const [model, setModel] = useState('');
  const [boats, setBoats] = useState([]);

  const fetchSailors = async () => {
    try {
      const allSailors = await window.electron.sqlite.sailorDB.readAllSailors();
      console.log('Fetched sailors:', allSailors);
    } catch (error) {
      console.error('Error fetching sailors:', error);
    }
  };

  const fetchClubs = async () => {
    try {
      const allClubs = await window.electron.sqlite.sailorDB.readAllClubs();
      setClubs(allClubs);
    } catch (error) {
      console.error('Error fetching clubs:', error);
    }
  };

  const fetchBoats = async () => {
    try {
      const allBoats = await window.electron.sqlite.sailorDB.readAllBoats();
      console.log('Fetched boats:', allBoats); // Log the structure of the fetched boats
      setBoats(allBoats);
    } catch (error) {
      console.error('Error fetching boats:', error);
    }
  };

  useEffect(() => {
    fetchSailors();
    fetchClubs();
    fetchBoats();
  }, []);

  const calculateCategory = () => {
    const birthYear = new Date(birthday).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;

    if (age <= 12) return 1; // Kadet
    if (age <= 18) return 2; // Junior
    if (age <= 35) return 3; // Senior
    if (age <= 50) return 4; // Master
    return 5; // Grand Master
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const category_id = calculateCategory(birthday);

      // Check if the club exists, if not insert it
      let club_id = clubs.find((c) => c.club_name === club)?.club_id;
      if (!club_id) {
        const insertClubWithRetry = async (retries = 5) => {
          try {
            const result = await window.electron.sqlite.sailorDB.insertClub(
              club,
              'Country',
            );
            return result.lastInsertRowid;
          } catch (error) {
            if (retries > 0) {
              console.error('Retrying insert club:', error);
              await new Promise((resolve) => {
                setTimeout(resolve, 100);
              });
              return insertClubWithRetry(retries - 1);
            }
            throw error;
          }
        };

        club_id = await insertClubWithRetry();
      }

      // Check if the sailor already exists
      const allSailors = await window.electron.sqlite.sailorDB.readAllSailors();
      let sailor_id = allSailors.find(
        (s) =>
          s.name === name && s.surname === surname && s.birthday === birthday,
      )?.sailor_id;

      if (!sailor_id) {
        // Insert the sailor and get the sailor_id
        const sailorResult = await window.electron.sqlite.sailorDB.insertSailor(
          name,
          surname,
          birthday,
          category_id,
          club_id,
        );
        sailor_id = sailorResult.lastInsertRowid;
      }

      // Insert the boat with the existing or new sailor_id
      let boat_id = boats.find((b) => b.sail_number === sailNumber)?.boat_id;
      if (!boat_id) {
        const insertBoatWithRetry = async (retries = 5) => {
          try {
            const result = await window.electron.sqlite.sailorDB.insertBoat(
              sailNumber,
              'Country',
              model,
              sailor_id,
            );
            return result.lastInsertRowid;
          } catch (error) {
            if (retries > 0) {
              console.error('Retrying insert boat:', error);
              await new Promise((resolve) => {
                setTimeout(resolve, 100);
              });
              return insertBoatWithRetry(retries - 1);
            }
            throw error;
          }
        };

        boat_id = await insertBoatWithRetry();
      }

      // Associate the boat with the event
      await window.electron.sqlite.eventDB.associateBoatWithEvent(
        boat_id,
        eventId,
      );

      console.log('Sailor and boat inserted successfully.');
      fetchSailors();

      // Call the onAddSailor function to refresh the list in EventPage
      onAddSailor();

      // Optionally, reset form fields
    } catch (error) {
      console.error('Error inserting sailor or boat into the database:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Surname"
        value={surname}
        onChange={(e) => setSurname(e.target.value)}
        required
      />
      <input
        type="date"
        placeholder="Birthdate"
        value={birthday}
        onChange={(e) => setBirthday(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Club"
        value={club}
        onChange={(e) => setClub(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Sail Number"
        value={sailNumber}
        onChange={(e) => setSailNumber(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
      />
      <button type="submit">Add Sailor</button>
    </form>
  );
}

export default SailorForm;
