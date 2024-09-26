/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import PropTypes from 'prop-types';

function SailorList({ sailors }) {
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
      <ul>
        {sortedSailors.map((sailor) => (
          <li key={`${sailor.boat_id}-${sailor.sail_number}`}>
            {sailor.sail_number} - {sailor.model} (Sailor: {sailor.name}{' '}
            {sailor.surname}, Club: {sailor.club})
          </li>
        ))}
      </ul>
    </div>
  );
}

SailorList.propTypes = {
  sailors: PropTypes.arrayOf(
    PropTypes.shape({
      boat_id: PropTypes.number.isRequired,
      sail_number: PropTypes.number.isRequired,
      model: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      surname: PropTypes.string.isRequired,
      club: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default SailorList;
