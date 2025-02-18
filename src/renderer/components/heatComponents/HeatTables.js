import React, { useState } from 'react';
import PropTypes from 'prop-types';
import HeatRows from './HeatRows';

export default function HeatTables({
  heatsToDisplay,
  raceHappened,
  finalSeriesStarted,
  clickable,
  onHeatSelect,
  handleDisplayHeats,
}) {
  const [selectedHeatId, setSelectedHeatId] = useState(null);

  const handleBoatTransfer = async (boat, fromHeatId, toHeatId) => {
    if (raceHappened || finalSeriesStarted) {
      alert('Cannot transfer boats after a race has happened.');
      return;
    }

    try {
      await window.electron.sqlite.heatRaceDB.transferBoatBetweenHeats(
        fromHeatId,
        toHeatId,
        boat.boat_id,
      );
      alert('Boat transferred successfully!');
      handleDisplayHeats(); // Refresh the heats display
    } catch (error) {
      console.error('Error transferring boat:', error);
      alert('Error transferring boat. Please try again later.');
    }
  };

  const handleDrop = async (e, toHeatId) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('application/json'));
    const { boat, fromHeatId } = data;
    await handleBoatTransfer(boat, fromHeatId, toHeatId);
  };

  const handleHeatClick = (heat) => {
    if (clickable) {
      setSelectedHeatId(heat.heat_id);
      onHeatSelect(heat);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const heatsContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    padding: '10px',
  };

  const heatColumnStyle = {
    backgroundColor: '#f0f0f0',
    border: '2px solid #ccc',
    borderRadius: '5px',
    padding: '10px',
    maxWidth: '400px', // Set max width
    flex: '1 1 30%', // Ensure only 4 columns per row with uniform spacing
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    cursor: clickable ? 'pointer' : 'default',
  };
  const selectedHeatColumnStyle = {
    ...heatColumnStyle,
    border: '2px solid #007bff', // Blue border to highlight the selected heat
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)', // Add shadow for more emphasis
  };
  const boatNumberColumnStyle = {
    ...heatColumnStyle,
    maxWidth: '100px', // Shorter width for boat number
  };

  const sailorNameColumnStyle = {
    ...heatColumnStyle,
    maxWidth: '400px', // Wider width for sailor name
  };

  return (
    <div style={heatsContainerStyle} className="heats-container">
      {heatsToDisplay.map((heat) => (
        <div
          key={heat.heat_id}
          style={
            heat.heat_id === selectedHeatId
              ? selectedHeatColumnStyle
              : heatColumnStyle
          }
          className="heat-column"
          onClick={() => handleHeatClick(heat)}
          role="button"
          tabIndex={0}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleHeatClick(heat);
            }
          }}
          onDrop={(e) => handleDrop(e, heat.heat_id)}
          onDragOver={handleDragOver}
        >
          <h4>
            {heat.heat_name} (Race {heat.raceNumber})
          </h4>
          <table>
            <thead>
              <tr>
                <th style={sailorNameColumnStyle}>Sailor Name</th>
                <th>Country</th>
                <th style={boatNumberColumnStyle}>Boat Number</th>
              </tr>
            </thead>
            <HeatRows
              heat={heat}
              raceHappened={raceHappened}
              finalSeriesStarted={finalSeriesStarted}
              boatNumberColumnStyle={boatNumberColumnStyle}
              sailorNameColumnStyle={sailorNameColumnStyle}
            />
          </table>
        </div>
      ))}
    </div>
  );
}

HeatTables.propTypes = {
  heatsToDisplay: PropTypes.arrayOf(
    PropTypes.shape({
      heat_id: PropTypes.number.isRequired,
      heat_name: PropTypes.string.isRequired,
      raceNumber: PropTypes.number.isRequired,
      boats: PropTypes.arrayOf(
        PropTypes.shape({
          boat_id: PropTypes.number.isRequired,
          name: PropTypes.string.isRequired,
          surname: PropTypes.string.isRequired,
          country: PropTypes.string.isRequired,
          sail_number: PropTypes.number.isRequired,
        }),
      ).isRequired,
    }),
  ).isRequired,
  raceHappened: PropTypes.bool.isRequired,
  finalSeriesStarted: PropTypes.bool.isRequired,
  clickable: PropTypes.bool.isRequired,
  onHeatSelect: PropTypes.func.isRequired,
  handleDisplayHeats: PropTypes.func.isRequired,
};
