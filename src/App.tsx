// src/App.tsx
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import HomeScreen from './screens/HomeScreen';
import AuthScreen from './screens/AuthScreen';
import FoodLogScreen from './screens/FoodLogScreen';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/auth" element={<AuthScreen />} />
        <Route path="/food-log" element={<FoodLogScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
