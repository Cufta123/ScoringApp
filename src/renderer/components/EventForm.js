import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function EventForm() {
  const [eventName, setEventName] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [events, setEvents] = useState([]);
  const [sortOption, setSortOption] = useState('name');
  const navigate = useNavigate();

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d)) return dateStr;
    const day = `0${d.getDate()}`.slice(-2);
    const month = `0${d.getMonth() + 1}`.slice(-2);
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const fetchEvents = async () => {
    try {
      const allEvents = await window.electron.sqlite.eventDB.readAllEvents();
      setEvents(Array.isArray(allEvents) ? allEvents : []);
      console.log('Fetched events:', allEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await window.electron.sqlite.eventDB.insertEvent(
        eventName,
        eventLocation,
        eventStartDate,
        eventEndDate,
      );
      console.log('Event inserted:', result);
      fetchEvents(); // Refresh the list of events after insertion
    } catch (error) {
      console.error('Error inserting event:', error);
    }
  };

  const handleEventClick = (event) => {
    navigate(`/event/${event.event_name}`, { state: { event } });
  };

  const sortEvents = (eventsToSort, option) => {
    const sorted = [...eventsToSort];
    switch (option) {
      case 'name':
        sorted.sort((a, b) => a.event_name.localeCompare(b.event_name));
        break;
      case 'startDate':
        sorted.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        break;
      case 'endDate':
        sorted.sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
        break;
      case 'duration':
        sorted.sort((a, b) => {
          const durationA =
            Math.abs(new Date(a.end_date) - new Date(a.start_date)) /
            (1000 * 3600 * 24);
          const durationB =
            Math.abs(new Date(b.end_date) - new Date(b.start_date)) /
            (1000 * 3600 * 24);
          return durationA - durationB;
        });
        break;
      case 'firstCreated':
        sorted.sort((a, b) => a.event_id - b.event_id);
        break;
      case 'lastCreated':
        sorted.sort((a, b) => b.event_id - a.event_id);
        break;
      default:
        break;
    }
    return sorted;
  };

  const sortedEvents = sortEvents(events, sortOption);

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Location"
          value={eventLocation}
          onChange={(e) => setEventLocation(e.target.value)}
          required
        />
        <input
          type="date"
          placeholder="Start Date"
          value={eventStartDate}
          onChange={(e) => setEventStartDate(e.target.value)}
          required
        />
        <input
          type="date"
          placeholder="End Date"
          value={eventEndDate}
          onChange={(e) => setEventEndDate(e.target.value)}
          required
        />
        <button type="submit">Create Event</button>
      </form>
      <div>
        <h2>Events List</h2>
        <label htmlFor="sortSelect">Sort by: </label>
        <select
          id="sortSelect"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
        >
          <option value="name">Name</option>
          <option value="startDate">Start Date</option>
          <option value="endDate">End Date</option>
          <option value="duration">Duration</option>
          <option value="firstCreated">First Created</option>
          <option value="lastCreated">Last Created</option>
        </select>
        <ul>
          {sortedEvents.map((event) => (
            <li key={event.event_id}>
              <button
                type="button"
                onClick={() => handleEventClick(event)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <strong>{event.event_name}</strong> - {event.event_location} (
                {formatDate(event.start_date)} to {formatDate(event.end_date)}){' '}
                {sortOption === 'duration' && (
                  <span>
                    [Duration:{' '}
                    {Math.abs(
                      new Date(event.end_date) - new Date(event.start_date),
                    ) /
                      (1000 * 3600 * 24)}{' '}
                    days]
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default EventForm;
