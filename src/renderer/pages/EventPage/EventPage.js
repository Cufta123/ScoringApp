/* eslint-disable prettier/prettier */
// src/pages/EventPage/EventPage.js
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import SailorForm from '../../components/SailorForm'

function EventPage() {
  const location = useLocation();
  const { event } = location.state;
  const [sailors, setSailors] = useState([]);

  const addSailor = (sailorName) => {
    setSailors([...sailors, sailorName]);
  };

  return (
    <div>
      <h1>{event.name}</h1>
      <p>Start Date: {event.startDate}</p>
      <p>End Date: {event.endDate}</p>

      <h2>Add Sailors</h2>
      <SailorForm onAddSailor={addSailor} />

      <h3>Sailors</h3>
      <ul>
        {sailors.map((sailor) => (
          <li key={sailor}>{sailor}</li>
        ))}
      </ul>
    </div>
  );
}

export default EventPage;
