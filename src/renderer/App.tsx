import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage/LandingPage';
import EventPage from './pages/EventPage/EventPage';
import ScoringPage from './pages/ScoringPage/ScoringPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/event/:name" element={<EventPage />} />
        <Route path="/event/:eventName/scoring" element={<ScoringPage />} />
      </Routes>
    </Router>
  );
}

export default App;
