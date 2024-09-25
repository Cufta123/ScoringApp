/* eslint-disable prettier/prettier */
// src/pages/LandingPage/LandingPage.js
import React from 'react';
import EventForm from '../../components/EventForm';


function LandingPage() {
  console.log("LandingPage component rendered");

  return (
    <div>
      <h1>Create a New Event</h1>
      <EventForm />
    </div>
  );
}

export default LandingPage;
