/* eslint-disable camelcase */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import 'font-awesome/css/font-awesome.min.css';

function SailorList({ sailors, onRemoveBoat }) {
  const [sortCriteria, setSortCriteria] = useState('name');
  const [editingSailorId, setEditingSailorId] = useState(null);
  const [editedSailor, setEditedSailor] = useState({});

  const sortedSailors = [...sailors].sort((a, b) => {
    if (a[sortCriteria] < b[sortCriteria]) return -1;
    if (a[sortCriteria] > b[sortCriteria]) return 1;
    return 0;
  });

  const handleEditClick = (sailor) => {
    setEditingSailorId(sailor.boat_id);
    setEditedSailor(sailor);
  };
  const handleSave = async () => {
    const { sailor_id, name, surname, birthday, category_id, club_id } = editedSailor;
    console.log('Saving sailor:', editedSailor); // Log the data being sent
    const result = await window.electron.sqlite.sailorDB.updateSailor(
      sailor_id,
      name,
      surname,
      birthday,
      category_id,
      club_id,
    );
    if (result) {
      console.log('Save successful:', result); // Log the result
      // Handle successful save, e.g., refresh the list or show a success message
    } else {
      console.error('Save failed');
      // Handle error
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedSailor((prev) => ({ ...prev, [name]: value }));
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
        `}
      </style>
      <label htmlFor="sortCriteria">Sort by: </label>
      <select
        id="sortCriteria"
        value={sortCriteria}
        onChange={(e) => setSortCriteria(e.target.value)}
      >
        <option value="name">Name</option>
        <option value="surname">Surname</option>
        <option value="club">Club</option>
        <option value="sail_number">Sail Number</option>
        <option value="model">Boat Model</option>
      </select>
      <table>
        <thead>
          <tr>
            <th>Country</th>
            <th>Sail Number</th>
            <th>Model</th>
            <th>Skipper</th>
            <th>Club</th>
            <th>Category</th>
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
                  sailor.country
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
                    name="category"
                    value={editedSailor.category}
                    onChange={handleInputChange}
                    className="editable-input"
                  />
                ) : (
                  sailor.category
                )}
              </td>
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
    </div>
  );
}

SailorList.propTypes = {
  sailors: PropTypes.arrayOf(
    PropTypes.shape({
      boat_id: PropTypes.number.isRequired,
      country: PropTypes.string.isRequired,
      sail_number: PropTypes.number.isRequired,
      model: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      surname: PropTypes.string.isRequired,
      club: PropTypes.string.isRequired,
      category: PropTypes.string.isRequired,
    }),
  ).isRequired,
  onRemoveBoat: PropTypes.func.isRequired,
  onEditBoat: PropTypes.func.isRequired,
};

export default SailorList;
