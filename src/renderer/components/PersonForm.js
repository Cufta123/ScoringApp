import React, { useState, useEffect } from 'react';

const PersonForm = () => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [category, setCategory] = useState('');
  const [club, setClub] = useState('');
  const [clubs, setClubs] = useState([]);
  const [sail_number, setSailNumber] = useState('');
  const [model, setModel] = useState('');
  const [persons, setPersons] = useState([]);

  useEffect(() => {
    fetchPersons();
  }, []);

  const fetchPersons = async () => {
    try {
      const allPersons = await window.electron.sqlite.personDB.readAllPerson();
      console.log('Fetched persons:', allPersons);
      setPersons(allPersons);
    } catch (error) {
      console.error('Error fetching persons:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await window.electron.sqlite.personDB.insertPerson(name, surname, birthdate, category, club, sail_number, model);
      fetchPersons(); // Fetch and log the data after inserting a new person
    } catch (error) {
      console.error('Error inserting person into the database:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input type="text" placeholder="Surname" value={surname} onChange={(e) => setSurname(e.target.value)} required />
      <input type="date" placeholder="Birthdate" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">Select Category</option>
        <option value="Kadet">Kadet</option>
        <option value="Junior">Junior</option>
        <option value="Senior">Senior</option>
        <option value="Master">Master</option>
        <option value="Grand Master">Grand Master</option>
      </select>
      <input type="text" placeholder="Club" value={club} onChange={(e) => setClub(e.target.value)} list="club-list" />
      <datalist id="club-list">
        {clubs.map(club => <option key={club} value={club} />)}
      </datalist>
      <input type="text" placeholder="Sail Number" value={sail_number} onChange={(e) => setSailNumber(e.target.value)} required />
      <input type="text" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
      <button type="submit">Add Person</button>
    </form>
  );
};

export default PersonForm;
