import React, { useEffect, useState } from "react";
import PortalSacrifice from "./PortalSacrifice";

function Game() {
  const [kills, setKills] = useState(0);
  const [coins, setCoins] = useState(0);
  const [zombiesToSacrifice, setZombiesToSacrifice] = useState(0);
  const [zombiesSacrificed, setZombiesSacrificed] = useState(0);

  // Trigger sacrifice only when kills > 0
  useEffect(() => {
    if (kills > 0) {
      setZombiesToSacrifice(kills);
    }
  }, [kills]);

  const handleSacrificeComplete = (coinsAwarded) => {
    setCoins((prev) => prev + coinsAwarded);
    setZombiesSacrificed((prev) => prev + zombiesToSacrifice);
    setZombiesToSacrifice(0);
    setKills(0); // Reset kills only after sacrifice
  };

  return (
    <div className="neon-app-root">
      <div className="hud-container">
        <div className="hud-left hud-label">
          <span className="zombie-icon" />
          Kills: {kills}
        </div>
        <div className="hud-center hud-title">SCORE: {kills * 100}</div>
        <div className="hud-right">
          <div className="hud-label coins">
            <span className="coin-icon" />
            {coins}
          </div>
          <div className="hud-label">
            Zombies Sacrificed: {zombiesSacrificed}
          </div>
        </div>
      </div>

      {/* Simulated game area */}
      <div className="game-canvas-container">
        <PortalSacrifice
          zombieCount={zombiesToSacrifice}
          coins={coins}
          onSacrificeComplete={handleSacrificeComplete}
        />
      </div>

      {/* Dummy kill button for testing */}
      <div className="btn-panel">
        <button className="neon-btn" onClick={() => setKills((k) => k + 1)}>
          +1 Kill
        </button>
      </div>
    </div>
  );
}

export default Game;
