import React, { useState } from "react";
import GameWorld from "./GameWorld.js";
import PortalSacrifice from "./PortalSacrifice.jsx";
import "./styles.css";

/**
 * PUBLIC_INTERFACE
 * App - Root component for Neon Wasteland Zombie Shooter game
 */
function App() {
  // Top-level game state controller hooks
  // States: 'menu', 'running', 'level_completed', 'gameover', 'portal_sacrifice'
  const [gameMode, setGameMode] = useState("menu");
  const [level, setLevel] = useState(1);
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);
  const [killsThisLevel, setKillsThisLevel] = useState(0);
  const [levelGoal, setLevelGoal] = useState(6 + 1 * 2);
  const [showPortal, setShowPortal] = useState(false);
  const [portalAnimProps, setPortalAnimProps] = useState({ zombieCount: 0, coinValue: 2, startCoins: 0 });

  // Handle new game
  const startNewGame = () => {
    setCoins(0);
    setScore(0);
    setGameMode("running");
    setLevel(1);
    setLevelGoal(8);
    setKillsThisLevel(0);
    setShowPortal(false);
  };

  // Reacts to HUD events from GameWorld
  const handleHUDUpdate = ({ level, score, coins, kills, levelGoal }) => {
    setLevel(level);
    setScore(score);
    setCoins(coins);
    setKillsThisLevel(kills);
    setLevelGoal(levelGoal);
  };

  // Called by GameWorld on player death
  const handleGameOver = () => {
    setGameMode("gameover");
    setShowPortal(false);
  };

  // Called by GameWorld when level is completed (hits kill target exactly)
  const handleLevelComplete = (kills, goal, coinValue, currentCoins) => {
    setGameMode("portal_sacrifice");
    setShowPortal(true);
    setPortalAnimProps({
      zombieCount: kills,
      coinValue,
      startCoins: currentCoins,
    });
  };

  // Called by PortalSacrifice once the coin animation is finished (awards coins, bumps level)
  const handlePortalSacrificeDone = (coinsEarned) => {
    setCoins(c => c + coinsEarned);
    setKillsThisLevel(0);
    setLevel(lvl => lvl + 1);
    setLevelGoal(lg => 6 + (level + 1) * 2);
    setShowPortal(false);
    setTimeout(() => {
      setGameMode("running");
    }, 320); // small polish delay for effect satisfaction
  };

  // On menu/gameover "Start" click
  const handleMenuStart = () => {
    startNewGame();
  };

  // Output: overlays and main game
  return (
    <div className="neon-app-root">
      <header>
        {/* HUD displayed as part of GameWorld */}
      </header>
      <main>
        {gameMode === "menu" && (
          <div className="game-overlay" style={{ zIndex: 150 }}>
            <h1 className="neon-title" tabIndex={0}>NEON WASTELAND <span className="accent-text">ZOMBIE SHOOTER</span></h1>
            <p className="subtitle neon-text">Side-scroll, shoot, and survive the apocalypse!</p>
            <button
              className="neon-btn"
              aria-label="Start Game"
              autoFocus
              onClick={handleMenuStart}
            >Start Game</button>
            <section className="howto-container" aria-label="How to Play">
              <p>Move: <kbd>←</kbd> / <kbd>→</kbd> or <kbd>A</kbd>/<kbd>D</kbd></p>
              <p>Shoot: <kbd>Space</kbd> or <kbd>W</kbd>/<kbd>↑</kbd></p>
              <p>Jump: <kbd>↑</kbd> (Up Arrow)</p>
              <p>Or use the neon buttons below (mobile friendly!)</p>
            </section>
          </div>
        )}

        {gameMode === "portal_sacrifice" && showPortal && (
          <div className="game-overlay" style={{ zIndex: 101 }}>
            <PortalSacrifice
              zombieCount={portalAnimProps.zombieCount}
              coinValue={portalAnimProps.coinValue}
              coins={portalAnimProps.startCoins}
              onSacrificeDrop={() => {}}
              onSacrificeComplete={handlePortalSacrificeDone}
            />
          </div>
        )}

        {gameMode === "gameover" && (
          <div className="game-overlay" style={{ zIndex: 150 }}>
            <div className="game-over-title neon-text">GAME OVER</div>
            <div className="big-score neon-text">Score: {score}</div>
            <div className="coins neon-glow">Coins: <span>{coins}</span></div>
            <button className="neon-btn" aria-label="Restart" onClick={handleMenuStart}>Restart</button>
          </div>
        )}

        {(gameMode === "running" || gameMode === "portal_sacrifice") && (
          <GameWorld
            running={gameMode === "running"}
            level={level}
            coins={coins}
            onHUD={handleHUDUpdate}
            onGameOver={handleGameOver}
            onLevelComplete={handleLevelComplete}
            killsThisLevel={killsThisLevel}
            levelGoal={levelGoal}
          />
        )}
      </main>
      <footer className="footer-note" tabIndex={0}>
        2024 &copy; Neon Wasteland Alien Zombie Shooter
      </footer>
    </div>
  );
}

export default App;
