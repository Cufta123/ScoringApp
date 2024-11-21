import React, { useState, useEffect } from 'react';

const ScoringInputComponent = ({ heat, onSubmit }) => {
  const [inputValue, setInputValue] = useState('');
  const [boatNumbers, setBoatNumbers] = useState([]);
  const [validBoats, setValidBoats] = useState([]);
  const [invalidBoats, setInvalidBoats] = useState([]);

  useEffect(() => {
    const fetchBoats = async () => {
      try {
        const boats = await window.electron.sqlite.heatRaceDB.readBoatsByHeat(heat.heat_id);
        setValidBoats(boats.map(boat => boat.sail_number));
      } catch (error) {
        console.error('Error fetching boats:', error);
      }
    };

    fetchBoats();
  }, [heat.heat_id]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleAddBoats = () => {
    const numbers = inputValue.split(' ').map(Number).filter(n => !isNaN(n));
    const newBoatNumbers = [...boatNumbers, ...numbers];
    const invalidNumbers = newBoatNumbers.filter(number => !validBoats.includes(number));
    setBoatNumbers(newBoatNumbers);
    setInvalidBoats(invalidNumbers);
    setInputValue('');
  };

  const handleEditBoatNumber = (index, newNumber) => {
    const updatedBoatNumbers = [...boatNumbers];
    updatedBoatNumbers[index] = newNumber;
    setBoatNumbers(updatedBoatNumbers);
    const invalidNumbers = updatedBoatNumbers.filter(number => !validBoats.includes(number));
    setInvalidBoats(invalidNumbers);
  };

  const handleRemoveBoat = (index) => {
    const updatedBoatNumbers = boatNumbers.filter((_, i) => i !== index);
    setBoatNumbers(updatedBoatNumbers);
    validateBoats(updatedBoatNumbers);
  };

  const validateBoats = (numbers) => {
    const invalidNumbers = numbers.filter(number => !validBoats.includes(number));
    setInvalidBoats(invalidNumbers);
  };

  const handleSubmit = () => {
    onSubmit(boatNumbers);
  };

  const containerStyle = {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    height: '100vh',
  };

  const halfScreenStyle = {
    flex: '1',
    padding: '10px',
    boxSizing: 'border-box',
  };

  const heatsContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    padding: '10px',
  };

  const heatColumnStyle = {
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '5px',
    padding: '10px',
    width: '100%', // Adjust the width as needed
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    cursor: 'pointer',
  };

  const inputStyle = {
    width: '100%', // Make the input field take up the full width
    padding: '10px',
    marginBottom: '10px',
    boxSizing: 'border-box',
  };

  const invalidInputStyle = {
    ...inputStyle,
    borderColor: 'red',
  };

  return (
    <div style={containerStyle}>
      <div style={halfScreenStyle}>
        <h2>Scoring for {heat.heat_name}</h2>
        <p>Heat ID: {heat.heat_id}</p>
        <div style={heatsContainerStyle} className="heats-container">
          <div style={heatColumnStyle} className="heat-column">
            <h4>{heat.heat_name}</h4>
            <table>
              <thead>
                <tr>
                  <th>Sailor Name</th>
                  <th>Country</th>
                  <th>Boat Number</th>
                </tr>
              </thead>
              <tbody>
                {heat.boats.map((boat) => (
                  <tr key={boat.boat_id}>
                    <td>{boat.name} {boat.surname}</td>
                    <td>{boat.country}</td>
                    <td>{boat.sail_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={halfScreenStyle}>
        <h2>Scoring Input</h2>
        <div>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter boat number"
            style={inputStyle}
          />
          <button onClick={handleAddBoats}>Add Boat</button>
        </div>
        <ul>
          {boatNumbers.map((number, index) => (
            <li key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <input
                type="number"
                value={number}
                onChange={(e) => handleEditBoatNumber(index, Number(e.target.value))}
                style={invalidBoats.includes(number) ? invalidInputStyle : inputStyle}
              />
              <button onClick={() => handleRemoveBoat(index)} style={{ marginLeft: '10px' }}>Remove</button>
            </li>
          ))}
        </ul>
        <button onClick={handleSubmit}>Submit Scores</button>
      </div>
    </div>
  );
};

export default ScoringInputComponent;
