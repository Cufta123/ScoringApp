/* eslint-disable prettier/prettier */
// src/pages/LandingPage/LandingPage.js
import React from 'react';


function LandingPage() {
  console.log("LandingPage component rendered");

  return (
    <div>
      <h1>Create a New Event</h1>
      <form>
        <input type="text" placeholder="Name" required />
        <input type="text" placeholder="Location" required />
        <input type="date" placeholder="Start Date" required />
        <input type="date" placeholder="End Date" required />
        <button type="submit">Create Event</button>
      </form>
    </div>
  );
}

export default LandingPage;
