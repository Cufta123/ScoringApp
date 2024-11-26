import React, { useState, useEffect } from 'react';

const ScoringInputComponent = ({ heat, onSubmit }) => {
  const [inputValue, setInputValue] = useState('');
  const [boatNumbers, setBoatNumbers] = useState([]);
  const [temporaryBoats, setTemporaryBoats] = useState([]);
  const [validBoats, setValidBoats] = useState([]);
  const [placeNumbers, setPlaceNumbers] = useState({});
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  useEffect(() => {
    const fetchBoats = async () => {
      try {
        const boats = await window.electron.sqlite.heatRaceDB.readBoatsByHeat(heat.heat_id);
        setValidBoats(boats.map((boat) => boat.sail_number));
      } catch (error) {
        console.error('Error fetching boats:', error);
      }
    };

    fetchBoats();
  }, [heat.heat_id]);

  const handleInputChange = (e) => {
    const input = e.target.value;
    const inputNumbers = input
      .split(' ')
      .map(Number)
      .filter((n) => !isNaN(n));

    const uniqueNumbers = [...new Set(inputNumbers)];
    setTemporaryBoats(uniqueNumbers); // Temporarily track boats
    setInputValue(input);
  };

  const handleBoatClick = (sailNumber) => {
    if (!temporaryBoats.includes(sailNumber)) {
      const updatedTemporaryBoats = [...temporaryBoats, sailNumber];
      setTemporaryBoats(updatedTemporaryBoats);
      setInputValue(updatedTemporaryBoats.join(' ')); // Reflect in the input field
    }
  };

  const handleAddBoats = () => {
    const validNewBoats = temporaryBoats.filter(
      (number) => !boatNumbers.includes(number) && validBoats.includes(number)
    );

    const updatedBoatNumbers = [...boatNumbers, ...validNewBoats];
    const updatedPlaceNumbers = { ...placeNumbers };

    validNewBoats.forEach((boat, index) => {
      if (!updatedPlaceNumbers[boat]) {
        updatedPlaceNumbers[boat] = updatedBoatNumbers.indexOf(boat) + 1;
      }
    });

    setBoatNumbers(updatedBoatNumbers);
    setPlaceNumbers(updatedPlaceNumbers);
    setTemporaryBoats([]); // Clear temporary state
    setInputValue(''); // Clear input field
  };

  const updatePlaces = (boats) => {
    const newPlaceNumbers = {};
    boats.forEach((boat, index) => {
      newPlaceNumbers[boat] = index + 1;
    });
    setPlaceNumbers(newPlaceNumbers);
  };

  const handleRemoveBoat = (index) => {
    const updatedBoatNumbers = boatNumbers.filter((_, i) => i !== index);
    const updatedPlaceNumbers = {};

    // Recalculate place numbers for the remaining boats
    updatedBoatNumbers.forEach((boat, newIndex) => {
      updatedPlaceNumbers[boat] = newIndex + 1;
    });

    setBoatNumbers(updatedBoatNumbers);
    setPlaceNumbers(updatedPlaceNumbers);
  };

  const handleReorderBoat = (fromIndex, toIndex) => {
    const updatedBoatNumbers = [...boatNumbers];
    const [movedBoat] = updatedBoatNumbers.splice(fromIndex, 1);
    updatedBoatNumbers.splice(toIndex, 0, movedBoat);
    setBoatNumbers(updatedBoatNumbers);
    updatePlaces(updatedBoatNumbers);
  };

  const handleDragStart = (index) => {
    setDraggingIndex(index);
  };

  const handleDragOver = (index) => (e) => {
    e.preventDefault();
    setDropIndex(index);
  };

  const handleDrop = () => {
    if (draggingIndex !== null && dropIndex !== null) {
      handleReorderBoat(draggingIndex, dropIndex);
      setDraggingIndex(null);
      setDropIndex(null);
    }
  };

  const handleSubmit = () => {
    const boatPlaces = boatNumbers.map((boatNumber) => ({
      boatNumber,
      place: placeNumbers[boatNumber],
    }));
    onSubmit(boatPlaces);
  };

  const getPlaceNumber = (sailNumber) => {
    if (temporaryBoats.includes(sailNumber)) {
      // Display temporary place
      return temporaryBoats.indexOf(sailNumber) + 1 + boatNumbers.length;
    }
    return placeNumbers[sailNumber] || ''; // Display final place
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100vh' }}>
      <div style={{ flex: '1', padding: '10px', boxSizing: 'border-box' }}>
        <h2>Scoring for {heat.heat_name}</h2>
        <p>Heat ID: {heat.heat_id}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '10px' }}>
          <div
            style={{
              backgroundColor: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '5px',
              padding: '10px',
              width: '100%',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
            }}
          >
            <h4>{heat.heat_name}</h4>
            <table>
              <thead>
                <tr>
                  <th>Sailor Name</th>
                  <th>Country</th>
                  <th>Boat Number</th>
                  <th>Place</th>
                </tr>
              </thead>
              <tbody>
                {heat.boats.map((boat) => (
                  <tr
                    key={boat.boat_id}
                    onClick={() => handleBoatClick(boat.sail_number)}
                  >
                    <td>{boat.name} {boat.surname}</td>
                    <td>{boat.country}</td>
                    <td>{boat.sail_number}</td>
                    <td>{getPlaceNumber(boat.sail_number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{ flex: '1', padding: '10px', boxSizing: 'border-box' }}>
        <h2>Scoring Input</h2>
        <div>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter boat number"
            style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }}
          />
          <button onClick={handleAddBoats}>Add Boat</button>
        </div>
        <ul>
          {boatNumbers.map((number, index) => (
            <React.Fragment key={index}>
            {dropIndex === index && (
  <div
    style={{
      height: '2px', // Thinner line for a subtle look
      backgroundColor: '#007bff', // Blue color for visibility
      width: '30%', // Half the width of the list items
      marginLeft: '5px', // Align the line to the left
      borderRadius: '1px', // Rounded edges for better appearance
      alignContent: 'center', // Center the line
    }}
  />
)}
  <li
    style={{
      display: 'flex',
      alignItems: 'center',
      marginBottom: '10px',
      cursor: 'move',
      padding: '5px',
      border: '1px solid #ccc',
      borderRadius: '5px',
      backgroundColor: '#f9f9f9',
       width: 'calc(100% - 10px)',
    }}
    draggable
    onDragStart={() => handleDragStart(index)}
    onDragOver={handleDragOver(index)}
    onDrop={handleDrop}
  >
    <span style={{ marginRight: '10px' }}>Boat {number} - Place {placeNumbers[number]}</span>
    <button onClick={() => handleRemoveBoat(index)}>Remove</button>
  </li>
</React.Fragment>

          ))}
          {dropIndex === boatNumbers.length && (
  <div
    style={{
      height: '5px',
      backgroundColor: '#007bff',
      marginLeft: '0', // Align the line to the left
      width: '50%', // Half the width of the list items
    }}
  />
)}
        </ul>
        <button onClick={handleSubmit}>Submit Scores</button>
      </div>
    </div>
  );
};

export default ScoringInputComponent;
