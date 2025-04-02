import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage/LandingPage';
import EventPage from './pages/EventPage/EventPage';
import HeatRacePage from './pages/HeatRacePage/HeatRacePage';
import LeaderboardPage from './pages/LeaderboardPage/LeaderBoardPage';
import LandingSailorPage from './pages/LandingSailorPage/LandingSailorPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/event/:name" element={<EventPage />} />
        <Route path="/event/:eventName/heat-race" element={<HeatRacePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/landingSailorList" element={<LandingSailorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
