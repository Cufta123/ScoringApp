import React, { useState, useEffect } from 'react';

const SailorsForm = () => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [birthday, setBirthday] = useState('');
  const [club, setClub] = useState('');
  const [clubs, setClubs] = useState([]);
  const [sailNumber, setSailNumber] = useState('');
  const [model, setModel] = useState('');
  const [boats, setBoats] = useState([]);
  const [sailors, setSailors] = useState([]);

  useEffect(() => {
    fetchSailors();
    fetchBoats();
    fetchClubs();
  }, []);

  const fetchSailors = async () => {
    try {
      const allSailors = await window.electron.sqlite.sailorDB.readAllSailors();
      console.log('Fetched sailors:', allSailors);
      setSailors(allSailors);
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
      setBoats(allBoats);
    } catch (error) {
      console.error('Error fetching boats:', error);
    }
  };

  const calculateCategory = (birthday) => {
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
      let club_id = clubs.find(c => c.club_name === club)?.club_id;
      if (!club_id) {
        const insertClubWithRetry = async (retries = 5) => {
          try {
            const result = await window.electron.sqlite.sailorDB.insertClub(club, 'Country'); // Replace 'Country' with actual country if needed
            return result.lastInsertRowid;
          } catch (error) {
            if (error.code === 'SQLITE_BUSY' && retries > 0) {
              console.warn('Database is busy, retrying...');
              await new Promise(resolve => setTimeout(resolve, 100)); // Wait for 100ms before retrying
              return insertClubWithRetry(retries - 1);
            } else {
              throw error;
            }
          }
        };

        club_id = await insertClubWithRetry();
      }

      // Check if the boat exists, if not insert it
      let boat_id = boats.find(b => b.sail_number === sailNumber)?.boat_id;
      if (!boat_id) {
        const insertBoatWithRetry = async (retries = 5) => {
          try {
            const result = await window.electron.sqlite.sailorDB.insertBoat(sailNumber, 'Country', model); // Replace 'Country' with actual country if needed
            return result.lastInsertRowid;
          } catch (error) {
            if (error.code === 'SQLITE_BUSY' && retries > 0) {
              console.warn('Database is busy, retrying...');
              await new Promise(resolve => setTimeout(resolve, 100)); // Wait for 100ms before retrying
              return insertBoatWithRetry(retries - 1);
            } else {
              throw error;
            }
          }
        };
        boat_id = await insertBoatWithRetry();
      }

      // Insert the sailor with the boat_id
      await window.electron.sqlite.sailorDB.insertSailor(
        name,
        surname,
        birthday,
        category_id,
        club_id,
        boat_id // Ensure boat_id is passed here
      );
      fetchSailors();
    } catch (error) {
      console.error('Error inserting sailor into the database:', error);
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
};

export default SailorsForm;
