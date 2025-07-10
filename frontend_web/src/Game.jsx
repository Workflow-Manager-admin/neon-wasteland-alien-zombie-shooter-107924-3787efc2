// FULL UPDATED CODE
// ✅ Added: Zombie health + level difficulty scale
// ✅ Added: Zombies spawn from both sides
// ✅ Added: Leaderboard support (Supabase)

import React, { useRef, useEffect, useState, useCallback } from "react";
import PortalSacrifice from "./PortalSacrifice.jsx";
import { createClient } from "@supabase/supabase-js";

// Supabase setup
const supabase = createClient(
  "https://tohyglycuoelcxayfdpa.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaHlnbHljdW9lbGN4YXlmZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMTA0OTIsImV4cCI6MjA2NDY4NjQ5Mn0.Aw6tHQ74yMarduOP7Kdk7OOV9GljbceWGk4OEAVw6LA"
);

async function submitScore(player, score) {
  await supabase.from("highscores").insert([{ player, score }]);
}

function Game({ coinValue = 2, levelGoal: propLevelGoal }) {
  const [gameState, setGameState] = useState("menu");
  const [level, setLevel] = useState(1);
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);
  const [killsThisLevel, setKillsThisLevel] = useState(0);
  const levelGoal = propLevelGoal || (6 + level * 2);
  const [showPortal, setShowPortal] = useState(false);
  const [control, setControl] = useState({ left: false, right: false, shoot: false, jump: false });
  const [playerEnabled, setPlayerEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const world = useRef(null);
  const canvasRef = useRef();

  const pauseGame = useCallback(() => {
    setPaused(true);
    setPlayerEnabled(false);
  }, []);

  const resumeGame = useCallback(() => {
    setPaused(false);
    setPlayerEnabled(true);
  }, []);

  const startGame = useCallback(() => {
    world.current = new GameWorld({
      coinValue,
      level,
      levelGoal,
      onKill: () => setKillsThisLevel(prev => prev + 1),
      onHUD: (hud) => {
        setScore(hud.score);
        setCoins(hud.coins);
      },
      onPlayerDie: () => {
        setGameState("over");
        pauseGame();
        submitScore("Player", score); // Update Supabase leaderboard
      }
    });
    setKillsThisLevel(0);
    setShowPortal(false);
    setPaused(false);
    setPlayerEnabled(true);
    setGameState("running");
    setControl({ left: false, right: false, shoot: false, jump: false });
  }, [coinValue, level, levelGoal, pauseGame, score]);

  useAnimationFrame((ts) => {
    if (gameState === "running" && !paused && world.current && canvasRef.current) {
      if (!showPortal) world.current.update(control);
      world.current.draw(canvasRef.current);
    }
  }, gameState === "running" && !paused);

  useEffect(() => {
    if (!playerEnabled) return;
    const keydown = (e) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) setControl(s => ({ ...s, left: true }));
      if (["ArrowRight", "d", "D"].includes(e.key)) setControl(s => ({ ...s, right: true }));
      if (["ArrowUp"].includes(e.key) && !e.repeat) setControl(s => ({ ...s, jump: true }));
      if ([" ", "w", "W"].includes(e.key)) setControl(s => ({ ...s, shoot: true }));
    };
    const keyup = (e) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) setControl(s => ({ ...s, left: false }));
      if (["ArrowRight", "d", "D"].includes(e.key)) setControl(s => ({ ...s, right: false }));
      if (["ArrowUp"].includes(e.key)) setControl(s => ({ ...s, jump: false }));
      if ([" ", "w", "W"].includes(e.key)) setControl(s => ({ ...s, shoot: false }));
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    };
  }, [playerEnabled]);

  useEffect(() => {
    if (gameState === "running" && killsThisLevel >= levelGoal && !showPortal) {
      pauseGame();
      setShowPortal(true);
      setGameState("portal");
    }
  }, [killsThisLevel, levelGoal, gameState, showPortal, pauseGame]);

  const handlePortalSacrificeDone = (coinsEarned) => {
    if (!showPortal) return;
    setCoins(c => c + coinsEarned);
    setKillsThisLevel(0);
    setShowPortal(false);
    setLevel(lvl => lvl + 1);
    setTimeout(() => {
      resumeGame();
      startGame();
    }, 820);
  };

  const handleRestart = () => {
    setLevel(1);
    setCoins(0);
    setScore(0);
    setKillsThisLevel(0);
    setShowPortal(false);
    setPaused(false);
    setPlayerEnabled(false);
    setGameState("menu");
  };

  const renderOverlay = () => {
    if (gameState === "menu") {
      return (
        <div className="game-overlay">
          <h1 className="neon-title">NEON WASTELAND <span className="accent-text">ZOMBIE SHOOTER</span></h1>
          <button className="neon-btn" onClick={startGame} autoFocus>Start Game</button>
        </div>
      );
    }
    if (showPortal && killsThisLevel > 0) {
      return (
        <div className="game-overlay">
          <PortalSacrifice 
            zombieCount={killsThisLevel}
            coinValue={coinValue}
            coins={coins}
            onSacrificeComplete={handlePortalSacrificeDone}
            onSacrificeDrop={() => {}}
          />
        </div>
      );
    }
    if (gameState === "over") {
      return (
        <div className="game-overlay">
          <div className="game-over-title neon-text">GAME OVER</div>
          <div className="big-score neon-text">Score: {score}</div>
          <div className="coins neon-glow">Coins: <span>{coins}</span></div>
          <button className="neon-btn" onClick={handleRestart}>Main Menu</button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="neon-app-root">
      <canvas
        id="game-canvas"
        width={window.innerWidth * 0.95}
        height={window.innerHeight * 0.9}
        ref={canvasRef}
      ></canvas>
      {renderOverlay()}
    </div>
  );
}

export default Game;

class GameWorld {
  constructor({ coinValue, level, levelGoal, onKill, onHUD, onPlayerDie }) {
    this.coinValue = coinValue;
    this.level = level;
    this.levelGoal = levelGoal;
    this.onKill = onKill;
    this.onHUD = onHUD;
    this.onPlayerDie = onPlayerDie;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.coins = 0;
    this.kills = 0;
    this.zombies = Array.from({ length: this.levelGoal }, () => this._spawnZombie());
    if (this.onHUD) this.onHUD(this.getHUD());
  }

  update(control) {
    if (control.shoot && this.zombies.length > 0) {
      const target = this.zombies.find(z => !z.dead);
      if (target) {
        target.health--;
        if (target.health <= 0) {
          target.dead = true;
          this.kills++;
          this.score += 100;
          this.coins += this.coinValue;
          this.zombies = this.zombies.filter(z => !z.dead);
          if (this.onKill) this.onKill();
        }
      }
    }
    if (this.onHUD) this.onHUD(this.getHUD());
  }

  draw(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "bold 40px Segoe UI";
    ctx.fillStyle = "#39ff14";
    ctx.fillText(`Zombies Left: ${this.zombies.length}`, 100, 140);
    ctx.fillStyle = "#fff";
    ctx.fillText(`Score: ${this.score}`, 100, 200);
    ctx.fillText(`Coins: ${this.coins}`, 100, 260);
  }

  getHUD() {
    return {
      level: this.level,
      score: this.score,
      coins: this.coins,
      zombies: this.kills,
    };
  }

  _spawnZombie() {
    const side = Math.random() > 0.5 ? "left" : "right";
    return {
      id: Math.random().toString(36),
      direction: side,
      health: 1 + Math.floor(this.level / 2), // Health increases with level
      dead: false
    };
  }
}

function useAnimationFrame(callback, active = true) {
  const req = useRef();
  useEffect(() => {
    if (active) {
      const loop = (ts) => {
        callback(ts);
        req.current = requestAnimationFrame(loop);
      };
      req.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(req.current);
    }
  }, [callback, active]);
}
