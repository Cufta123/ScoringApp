import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import SailorForm from '../../components/SailorForm';

function EventPage() {
  const location = useLocation();
  const { event } = location.state;
  const [sailors, setSailors] = useState([]);

  const addSailor = (sailorName) => {
    setSailors([...sailors, sailorName]);
  };

  return (
    <div>
      <h1>{event.event_name}</h1>
      <p>Start Date: {event.start_date}</p>
      <p>End Date: {event.end_date}</p>

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
