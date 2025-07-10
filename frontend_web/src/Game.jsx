// FULL UPDATED CODE BASED ON USER LOGIC
// ✅ Removed levels - now infinite run
// ✅ Zombie behavior changes based on score
// ✅ Max zombie health capped at 4
// ✅ Portal sacrifice auto-triggers on death

import React, { useRef, useEffect, useState, useCallback } from "react";
import PortalSacrifice from "./PortalSacrifice.jsx";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://tohyglycuoelcxayfdpa.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaHlnbHljdW9lbGN4YXlmZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMTA0OTIsImV4cCI6MjA2NDY4NjQ5Mn0.Aw6tHQ74yMarduOP7Kdk7OOV9GljbceWGk4OEAVw6LA"
);

async function submitScore(player, score) {
  await supabase.from("highscores").insert([{ player, score }]);
}

function Game({ coinValue = 2 }) {
  const [gameState, setGameState] = useState("menu");
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
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
      onKill: () => setKills(prev => prev + 1),
      onHUD: (hud) => {
        setScore(hud.score);
        setCoins(hud.coins);
      },
      onPlayerDie: () => {
        setGameState("over");
        pauseGame();
        submitScore("Player", score);
        setShowPortal(true);
      }
    });
    setKills(0);
    setShowPortal(false);
    setPaused(false);
    setPlayerEnabled(true);
    setGameState("running");
    setControl({ left: false, right: false, shoot: false, jump: false });
  }, [coinValue, pauseGame, score]);

  useAnimationFrame((ts) => {
    if (gameState === "running" && !paused && world.current && canvasRef.current) {
      world.current.update(control);
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

  const handlePortalSacrificeDone = (coinsEarned) => {
    if (!showPortal) return;
    setCoins(c => c + coinsEarned);
    setKills(0);
    setShowPortal(false);
    startGame();
  };

  const handleRestart = () => {
    setCoins(0);
    setScore(0);
    setKills(0);
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
    if (showPortal && kills > 0) {
      return (
        <div className="game-overlay">
          <PortalSacrifice 
            zombieCount={kills}
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
  constructor({ coinValue, onKill, onHUD, onPlayerDie }) {
    this.coinValue = coinValue;
    this.onKill = onKill;
    this.onHUD = onHUD;
    this.onPlayerDie = onPlayerDie;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.coins = 0;
    this.kills = 0;
    this.zombies = [this._spawnZombie()];
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

    // spawn more zombies constantly
    if (this.zombies.length < 5) {
      this.zombies.push(this._spawnZombie());
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
      score: this.score,
      coins: this.coins,
      zombies: this.kills,
    };
  }

  _spawnZombie() {
    const health = this._calculateHealth();
    const side = this._calculateSpawnSide();
    return {
      id: Math.random().toString(36),
      direction: side,
      health,
      dead: false
    };
  }

  _calculateHealth() {
    if (this.score < 800) return 1;
    if (this.score < 1600) return 2;
    const calculated = Math.floor(this.score / 800);
    return Math.min(4, calculated);
  }

  _calculateSpawnSide() {
    if (this.score < 800) return "left";
    return Math.random() > 0.5 ? "left" : "right";
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
