/* eslint-disable react/require-default-props */
/* eslint-disable no-console */
/* eslint-disable no-alert */
import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import HeatRows from './HeatRows';

export default function HeatTables({
  heatsToDisplay,
  raceHappened,
  finalSeriesStarted,
  clickable,
  onHeatSelect,
  handleDisplayHeats,
  selectedHeatId = null,
  handleStartScoring = () => {},
  deleteRaceMode = false,
  deleteOptionsActive = false,
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const isDeleteActive = deleteOptionsActive || deleteRaceMode;

  const handleBoatTransfer = useCallback(
    async (boat, fromHeatId, toHeatId) => {
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
        handleDisplayHeats();
      } catch (error) {
        console.error('Error transferring boat:', error);
        alert(`Error transferring boat. ${error.message}`);
      }
    },
    [raceHappened, finalSeriesStarted, handleDisplayHeats],
  );

  const handleDrop = useCallback(
    async (e, toHeatId) => {
      e.preventDefault();
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { boat, fromHeatId } = data;
      await handleBoatTransfer(boat, fromHeatId, toHeatId);
    },
    [handleBoatTransfer],
  );

  const heatsContainerStyle = useMemo(
    () => ({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      padding: '10px',
    }),
    [],
  );

  const heatColumnStyle = useMemo(
    () => ({
      backgroundColor: '#f0f0f0',
      border: '2px solid #ccc',
      borderRadius: '5px',
      padding: '10px',
      maxWidth: '400px',
      flex: '1 1 30%',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      cursor: clickable ? 'pointer' : 'default',
    }),
    [clickable],
  );

  const selectedHeatColumnStyle = useMemo(
    () => ({
      ...heatColumnStyle,
      border: '2px solid #007bff',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    }),
    [heatColumnStyle],
  );

  const boatNumberColumnStyle = useMemo(
    () => ({
      ...heatColumnStyle,
      maxWidth: '100px',
    }),
    [heatColumnStyle],
  );

  const sailorNameColumnStyle = useMemo(
    () => ({
      ...heatColumnStyle,
      maxWidth: '400px',
    }),
    [heatColumnStyle],
  );

  const handleHeatClick = useCallback(
    (heat) => {
      if (clickable) {
        onHeatSelect(heat);
      }
    },
    [clickable, onHeatSelect],
  );

  const handleSort = (key) => {
    setSortConfig((prevConfig) => {
      const direction =
        prevConfig.key === key && prevConfig.direction === 'asc'
          ? 'desc'
          : 'asc';
      return { key, direction };
    });
  };

  const sortedHeats = useMemo(() => {
    if (!sortConfig.key) return heatsToDisplay;

    return heatsToDisplay.map((heat) => {
      const sortedBoats = [...heat.boats].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
      return { ...heat, boats: sortedBoats };
    });
  }, [heatsToDisplay, sortConfig]);

  return (
    <div style={heatsContainerStyle} className="heats-container">
      {sortedHeats.map((heat) => {
        let styleToApply;
        if (isDeleteActive) {
          styleToApply = heatColumnStyle;
        } else if (heat.heat_id === selectedHeatId) {
          styleToApply = selectedHeatColumnStyle;
        } else {
          styleToApply = heatColumnStyle;
        }

        return (
          <div
            key={heat.heat_id}
            style={styleToApply}
            className={`heat-column ${deleteRaceMode ? 'delete-hover' : ''}`}
            onClick={() => handleHeatClick(heat)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleHeatClick(heat);
              }
            }}
            onDrop={(e) => handleDrop(e, heat.heat_id)}
            onDragOver={(e) => e.preventDefault()}
          >
            <h4>
              {heat.heat_name} (Race {heat.raceNumber})
            </h4>
            <table>
              <thead>
                <tr>
                  <th onClick={() => handleSort('position')}>#</th>
                  <th
                    style={sailorNameColumnStyle}
                    onClick={() => handleSort('name')}
                  >
                    Sailor Name
                  </th>
                  <th onClick={() => handleSort('country')}>Country</th>
                  <th
                    style={boatNumberColumnStyle}
                    onClick={() => handleSort('sail_number')}
                  >
                    Sail Number
                  </th>
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
            {!isDeleteActive &&
              heat.heat_id === selectedHeatId &&
              (heat.raceNumber === 0 || finalSeriesStarted) && (
                <button type="button" onClick={handleStartScoring}>
                  Start Scoring
                </button>
              )}
          </div>
        );
      })}
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
          sail_number: PropTypes.string.isRequired,
        }),
      ).isRequired,
    }),
  ).isRequired,
  raceHappened: PropTypes.bool.isRequired,
  finalSeriesStarted: PropTypes.bool.isRequired,
  clickable: PropTypes.bool.isRequired,
  onHeatSelect: PropTypes.func.isRequired,
  handleDisplayHeats: PropTypes.func.isRequired,
  selectedHeatId: PropTypes.number,
  handleStartScoring: PropTypes.func,
  deleteRaceMode: PropTypes.bool,
  deleteOptionsActive: PropTypes.bool,
};
