import React, { useState, useEffect } from 'react';

const SailorForm = () => {
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [category, setCategory] = useState('');
    const [club, setClub] = useState('');
    const [clubs, setClubs] = useState([]);
    const [sailNumber, setSailNumber] = useState('');
    const [model, setModel] = useState('');
    const [sailors, setSailors] = useState([]);

    useEffect(() => {
        fetchSailors();
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
            const allClubs = await window.electron.sqlite.sailorDB.getAllClubs();
            console.log('Fetched clubs:', allClubs);
            setClubs(allClubs);
        } catch (error) {
            console.error('Error fetching clubs:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await window.electron.sqlite.sailorDB.insertSailor(name, surname, birthdate, category, club, sailNumber, model);
            fetchSailors(); // Fetch and log the data after inserting a new sailor
        } catch (error) {
            console.error('Error inserting sailor into the database:', error);
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
                {clubs.map((club) => <option key={club} value={club} />)}
            </datalist>
            <input type="text" placeholder="Sail Number" value={sailNumber} onChange={(e) => setSailNumber(e.target.value)} required />
            <input type="text" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
            <button type="submit">Add Sailor</button>
        </form>
    );
};

export default SailorForm;
