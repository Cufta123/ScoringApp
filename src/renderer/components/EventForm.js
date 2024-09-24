/* eslint-disable prettier/prettier */
import React, { useState } from 'react';

function EventForm() {
  const [eventName, setEventName] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');

  const handleSubmit = async () => {};

  return (
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
    </form>
  );
}
export default EventForm;
