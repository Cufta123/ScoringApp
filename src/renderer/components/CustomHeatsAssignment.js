import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Flag from 'react-world-flags';
import iocToFlagCodeMap from '../constants/iocToFlagCodeMap';

function CustomHeatAssignment({ event, onSave, onCancel }) {
  const [availableSailors, setAvailableSailors] = useState([]);
  // assignedSailors is an array with one slot per available sailor.
  // A slot may be null (empty) or contain a boat.
  const [assignedSailors, setAssignedSailors] = useState([]);

  useEffect(() => {
    async function fetchBoats() {
      try {
        const eventBoats =
          await window.electron.sqlite.eventDB.readBoatsByEvent(event.event_id);
        setAvailableSailors(eventBoats);
        setAssignedSailors(new Array(eventBoats.length).fill(null));
      } catch (error) {
        console.error('Error fetching boats:', error);
      }
    }
    fetchBoats();
  }, [event.event_id]);

  // Helper to get flag code for a given country code.
  const getFlagCode = (iocCode) => iocToFlagCodeMap[iocCode] || iocCode;

  // Called when a drag starts.
  const handleDragStart = (e, source, index) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ source, index }));
  };

  // Called when dropping on a new assignment row.
  const handleDropAssigned = (e, targetIndex) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (!data) return;

    if (data.source === 'existing') {
      const boat = availableSailors[data.index];
      if (!boat) return;
      const newAvailable = [...availableSailors];
      newAvailable.splice(data.index, 1);
      setAvailableSailors(newAvailable);
      const newAssigned = [...assignedSailors];
      newAssigned[targetIndex] = boat;
      setAssignedSailors(newAssigned);
    } else if (data.source === 'assigned') {
      const newAssigned = [...assignedSailors];
      const boat = newAssigned[data.index];
      newAssigned[data.index] = newAssigned[targetIndex];
      newAssigned[targetIndex] = boat;
      setAssignedSailors(newAssigned);
    }
  };

  // When dropping back on the existing sailors table.
  const handleDropExisting = (e) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (!data) return;
    if (data.source === 'assigned') {
      const newAssigned = [...assignedSailors];
      const boat = newAssigned[data.index];
      newAssigned[data.index] = null;
      setAssignedSailors(newAssigned);
      setAvailableSailors([...availableSailors, boat]);
    }
  };

  const allowDrop = (e) => {
    e.preventDefault();
  };

  // New click handler to assign a sailor from available to assigned on click.
  const handleAssignSailor = (index) => {
    const boat = availableSailors[index];
    if (!boat) return;
    // Find first free (null) slot in assignedSailors.
    const targetIndex = assignedSailors.indexOf(null);
    if (targetIndex === -1) return;
    const newAvailable = [...availableSailors];
    newAvailable.splice(index, 1);
    setAvailableSailors(newAvailable);
    const newAssigned = [...assignedSailors];
    newAssigned[targetIndex] = boat;
    setAssignedSailors(newAssigned);
  };

  // Called when clicking "Apply Custom Assignment".
  const handleApply = () => {
    const customOrder = assignedSailors.filter((boat) => boat !== null);
    console.log('Custom assignment saved:', customOrder);
    onSave(customOrder);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Action Buttons at the Top */}
      <div
        style={{ display: 'flex', justifyContent: 'flex-start', gap: '10px' }}
      >
        <button
          type="button"
          onClick={handleApply}
          style={{ padding: '10px 15px' }}
        >
          Apply Custom Assignment
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '10px 15px' }}
        >
          Cancel
        </button>
      </div>
      <div
        style={{ display: 'flex', justifyContent: 'space-evenly', gap: '20px' }}
      >
        {/* Existing Sailors Table */}
        <div style={{ flex: '1' }}>
          <h2>Existing Sailors</h2>
          <table
            style={{ width: '100%', borderCollapse: 'collapse' }}
            onDragOver={allowDrop}
            onDrop={handleDropExisting}
          >
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ccc', padding: '5px' }}>
                  Slot
                </th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '5px' }}>
                  Country
                </th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '5px' }}>
                  Sail number
                </th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '5px' }}>
                  Sailor Name
                </th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(availableSailors) ? availableSailors : []).map(
                (boat, index) => (
                  <tr
                    key={boat ? boat.boat_id : `empty-${index}`}
                    draggable={!!boat}
                    onDragStart={
                      boat
                        ? (e) => handleDragStart(e, 'existing', index)
                        : undefined
                    }
                    onClick={() => handleAssignSailor(index)}
                    onDrop={(e) => handleDropAssigned(e, index)}
                    onDragOver={allowDrop}
                    style={{
                      height: '40px',
                      backgroundColor: boat ? '#e6ffe6' : '#f9f9f9',
                      border: '1px dashed #ccc',
                      cursor: 'pointer',
                      userSelect: 'none', // Prevent accidental text selection
                    }}
                  >
                    <td style={{ padding: '5px' }}>{index + 1}</td>
                    {boat ? (
                      <>
                        <td style={{ padding: '5px' }}>
                          <Flag
                            code={getFlagCode(boat.boat_country)}
                            style={{ width: '30px', marginRight: '5px' }}
                          />
                          {boat.boat_country}
                        </td>
                        <td style={{ padding: '5px' }}>{boat.sail_number}</td>
                        <td style={{ padding: '5px' }}>
                          {boat.name} {boat.surname}
                        </td>
                      </>
                    ) : (
                      <td
                        colSpan="3"
                        style={{
                          padding: '5px',
                          fontStyle: 'italic',
                          color: '#888',
                        }}
                      >
                        Empty
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        {/* New Assignment Table */}
        <div
          style={{
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginTop: '-37px', // Lifts the text up by 20px
          }}
        >
          <h2>New Assignment</h2>
          <p style={{ margin: 0 }}>
            Drag sailors here or click from the left table to assign heat order
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ccc', padding: '5px' }}>
                  Slot
                </th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '5px' }}>
                  Country
                </th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '5px' }}>
                  Sail Number
                </th>
                <th style={{ borderBottom: '1px solid #ccc', padding: '5px' }}>
                  Sailor Name
                </th>
              </tr>
            </thead>
            <tbody>
              {assignedSailors.map((boat, index) => (
                <tr
                  key={boat ? boat.boat_id : `empty-${index}`}
                  draggable={!!boat}
                  onDragStart={
                    boat
                      ? (e) => handleDragStart(e, 'assigned', index)
                      : undefined
                  }
                  onDrop={(e) => handleDropAssigned(e, index)}
                  onDragOver={allowDrop}
                  style={{
                    height: '40px',
                    backgroundColor: boat ? '#e6ffe6' : '#f9f9f9',
                    border: '1px dashed #ccc',
                  }}
                >
                  <td style={{ padding: '5px' }}>{index + 1}</td>
                  {boat ? (
                    <>
                      <td style={{ padding: '5px' }}>
                        <Flag
                          code={getFlagCode(boat.boat_country)}
                          style={{ width: '30px', marginRight: '5px' }}
                        />
                        {boat.boat_country}
                      </td>
                      <td style={{ padding: '5px' }}>{boat.sail_number}</td>
                      <td style={{ padding: '5px' }}>
                        {boat.name} {boat.surname}
                      </td>
                    </>
                  ) : (
                    <td
                      colSpan="3"
                      style={{
                        padding: '5px',
                        fontStyle: 'italic',
                        color: '#888',
                      }}
                    >
                      Empty
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

CustomHeatAssignment.propTypes = {
  event: PropTypes.shape({
    event_id: PropTypes.number.isRequired,
  }).isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default CustomHeatAssignment;
