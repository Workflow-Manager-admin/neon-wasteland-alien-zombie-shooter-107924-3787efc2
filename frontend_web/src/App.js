import React, { useEffect } from 'react';
import './App.css';
import Game from './Game.jsx';

// PUBLIC_INTERFACE
function App() {
  // Log App mount for debug
  useEffect(() => {
    console.log("[App.js] MOUNTED");
  }, []);
  // Only render Game as the single root child.
  return <Game />;
}

export default App;
