import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HeatComponent from '../../components/HeatComponent';
import './HeatRacePage.css';

function HeatRacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { event } = location.state;
  const [eventData, setEventData] = useState(event || null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const eventData = await window.electron.sqlite.eventDB.readEventById(event.event_id);
        setEventData(eventData);
      } catch (error) {
        console.error('Error fetching event:', error);
      }
    };

    if (!eventData && event) {
      fetchEvent();
    }
  }, [eventData, event]);

  if (!event) {
    return <p>No event data available.</p>;
  }

  return (
    <div>
      <button onClick={() => navigate(-1)}>Back</button>
      {eventData ? (
        <HeatComponent event={eventData} />
      ) : (
        <p>Loading event data...</p>
      )}
    </div>
  );
}

export default HeatRacePage;
