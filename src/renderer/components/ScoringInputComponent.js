/* eslint-disable no-alert */
/* eslint-disable no-console */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash/debounce';
import LatestHeats from '../../main/functions/LastestHeats';

function ScoringInputComponent({ heat, onSubmit }) {
  const [inputValue, setInputValue] = useState('');
  const [boatNumbers, setBoatNumbers] = useState([]);
  const [temporaryBoats, setTemporaryBoats] = useState([]);
  const [validBoats, setValidBoats] = useState([]);
  const [placeNumbers, setPlaceNumbers] = useState({});
  const [penalties, setPenalties] = useState({});
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const inputRef = useRef(null);
  const [existingHeats, setExistingHeats] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const heats = await window.electron.sqlite.heatRaceDB.readAllHeats(
          heat.event_id,
        );
        setExistingHeats(heats);
      } catch (error) {
        console.error('Error fetching existing heats:', error);
      }
    })();
  }, [heat.event_id]);

  // Fetch valid boats on mount or when heat changes.
  useEffect(() => {
    (async () => {
      try {
        const boats = await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
          heat.heat_id,
        );
        setValidBoats(boats.map((boat) => boat.sail_number));
      } catch (error) {
        console.error('Error fetching boats:', error);
      }
    })();
  }, [heat.heat_id]);

  // Memoize computed place numbers
  const computedPlaceNumbers = useMemo(() => {
    const newPlaceNumbers = {};
    boatNumbers.forEach((boat, idx) => {
      if (!penalties[boat]) newPlaceNumbers[boat] = idx + 1;
    });
    return newPlaceNumbers;
  }, [boatNumbers, penalties]);

  // Update places when computedPlaceNumbers changes.
  useEffect(() => {
    setPlaceNumbers(computedPlaceNumbers);
  }, [computedPlaceNumbers]);

  // Debounce heavy tasks on input change.
  const debouncedInputHandler = useMemo(
    () =>
      debounce((value) => {
        console.log('Debounced value:', value);
      }, 300),
    [],
  );

  const handleInputChange = useCallback(
    (e) => {
      const input = e.target.value;
      setInputValue(input);
      debouncedInputHandler(input);
      const inputNumbers = input.split(' ').filter((s) => s.trim() !== '');
      setTemporaryBoats([...new Set(inputNumbers)]);
    },
    [debouncedInputHandler],
  );

  const handleBoatClick = useCallback((sailNumber) => {
    setTemporaryBoats((prev) => {
      if (!prev.includes(sailNumber)) {
        const updated = [...prev, sailNumber];
        setInputValue(updated.join(' '));
        return updated;
      }
      return prev;
    });
  }, []);

  const handleAddBoats = useCallback(() => {
    const validNewBoats = temporaryBoats.filter(
      (number) => !boatNumbers.includes(number) && validBoats.includes(number),
    );
    const boatsWithoutPenalties = validNewBoats.filter(
      (number) => !penalties[number],
    );
    const boatsWithPenalties = validNewBoats.filter(
      (number) => penalties[number],
    );
    const updatedBoatNumbers = [
      ...boatNumbers,
      ...boatsWithoutPenalties,
      ...boatsWithPenalties,
    ];
    setBoatNumbers(updatedBoatNumbers);
    setTemporaryBoats([]);
    setInputValue('');
  }, [temporaryBoats, boatNumbers, validBoats, penalties]);

  const handleRemoveBoat = useCallback((index) => {
    setBoatNumbers((prev) => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const handleReorderBoat = useCallback((fromIndex, toIndex) => {
    setBoatNumbers((prev) => {
      const updated = [...prev];
      const [movedBoat] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedBoat);
      return updated;
    });
  }, []);

  const handleDragStart = useCallback((index) => setDraggingIndex(index), []);
  const handleDragOver = useCallback(
    (index) => (e) => {
      e.preventDefault();
      setDropIndex(index);
    },
    [],
  );
  const handleDrop = useCallback(() => {
    if (draggingIndex !== null && dropIndex !== null) {
      handleReorderBoat(draggingIndex, dropIndex);
      setDraggingIndex(null);
      setDropIndex(null);
    }
  }, [draggingIndex, dropIndex, handleReorderBoat]);

  const handlePenaltyChange = useCallback((boatNumber, penalty) => {
    setPenalties((prev) => ({ ...prev, [boatNumber]: penalty }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const allBoats = [...new Set([...boatNumbers, ...validBoats])];
    const boatsWithPenalties = allBoats.filter((boat) => penalties[boat]);
    const boatsWithoutPenalties = allBoats.filter((boat) => !penalties[boat]);
    const boatPlaces = boatsWithoutPenalties.map((boat, index) => ({
      boatNumber: boat,
      place: index + 1,
      status: 'FINISHED',
    }));
    await window.electron.sqlite.heatRaceDB.updateRDGScores(heat.event_id);
    // Use LatestHeats to get the latest heats for this event.
    const latestHeats = LatestHeats(existingHeats);

    // Retrieve boats for each latest heat if not already present.
    await Promise.all(
      latestHeats.map(async (h) => {
        if (!h.boats || h.boats.length === 0) {
          try {
            const boats =
              await window.electron.sqlite.heatRaceDB.readBoatsByHeat(
                h.heat_id,
              );
            h.boats = boats;
          } catch (err) {
            console.error(
              `Error retrieving boats for heat ${h.heat_name}:`,
              err,
            );
            h.boats = [];
          }
        }
      }),
    );

    latestHeats.forEach((h) => {
      console.log(
        `Heat ${h.heat_name} has ${h.boats ? h.boats.length : 0} boats.`,
      );
    });

    // Determine the longest heat (maximum number of boats among latest heats)
    const longestHeatCount = latestHeats.reduce((max, h) => {
      const count = h.boats ? h.boats.length : 0;
      return count > max ? count : max;
    }, 0);

    // Assign boats with penalties a place equal to longestHeatCount + 1.
    boatsWithPenalties.forEach((boat) => {
      boatPlaces.push({
        boatNumber: boat,
        place: longestHeatCount + 1,
        status: penalties[boat],
      });
    });

    const allBoatsAccountedFor = allBoats.every(
      (boat) => placeNumbers[boat] || penalties[boat],
    );
    if (allBoatsAccountedFor) {
      onSubmit(boatPlaces);
    } else {
      alert('Please assign a place or penalty to every boat.');
    }
  }, [
    boatNumbers,
    validBoats,
    heat.event_id,
    existingHeats,
    penalties,
    placeNumbers,
    onSubmit,
  ]);

  const getPlaceNumber = useCallback(
    (sailNumber) => {
      if (penalties[sailNumber]) return penalties[sailNumber];
      if (temporaryBoats.includes(sailNumber))
        return temporaryBoats.indexOf(sailNumber) + 1;
      return placeNumbers[sailNumber] || '';
    },
    [penalties, temporaryBoats, placeNumbers],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100vh',
      }}
    >
      <div style={{ flex: '1', padding: '10px', boxSizing: 'border-box' }}>
        <h2>Scoring for Heat: {heat.heat_name}</h2>
        <p>Heat ID: {heat.heat_id}</p>
        <p>Click any row below to add that boat to the scoring list.</p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '10px',
          }}
        >
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
                  <th>Sail Number</th>
                  <th>Place</th>
                  <th>Penalty</th>
                </tr>
              </thead>
              <tbody>
                {heat.boats.map((boat) => (
                  <tr
                    key={boat.boat_id}
                    onClick={() => handleBoatClick(boat.sail_number)}
                  >
                    <td>
                      {boat.name} {boat.surname}
                    </td>
                    <td>{boat.country}</td>
                    <td>{boat.sail_number}</td>
                    <td>{getPlaceNumber(boat.sail_number)}</td>
                    <td>
                      <select
                        style={{ width: '70px' }}
                        value={penalties[boat.sail_number] || ''}
                        onChange={(e) =>
                          handlePenaltyChange(boat.sail_number, e.target.value)
                        }
                      >
                        <option value="">None</option>
                        <option value="DNS">DNS</option>
                        <option value="DNF">DNF</option>
                        <option value="RET">RET</option>
                        <option value="NSC">NSC</option>
                        <option value="OCS">OCS</option>
                        <option value="DNC">DNC</option>
                        <option value="WTH">WTH</option>
                        <option value="UFD">UFD</option>
                        <option value="BFD">BFD</option>
                        <option value="DSQ">DSQ</option>
                        <option value="DNE">DNE</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style={{ flex: '1', padding: '10px', boxSizing: 'border-box' }}>
        <h2>Enter Sail Numbers</h2>
        <p>
          Type the sail number(s) below, separated by spaces (or click on a row
          above), then click the button to add them.
        </p>
        <div>
          <input
            type="text"
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            placeholder="e.g. 101 102 103"
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '10px',
              boxSizing: 'border-box',
            }}
          />
          <button type="button" onClick={handleAddBoats}>
            Add Entered Boat(s)
          </button>
        </div>
        <ul>
          {boatNumbers.map((number, index) => (
            <React.Fragment key={number}>
              {dropIndex === index && (
                <div
                  style={{
                    height: '2px',
                    backgroundColor: '#007bff',
                    width: '30%',
                    marginLeft: '5px',
                    borderRadius: '1px',
                    alignContent: 'center',
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
                <span style={{ marginRight: '10px' }}>
                  Boat {number} -{' '}
                  {penalties[number]
                    ? `Penalty: ${penalties[number]}`
                    : `Place: ${placeNumbers[number]}`}
                </span>
                <button type="button" onClick={() => handleRemoveBoat(index)}>
                  Remove Boat
                </button>
              </li>
            </React.Fragment>
          ))}
          {dropIndex === boatNumbers.length && (
            <div
              style={{
                height: '5px',
                backgroundColor: '#007bff',
                marginLeft: '0',
                width: '50%',
              }}
            />
          )}
        </ul>
        <p style={{ fontStyle: 'italic', color: '#555' }}>
          You can rearrange boats by clicking, holding, and dragging them.
        </p>
        <button type="button" onClick={handleSubmit}>
          Finalize and Submit Scores
        </button>
      </div>
    </div>
  );
}
ScoringInputComponent.propTypes = {
  heat: PropTypes.shape({
    event_id: PropTypes.number.isRequired,
    heat_id: PropTypes.number.isRequired,
    heat_name: PropTypes.string.isRequired,
    boats: PropTypes.arrayOf(
      PropTypes.shape({
        boat_id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
        surname: PropTypes.string.isRequired,
        country: PropTypes.string.isRequired,
        sail_number: PropTypes.string.isRequired,
      }),
    ).isRequired,
  }).isRequired,
  onSubmit: PropTypes.func.isRequired,
};
export default ScoringInputComponent;
