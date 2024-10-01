import React, { useState } from 'react';
import PropTypes from 'prop-types';

function SailorList({ sailors, onRemoveBoat }) {
  const [sortCriteria, setSortCriteria] = useState('name');

  const sortedSailors = [...sailors].sort((a, b) => {
    if (a[sortCriteria] < b[sortCriteria]) return -1;
    if (a[sortCriteria] > b[sortCriteria]) return 1;
    return 0;
  });

  return (
    <div>
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
              <td>{sailor.country}</td>
              <td>{sailor.sail_number}</td>
              <td>{sailor.model}</td>
              <td>{`${sailor.name} ${sailor.surname}`}</td>
              <td>{sailor.club}</td>
              <td>{sailor.category}</td>
              <td>
                <button
                  type="button"
                  onClick={() => onRemoveBoat(sailor.boat_id)}
                >
                  Remove
                </button>
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
};

export default SailorList;
