import React, { useRef, useEffect, useState, useCallback } from "react";
import PortalSacrifice from "./PortalSacrifice.jsx";

/**
 * PUBLIC_INTERFACE
 * 
 * Game.jsx — Main game logic and loop.
 * Handles:
 *   - Per-level killsThisLevel tracking
 *   - Level goal and completion
 *   - Portal and PortalSacrifice triggering & flow
 *   - pauseGame/resumeGame: disables player input & enemy spawn/AI
 * 
 * Props:
 *   coinValue: coins rewarded per zombie (default 2)
 *   levelGoal: Optional, overrides default zombiesToJuice formula
 */
function Game({ coinValue = 2, levelGoal: propLevelGoal }) {
  // Game state
  const [gameState, setGameState] = useState("menu"); // menu | running | paused | portal | over
  const [level, setLevel] = useState(1);
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);

  // Kills this level (reset only at PortalSacrifice completion)
  const [killsThisLevel, setKillsThisLevel] = useState(0);

  // Level target (number of zombies to "juice")
  const levelGoal = propLevelGoal || (6 + level * 2);

  // Is the portal to sacrifice being shown?
  const [showPortal, setShowPortal] = useState(false);

  // Control states
  const [control, setControl] = useState({ left: false, right: false, shoot: false, jump: false });
  const [playerEnabled, setPlayerEnabled] = useState(false);

  // For controlling game loop
  const [paused, setPaused] = useState(false);

  // World is a ref to avoid rerender loop
  const world = useRef(null);
  const canvasRef = useRef();

  // Helper: Pause, disables input, AI, zombie spawn, etc
  // PUBLIC_INTERFACE
  const pauseGame = useCallback(() => {
    setPaused(true);
    setPlayerEnabled(false);
    // Optionally, freeze zombies: world.current?.pauseAI()
  }, []);
  // PUBLIC_INTERFACE
  const resumeGame = useCallback(() => {
    setPaused(false);
    setPlayerEnabled(true);
    // Optionally, resume zombies: world.current?.resumeAI()
  }, []);

  // Start/reset game for a level
  const startGame = useCallback(() => {
    // Reset the world state class instance
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
      }
    });
    setKillsThisLevel(0);
    setShowPortal(false);
    setPaused(false);
    setPlayerEnabled(true);
    setGameState("running");
    // New input state
    setControl({ left: false, right: false, shoot: false, jump: false });
  }, [coinValue, level, levelGoal, pauseGame]);

  // --- Game Loop (runs only while running and not paused, or briefly during portal closing)
  useAnimationFrame((ts) => {
    if (gameState === "running" && !paused && world.current && canvasRef.current) {
      if (!showPortal) {
        world.current.update(control);
      }
      world.current.draw(canvasRef.current);
    }
  }, gameState === "running" && !paused);

  // Keyboard/onscreen controls (disable when paused or portal open)
  useEffect(() => {
    if (!playerEnabled) return;
    const keydown = (e) => {
      if (!playerEnabled) return;
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

  // Level kill/portal logic
  useEffect(() => {
    // Only trigger portal when NOT already showing
    if (
      gameState === "running" &&
      killsThisLevel >= levelGoal &&
      !showPortal
    ) {
      // Trigger portal sequence: game pauses, overlay takes over, zombies stop
      pauseGame(); // disables update loop and input
      setShowPortal(true); // triggers overlay
      setGameState("portal"); // explicit portal state for transition guards
      // No further spawns or resets possible until overlay completes
    }
  }, [killsThisLevel, levelGoal, gameState, showPortal, pauseGame]);

  // Never spawn while portal is open and paused (game loop & world.update do nothing if showPortal)
  // World should also stop spawning internally, but this is extra guard.

  // Mobile/onscreen controls
  const handleTouch = (type, enable) => {
    if (!playerEnabled) return;
    if (type === 'left') setControl(s => ({ ...s, left: enable }));
    if (type === 'right') setControl(s => ({ ...s, right: enable }));
    if (type === 'shoot') setControl(s => ({ ...s, shoot: enable }));
    if (type === 'jump') setControl(s => ({ ...s, jump: enable }));
  };

  const handleButtonClick = (type) => {
    if (!playerEnabled) return;
    if (type === 'shoot') {
      setControl(s => ({ ...s, shoot: true }));
      setTimeout(() => setControl(s => ({ ...s, shoot: false })), 80);
    }
    if (type === 'jump') {
      setControl(s => ({ ...s, jump: true }));
      setTimeout(() => setControl(s => ({ ...s, jump: false })), 120);
    }
  };

  // Handler: PortalSacrifice completion (zombies payout coins & advance level)
  // Called ONLY after full animation, not before (do not reset killsThisLevel until after this!)
  // All transitions are atomic: coins/score only update after overlay completes, not before. This preserves "live" state on overlay
  const handlePortalSacrificeDone = (coinsEarned) => {
    // Prevent accidental double triggers: only run if portal is visible
    if (!showPortal) return;

    setCoins(c => c + coinsEarned);         // Coins are awarded after sacrifice, not before
    setKillsThisLevel(0);                   // Reset kill counter for new level
    setShowPortal(false);                   // Overlay clears
    setLevel(lvl => lvl + 1);               // Advance the level!
    // Resume next level after short delay for satisfaction (must NOT allow spawns or AI prior)
    setTimeout(() => {
      resumeGame();                         // Unlock input/AI
      startGame();                          // Triggers new GameWorld, new zombies, etc.
    }, 820);
  };

  // Handler: restart after game over
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

  // Render logic
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
      // PortalSacrifice overlay takes over—while visible, game world is hard-paused, no transitions or respawns possible
      // Live kill count and coins are preserved/only updated on completion event
      return (
        <div className="game-overlay">
          <PortalSacrifice 
            zombieCount={killsThisLevel}
            coinValue={coinValue}
            coins={coins}
            onSacrificeComplete={handlePortalSacrificeDone}
            onSacrificeDrop={() => {}} // Optional: animate
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

  // HUD component
  const HUD = () => (
    <div className="hud-container">
      <div className="hud-left">
        <div className="hud-label">
          <span className="zombie-icon"/> x {killsThisLevel} / {levelGoal}
        </div>
      </div>
      <div className="hud-center">
        <div className="hud-title">LEVEL {level}</div>
      </div>
      <div className="hud-right" style={{ flexDirection: "column", alignItems: "flex-end" }}>
        <div className="hud-label coins">
          <span className="coin-icon"/> {coins}
        </div>
        <p style={{
          margin: "2px 0 0 0",
          color: "#39ff14",
          fontWeight: 600,
          fontSize: "0.95em",
          textShadow: "0 0 5px #39ff14c7",
          letterSpacing: ".01em"
        }}>
          Zombies Killed This Level: {killsThisLevel}
        </p>
      </div>
    </div>
  );

  function NeonControls() {
    return (
      <div className="btn-panel">
        <button
          className="neon-control-btn"
          tabIndex={-1}
          aria-label="Move Left"
          onTouchStart={() => handleTouch('left', true)}
          onTouchEnd={() => handleTouch('left', false)}
          onMouseDown={() => handleTouch('left', true)}
          onMouseUp={() => handleTouch('left', false)}
          disabled={!playerEnabled}
        >◀</button>
        <button
          className="neon-control-btn"
          tabIndex={-1}
          aria-label="Jump"
          onTouchStart={() => handleButtonClick('jump')}
          onClick={() => handleButtonClick('jump')}
          disabled={!playerEnabled}
        >▲</button>
        <button
          className="neon-control-btn"
          tabIndex={-1}
          aria-label="Move Right"
          onTouchStart={() => handleTouch('right', true)}
          onTouchEnd={() => handleTouch('right', false)}
          onMouseDown={() => handleTouch('right', true)}
          onMouseUp={() => handleTouch('right', false)}
          disabled={!playerEnabled}
        >▶</button>
        <button
          className="neon-control-btn neon-btn-accent"
          tabIndex={-1}
          aria-label="Shoot"
          onTouchStart={() => handleButtonClick('shoot')}
          onClick={() => handleButtonClick('shoot')}
          disabled={!playerEnabled}
        >
          <span role="img" aria-label="Gun">&#128299;</span>
        </button>
      </div>
    );
  }

  return (
    <div className="neon-app-root">
      <HUD />
      <div className="game-canvas-container">
        <canvas
          id="game-canvas"
          width={800}
          height={600}
          ref={canvasRef}
          tabIndex={1}
          aria-label="Game Canvas"
        ></canvas>
        {renderOverlay()}
      </div>
      <NeonControls />
      <footer className="footer-note">2024 &copy; Neon Wasteland Alien Zombie Shooter</footer>
    </div>
  );
}

export default Game;


/**
 * Minimal game world for demonstration of killsThisLevel, levelGoal, spawn gating and pausing.
 * Replace/migrate with richer logic as needed — this is the game engine for the game loop.
 */
class GameWorld {
  constructor({ coinValue, level, levelGoal, onKill, onHUD, onPlayerDie }) {
    this.coinValue = coinValue || 2;
    this.level = level || 1;
    this.levelGoal = levelGoal || (6 + this.level * 2);
    this.onKill = onKill;
    this.onHUD = onHUD;
    this.onPlayerDie = onPlayerDie;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.coins = 0;
    this.kills = 0;
    this.spawnPaused = false;
    this.zombies = [];
    this.spawnCooldown = 0;
    // ... any additional state needed per level
    // Spawn all zombies for the level at once (to match simple example)
    for (let i = 0; i < this.levelGoal; ++i) {
      this.zombies.push(this._spawnZombie());
    }
    if (this.onHUD) this.onHUD(this.getHUD());
  }

  // PUBLIC_INTERFACE
  update(control) {
    // Pause AI & spawning if portal is open (handled in parent too, for double lock)
    if (this.spawnPaused) return;

    // -- Player logic, AI, handle movement, etc. skipped for brevity --

    // -- Bullet/zombie collision logic simulation --
    // For demonstration, we simulate random zombie kills:
    // (REPLACE with real gameplay: bullet vs zombie collision detection)
    // We don't want to auto-kill all, only if shoot was pressed
    if (control.shoot && this.zombies.length > 0) {
      // Remove one zombie as "killed"
      this.zombies.pop();
      this.kills++;
      this.score += 100;
      this.coins += this.coinValue;
      if (this.onKill) this.onKill();
    }
    if (this.onHUD) this.onHUD(this.getHUD());
    // Add win logic here if needed, e.g., when kills === this.levelGoal
  }

  // PUBLIC_INTERFACE
  draw(canvas) {
    // Simple render: gray background and zombie counter
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "bold 40px Segoe UI, Arial";
    ctx.fillStyle = "#39ff14";
    ctx.fillText(`Zombies Left: ${this.zombies.length}`, 100, 140);
    ctx.fillStyle = "#aa2c69";
    ctx.fillText(`Kills: ${this.kills}`, 100, 200);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px Segoe UI, Arial";
    ctx.fillText(`Coins: ${this.coins}`, 100, 320);
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
    return {
      id: Math.random().toString(36),
      // ... zombie properties
    };
  }
}

/**
 * Simple animation frame trottle hook.
 * PUBLIC_INTERFACE
 */
function useAnimationFrame(callback, active = true) {
  const req = useRef();
  useEffect(() => {
    if (active) {
      let anim = (ts) => {
        callback(ts);
        req.current = requestAnimationFrame(anim);
      };
      req.current = requestAnimationFrame(anim);
      return () => cancelAnimationFrame(req.current);
    }
  }, [callback, active]);
}
