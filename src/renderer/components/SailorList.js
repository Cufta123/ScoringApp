/* eslint-disable no-alert */
/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import 'font-awesome/css/font-awesome.min.css';
import Flag from 'react-world-flags';
import iocToFlagCodeMap from '../constants/iocToFlagCodeMap';

function SailorList({ sailors, onRemoveBoat, onRefreshSailors }) {
  const [sortCriteria, setSortCriteria] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc'); // new state for order
  const [editingSailorId, setEditingSailorId] = useState(null);
  const [editedSailor, setEditedSailor] = useState({});
  const [isExpanded, setIsExpanded] = useState(true);

  // Add a helper to format the date as dd/mm/yyyy
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    if (!Number.isNaN(date)) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  useEffect(() => {
    const savedIsExpanded = localStorage.getItem('isExpanded');
    if (savedIsExpanded !== null) {
      setIsExpanded(JSON.parse(savedIsExpanded));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('isExpanded', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Update sortedSailors to use sortDirection and perform numeric comparison for sail_number
  const sortedSailors = [...sailors].sort((a, b) => {
    let aValue = a[sortCriteria];
    let bValue = b[sortCriteria];

    // If sorting by sail_number, compare them as numbers
    if (sortCriteria === 'sail_number') {
      const numA = parseInt(aValue, 10);
      const numB = parseInt(bValue, 10);
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        aValue = numA;
        bValue = numB;
      }
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // New function to handle header click for sorting
  const handleSort = (criteria) => {
    if (sortCriteria === criteria) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCriteria(criteria);
      setSortDirection('asc');
    }
  };

  const handleEditClick = (sailor) => {
    setEditingSailorId(sailor.boat_id);
    setEditedSailor({
      ...sailor,
      originalName: sailor.name,
      originalSurname: sailor.surname,
      originalClubName: sailor.club,
      club_country: sailor.club_country, // add club_country here
      birthday: sailor.birthday,
      gender: sailor.gender,
    });
  };

  const handleSave = async () => {
    // Check for duplicate sail number among other sailors
    const duplicateExists = sailors.some(
      (s) =>
        s.boat_id !== editedSailor.boat_id &&
        String(s.sail_number).trim() ===
          String(editedSailor.sail_number).trim(),
    );
    if (duplicateExists) {
      // Determine digit length from the edited sail number
      const digitLength = String(editedSailor.sail_number).trim().length;
      const minCandidate = 10 ** (digitLength - 1);
      // Build an array of existing sail numbers from props.sailors
      const existingNums = sailors
        .map((s) => parseInt(s.sail_number, 10))
        .filter((num) => !Number.isNaN(num));
      // Use the same helper function (define it locally if not imported)
      const findNextFreeNumber = (numbers, startCandidate = 1) => {
        if (numbers.length === 0) return startCandidate;
        const numSet = new Set(numbers);
        const maxNum = Math.max(...numbers, startCandidate);
        for (
          let candidate = startCandidate;
          candidate <= maxNum + 1;
          candidate += 1
        ) {
          if (!numSet.has(candidate)) return candidate;
        }
        return maxNum + 1;
      };
      const candidate = findNextFreeNumber(existingNums, minCandidate);
      window.alert(
        `Error: Duplicate sail number detected. Suggested next free sail number is ${candidate}.`,
      );
      return;
    }

    const sailorData = {
      originalName: editedSailor.originalName,
      originalSurname: editedSailor.originalSurname,
      originalClubName: editedSailor.originalClubName,
      name: editedSailor.name,
      surname: editedSailor.surname,
      birthday: editedSailor.birthday,
      gender: editedSailor.gender,
      club_name: editedSailor.club,
      club_country: editedSailor.club_country, // include club_country in update
      boat_id: editedSailor.boat_id,
      sail_number: editedSailor.sail_number,
      country: editedSailor.country,
      model: editedSailor.model,
    };

    console.log('Saving sailor and boat:', sailorData);
    try {
      const result =
        await window.electron.sqlite.sailorDB.updateSailor(sailorData);
      console.log('Update result:', result);
      onRefreshSailors();
      setEditingSailorId(null);
    } catch (error) {
      console.error('Error updating sailor:', error);
      window.alert(`Error updating sailor: ${error.message || error}`);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedSailor((prev) => ({ ...prev, [name]: value }));
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const getFlagCode = (iocCode) => {
    return iocToFlagCodeMap[iocCode] || iocCode;
  };

  // Render sort indicator within a fixed-width span
  const renderSortIndicator = (criteria) => {
    let indicator = '';
    if (sortCriteria === criteria) {
      indicator = sortDirection === 'asc' ? '↑' : '↓';
    }
    return <span className="sort-indicator">{indicator}</span>;
  };

  return (
    <div>
      <style>
        {`
          .icon-container {
            display: flex;
            justify-content: start;
            gap: 20px;
          }

          @media (max-width: 600px) {
            .icon-container {
              gap: 5px;
            }
          }

          .editable {
            border-bottom: 1px dashed #ccc;
            cursor: text;
            background-color: #f9f9f9;
          }

          .editable:hover {
            background-color: #e0e0e0;
          }

          .editable-input {
            border: none;
            background: transparent;
            border-bottom: 1px dashed #ccc;
            width: 100%;
          }

          th {
            cursor: pointer;
          }

          .sort-indicator {
            display: inline-block;
            width: 15px; /* ensure fixed width */
          }
        `}
      </style>
      <button type="button" onClick={toggleExpand}>
        {isExpanded ? 'Collapse Sailor List' : 'Expand Sailor List'}
      </button>
      {isExpanded && (
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('country')}>
                Country {renderSortIndicator('country')}
              </th>
              <th onClick={() => handleSort('sail_number')}>
                Sail Number {renderSortIndicator('sail_number')}
              </th>
              <th onClick={() => handleSort('model')}>
                Model {renderSortIndicator('model')}
              </th>
              <th onClick={() => handleSort('name')}>
                Skipper {renderSortIndicator('name')}
              </th>
              <th onClick={() => handleSort('gender')}>
                Gender {renderSortIndicator('gender')}
              </th>
              <th onClick={() => handleSort('club')}>
                Club {renderSortIndicator('club')}
              </th>
              <th>Club Country</th>
              <th onClick={() => handleSort('birthday')}>
                Date of birth {renderSortIndicator('birthday')}
              </th>
              <th onClick={() => handleSort('category')}>
                Category {renderSortIndicator('category')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSailors.map((sailor) => (
              <tr key={`${sailor.boat_id}-${sailor.sail_number}`}>
                <td>
                  {editingSailorId === sailor.boat_id ? (
                    <input
                      type="text"
                      name="country"
                      value={editedSailor.country}
                      onChange={handleInputChange}
                      className="editable-input"
                    />
                  ) : (
                    <div>
                      <Flag
                        code={getFlagCode(sailor.country)}
                        style={{ width: '30px', marginRight: '5px' }}
                      />
                      <span>{sailor.country}</span>
                    </div>
                  )}
                </td>
                <td>
                  {editingSailorId === sailor.boat_id ? (
                    <input
                      type="text"
                      name="sail_number"
                      value={editedSailor.sail_number}
                      onChange={handleInputChange}
                      className="editable-input"
                    />
                  ) : (
                    sailor.sail_number
                  )}
                </td>
                <td>
                  {editingSailorId === sailor.boat_id ? (
                    <input
                      type="text"
                      name="model"
                      value={editedSailor.model}
                      onChange={handleInputChange}
                      className="editable-input"
                    />
                  ) : (
                    sailor.model
                  )}
                </td>
                <td>
                  {editingSailorId === sailor.boat_id ? (
                    <>
                      <input
                        type="text"
                        name="name"
                        value={editedSailor.name}
                        onChange={handleInputChange}
                        className="editable-input"
                      />
                      <input
                        type="text"
                        name="surname"
                        value={editedSailor.surname}
                        onChange={handleInputChange}
                        className="editable-input"
                      />
                    </>
                  ) : (
                    `${sailor.name} ${sailor.surname}`
                  )}
                </td>
                <td>
                  {editingSailorId === sailor.boat_id ? (
                    <select
                      name="gender"
                      value={editedSailor.gender}
                      onChange={handleInputChange}
                      className="editable-input"
                    >
                      <option value="" disabled>
                        Select Gender
                      </option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    sailor.gender
                  )}
                </td>
                <td>
                  {editingSailorId === sailor.boat_id ? (
                    <input
                      type="text"
                      name="club"
                      value={editedSailor.club}
                      onChange={handleInputChange}
                      className="editable-input"
                    />
                  ) : (
                    sailor.club
                  )}
                </td>
                <td>
                  {editingSailorId === sailor.boat_id ? (
                    <input
                      type="text"
                      name="club_country"
                      value={editedSailor.club_country || ''}
                      onChange={handleInputChange}
                      className="editable-input"
                    />
                  ) : (
                    sailor.club_country
                  )}
                </td>
                <td>
                  {editingSailorId === sailor.boat_id ? (
                    <input
                      type="date"
                      name="birthday"
                      value={editedSailor.birthday}
                      onChange={handleInputChange}
                      className="editable-input"
                    />
                  ) : (
                    formatDate(sailor.birthday)
                  )}
                </td>
                <td>{sailor.category}</td>
                <td>
                  <div className="icon-container">
                    {editingSailorId === sailor.boat_id ? (
                      <i
                        className="fa fa-save"
                        aria-label="Save"
                        role="button"
                        tabIndex="0"
                        onClick={handleSave}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') handleSave();
                        }}
                        style={{
                          color: 'green',
                          fontSize: '24px',
                          cursor: 'pointer',
                        }}
                      />
                    ) : (
                      <i
                        className="fa fa-pencil"
                        aria-label="Edit Boat"
                        role="button"
                        tabIndex="0"
                        onClick={() => handleEditClick(sailor)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' || e.key === ' ')
                            handleEditClick(sailor);
                        }}
                        style={{
                          color: 'blue',
                          fontSize: '24px',
                          cursor: 'pointer',
                        }}
                      />
                    )}
                    <i
                      className="fa fa-trash"
                      aria-label="Remove Boat"
                      role="button"
                      tabIndex="0"
                      onClick={() => onRemoveBoat(sailor.boat_id)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' || e.key === ' ')
                          onRemoveBoat(sailor.boat_id);
                      }}
                      style={{
                        color: 'red',
                        fontSize: '24px',
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

SailorList.propTypes = {
  sailors: PropTypes.arrayOf(
    PropTypes.shape({
      boat_id: PropTypes.number.isRequired,
      country: PropTypes.string.isRequired,
      sail_number: PropTypes.string.isRequired,
      model: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      surname: PropTypes.string.isRequired,
      gender: PropTypes.string.isRequired, // new prop
      club: PropTypes.string.isRequired,
      category: PropTypes.string.isRequired,
      birthday: PropTypes.string.isRequired,
    }),
  ).isRequired,
  onRemoveBoat: PropTypes.func.isRequired,
  onRefreshSailors: PropTypes.func.isRequired,
};

export default SailorList;
