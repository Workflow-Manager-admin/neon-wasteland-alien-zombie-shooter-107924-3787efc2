import React, { useRef, useEffect, useState } from 'react';
import './App.css';
import PortalSacrifice from './PortalSacrifice.jsx';

// Neon theme variables
const THEME = {
  accent: '#aa2c69',
  primary: '#39ff14',
  secondary: '#1a1a1a',
  white: '#fff',
  canvasWidth: 800,
  canvasHeight: 600,
};

/**
 * The only zombie type: green zombie.
 * All gameplay, UI, and coin logic is tied to this type.
 */
const zombieTypes = [
  {
    name: "green",
    color: "#6efd9a",
    shadow: "#39ff1475",
    head: "#161e13",
    eyes: "#fb73fa",
    speed: 1.2,
    w: 44,
    h: 62,
    coins: 2,
    labelColor: "#39ff14",
    label: "+2",
  }
];

// Helper for controlling frame rate
const useAnimationFrame = (callback, isRunning = true) => {
  const req = useRef();
  const animate = time => {
    callback(time);
    req.current = requestAnimationFrame(animate);
  };
  useEffect(() => {
    if (isRunning) {
      req.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(req.current);
    }
  });
};

// PUBLIC_INTERFACE
function App() {
  // ================= GAME STATE HOOKS FOR ENDLESS SCORE-BASED MODE ===================
  const [gameState, setGameState] = useState('menu'); // menu | running | sacrifice | over
  const [hud, setHud] = useState({
    score: 0, coins: 0, kills: 0,
  });
  // Track a session key to force React to unmount and remount the canvas/container (prevents lingering styles)
  const [gameSession, setGameSession] = useState(0);
  // Tracks how many zombies ever sacrificed
  const [zombiesSacrificed, setZombiesSacrificed] = useState(0);
  // Tracks zombies killed in the current run (awarded on death)
  const [zombiesKilledThisRun, setZombiesKilledThisRun] = useState(0);
  // Sacrifice overlay state
  const [activeSacrifice, setActiveSacrifice] = useState({
    show: false,
    count: 0,
    coins: 0,
    coinValue: 2,
    liveZombiesSacrificed: 0,
    liveCoinsEarned: 0,
    floats: [],
  });
  // Mobile/responsive controls
  const [control, setControl] = useState({ left: false, right: false, shoot: false, jump: false });
  const [mobile, setMobile] = useState(false);

  // Main canvas and game world refs
  const canvasRef = useRef();
  const world = useRef(null);
  // For overlay process locking
  const overlayActiveRef = useRef(false);

  // Responsive mobile detection
  useEffect(() => {
    setMobile(window.innerWidth < 900);
    const onResize = () => setMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Start/reset game with endless score-based logic
  const startGame = () => {
    // Bump session key to force React to remount game area/canvas
    setGameSession(s => s + 1);

    world.current = new EndlessGameWorld(THEME, (hudObj) => {
      setHud(hudObj);
      setZombiesKilledThisRun(hudObj.kills || 0);
    }, () => {
      // On death
      setGameState('sacrifice');
      setActiveSacrifice((prev) => ({
        ...prev,
        show: true,
        count: zombiesKilledThisRun,
        coins: hud.coins,
        coinValue: 2,
        liveZombiesSacrificed: 0,
        liveCoinsEarned: 0,
        floats: []
      }));
    });
    setActiveSacrifice({
      show: false,
      count: 0,
      coins: 0,
      coinValue: 2,
      liveZombiesSacrificed: 0,
      liveCoinsEarned: 0,
      floats: []
    });
    setGameState('running');
    setControl({ left: false, right: false, shoot: false, jump: false });
    setZombiesKilledThisRun(0);
  };

  // Endless game loop
  useAnimationFrame((ts) => {
    if (
      gameState === 'running' &&
      canvasRef.current &&
      world.current
    ) {
      world.current.update(control);
      world.current.draw(canvasRef.current);
    }
    // Draw final state for sacrifice overlay
    if (
      (gameState === 'sacrifice' && activeSacrifice.show && world.current && canvasRef.current)
    ) {
      world.current.draw(canvasRef.current);
    }
  }, gameState === 'running' || (gameState === 'sacrifice' && activeSacrifice.show));

  // Keyboard controls (lock if overlay)
  useEffect(() => {
    const keydown = (e) => {
      if (
        (gameState !== 'running') ||
        (activeSacrifice.show && gameState === 'sacrifice')
      ) return;
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
  }, [gameState, activeSacrifice.show]);

  // On-screen control handler for mobile
  const handleTouch = (type, enable) => {
    if (activeSacrifice.show && gameState === 'sacrifice') return;
    if (type === 'left') setControl(s => ({ ...s, left: enable }));
    if (type === 'right') setControl(s => ({ ...s, right: enable }));
    if (type === 'shoot') setControl(s => ({ ...s, shoot: enable }));
    if (type === 'jump') setControl(s => ({ ...s, jump: enable }));
  };

  // Mobile tap: shoot/jump
  const handleButtonClick = (type) => {
    if (activeSacrifice.show && gameState === 'sacrifice') return;
    if (type === 'shoot') {
      setControl(s => ({ ...s, shoot: true }));
      setTimeout(() => setControl(s => ({ ...s, shoot: false })), 80);
    }
    if (type === 'jump') {
      setControl(s => ({ ...s, jump: true }));
      setTimeout(() => setControl(s => ({ ...s, jump: false })), 120);
    }
  };

  // Floating "+N" label remover for sacrifice overlay
  useEffect(() => {
    if (activeSacrifice.floats.length > 0) {
      const timer = setTimeout(() => {
        setActiveSacrifice(prev =>
          ({ ...prev, floats: prev.floats.length ? prev.floats.slice(1) : [] })
        );
      }, 1060);
      return () => clearTimeout(timer);
    }
  }, [activeSacrifice.floats]);

  // --- Overlay renderer ---
  const Overlay = () => {
    // Menu overlay
    if (gameState === 'menu') {
      return (
        <div className="game-overlay">
          <h1 className="neon-title">NEON WASTELAND <span className="accent-text">ZOMBIE SHOOTER</span></h1>
          <p className="subtitle neon-text">Side-scroll, shoot, and survive the apocalypse!<br />Endless run: No levels. Kill zombies, gain coins, survive as long as you can.</p>
          <button className="neon-btn" onClick={startGame} autoFocus>Start Game</button>
          <div className="howto-container">
            <p>Move: <kbd>←</kbd> / <kbd>→</kbd> or <kbd>A</kbd>/<kbd>D</kbd></p>
            <p>Shoot: <kbd>Space</kbd> or <kbd>W</kbd>/<kbd>↑</kbd></p>
            <p>Jump: <kbd>↑</kbd> (Up Arrow)</p>
            <p>Or use the neon buttons below (mobile friendly!)</p>
          </div>
        </div>
      );
    }
    // Sacrifice overlay with kills > 0
    if (activeSacrifice.show && gameState === 'sacrifice' && activeSacrifice.count > 0) {
      // Handles zombie drop animation and live updating
      const onSacrificeDrop = (zNum) => {
        setActiveSacrifice(prev => ({
          ...prev,
          liveZombiesSacrificed: prev.liveZombiesSacrificed + 1,
          liveCoinsEarned: prev.liveCoinsEarned + prev.coinValue,
          floats: [...prev.floats, { id: Date.now() + Math.random(), value: '+' + prev.coinValue }]
        }));
      };

      // When the portal sacrifice animation is complete
      const onSacrificeComplete = (totalCoins) => {
        // Prevent double-trigger
        if (overlayActiveRef.current) return;
        overlayActiveRef.current = true;

        // Award coins, finalize stats for this run
        setZombiesSacrificed(prev => prev + activeSacrifice.count);
        setHud(hudPrev => ({
          ...hudPrev,
          coins: hudPrev.coins + totalCoins,
          kills: 0,
        }));

        setActiveSacrifice(prev => ({
          ...prev,
          show: false,
          count: 0,
          liveZombiesSacrificed: 0,
          liveCoinsEarned: 0,
          floats: [],
        }));

        // Show Game Over overlay after delay (matching sacrifice float away)
        setTimeout(() => {
          setZombiesKilledThisRun(0);
          overlayActiveRef.current = false;
          setGameState('over');
        }, 1280);
      };

      const liveZombiesSacrificed = activeSacrifice.liveZombiesSacrificed;
      const liveCoins = activeSacrifice.coins + activeSacrifice.liveCoinsEarned;

      return (
        <div className="game-overlay">
          <PortalSacrifice
            zombieCount={activeSacrifice.count}
            coinValue={activeSacrifice.coinValue}
            coins={activeSacrifice.coins}
            onSacrificeDrop={onSacrificeDrop}
            onSacrificeComplete={onSacrificeComplete}
          />
          <div className="big-score neon-text" style={{ marginTop: '1em' }}>
            Zombies Sacrificed: {zombiesSacrificed + liveZombiesSacrificed}
          </div>
          <div className="coins neon-glow">Coins: <span>{liveCoins}</span></div>
          {/* Floating "+N" coins stack */}
          <div style={{
            position: "absolute", left: "50%", top: "48%", width: 180, transform: "translate(-50%, 0)", pointerEvents: "none"
          }}>
            {activeSacrifice.floats.map(f =>
              <div
                key={f.id}
                style={{
                  color: "#ffef50",
                  fontWeight: "bold",
                  textShadow: "0 0 15px #fff944, 0 0 30px #aa2c695c, 0 1px 2px #181925",
                  fontSize: "1.7em",
                  marginBottom: "-15px",
                  animation: "portal-float-up 1s cubic-bezier(.62,.09,.51,1.01)",
                  pointerEvents: "none",
                  opacity: 0.91,
                }}>
                {f.value} <span style={{
                  display: "inline-block",
                  width: "1.1em",
                  height: "1.1em",
                  background: "radial-gradient(ellipse at 60% 35%,#ffef50 90%,#aa2c69 130%)",
                  boxShadow: "0 0 12px #f3f14b99",
                  borderRadius: "50%",
                  border: "2px solid #7d6c28",
                  marginLeft: 3,
                  verticalAlign: "middle",
                }} />
              </div>
            )}
          </div>
        </div>
      );
    }
    // If player dies but there are no kills this run, skip overlay quickly
    if (gameState === 'sacrifice' && (!activeSacrifice.count || zombiesKilledThisRun === 0)) {
      setTimeout(() => {
        setZombiesKilledThisRun(0);
        setGameState('over');
      }, 700);
      return (
        <div className="game-overlay neon-text">
          No zombies to sacrifice!
        </div>
      );
    }
    // GAME OVER overlay: show after sacrifice animation, present final run/journey stats
    if (gameState === 'over') {
      return (
        <div className="game-overlay">
          <div style={{
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#181925e3",
            borderRadius: "16px",
            boxShadow: "0 0 35px #39ff1498, 0 2px 16px #aa2c694a",
            padding: "3rem 4rem",
            minWidth: "65vw",
            minHeight: "45vh",
            gap: "2em",
            border: "2.5px solid #39ff14"
          }}>
            <div className="game-over-title neon-text" style={{
              textShadow: "0 0 22px #aa2c69, 0 0 30px #39ff149c"
            }}>GAME OVER</div>
            <div className="big-score neon-text">Final Score: <span style={{ color: "#fff" }}>{hud.score}</span></div>
            <div className="coins neon-glow" style={{ fontSize: "1.24em" }}>Coins: <span>{hud.coins}</span></div>
            <div className="neon-text" style={{
              color: "var(--neon-primary)",
              marginBottom: "1.2em",
              fontSize: "1.14em"
            }}>
              Zombies Sacrificed: <span style={{ color: "var(--neon-accent)", fontWeight: 600 }}>{zombiesSacrificed}</span>
            </div>
            <button
              className="neon-btn"
              style={{
                fontSize: "1.4em",
                marginTop: "2.4em",
                padding: "0.9em 3.3em",
                background: "var(--neon-accent)",
                color: "#fff",
                borderRadius: "17px",
                boxShadow:
                  "0 0 28px #aa2c69,0 0 12px #39ff14cc, 0 1.5px 16px #39ff1424 inset, 0 0 25px #fff3",
                textShadow: "0 0 16px #fff9, 0 0 13px #39ff14bb",
                fontWeight: 800,
                letterSpacing: "0.16em",
                outline: "none",
                border: "none",
                transition: "background 0.13s, box-shadow 0.18s",
                cursor: "pointer",
                filter: "drop-shadow(0 0 30px #39ff1422)",
              }}
              autoFocus
              onClick={() => {
                setHud({ score: 0, coins: 0, kills: 0 });
                setZombiesSacrificed(0);
                setZombiesKilledThisRun(0);
                setActiveSacrifice({
                  show: false,
                  count: 0,
                  coins: 0,
                  coinValue: 2,
                  liveZombiesSacrificed: 0,
                  liveCoinsEarned: 0,
                  floats: []
                });
                setControl({ left: false, right: false, shoot: false, jump: false });

                // bump gameSession and run game reset
                setTimeout(() => {
                  startGame();
                }, 80);
              }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // HUD for endless mode: only score, coins, kills
  // HUD should be fully hidden when the game is over or in a full overlay
  const HUD = () => {
    // Don't display while in the 'over' (game over) state
    // or if sacrifice overlay is transitioning with show/active
    if (
      gameState === 'over' ||
      (gameState === 'sacrifice' && (!activeSacrifice.show && activeSacrifice.count === 0))
    ) {
      // Hide HUD completely in game over or post sacrifice
      return null;
    }

    // During sacrifice overlay, display live-updating stats
    let displayZombiesSacrificed =
      activeSacrifice.show && activeSacrifice.count > 0
        ? zombiesSacrificed + activeSacrifice.liveZombiesSacrificed
        : zombiesSacrificed;
    // Always show count during sacrifice overlay
    const killsDisplay =
      (activeSacrifice.show && activeSacrifice.count > 0)
        ? zombiesKilledThisRun
        : hud.kills;

    return (
      <div className="hud-container">
        <div className="hud-left">
          <div className="hud-label">
            <span className="zombie-icon" /> Kills: {killsDisplay}
          </div>
        </div>
        <div className="hud-center">
          <div className="hud-title">SCORE: {hud.score}</div>
        </div>
        <div className="hud-right" style={{ flexDirection: "column", alignItems: "flex-end" }}>
          <div className="hud-label coins">
            <span className="coin-icon" />
            {activeSacrifice.show ? activeSacrifice.coins + activeSacrifice.liveCoinsEarned : hud.coins}
          </div>
          <p style={{
            margin: "2px 0 0 0",
            color: THEME.primary,
            fontWeight: 600,
            fontSize: "0.95em",
            textShadow: "0 0 5px #39ff14c7",
            letterSpacing: ".01em"
          }}>
            Zombies Sacrificed: {displayZombiesSacrificed}
          </p>
        </div>
      </div>
    );
  };

  function NeonControls() {
    // Controls are also hidden in full game over
    if (gameState === 'over') return null;
    return (
      <div className={"btn-panel" + (mobile ? " btn-panel-mobile" : "")}>
        <button
          className={"neon-control-btn"}
          tabIndex={-1}
          aria-label="Move Left"
          onTouchStart={() => handleTouch('left', true)}
          onTouchEnd={() => handleTouch('left', false)}
          onMouseDown={() => handleTouch('left', true)}
          onMouseUp={() => handleTouch('left', false)}>
          ◀
        </button>
        <button
          className={"neon-control-btn"}
          tabIndex={-1}
          aria-label="Jump"
          onTouchStart={() => handleButtonClick('jump')}
          onClick={() => handleButtonClick('jump')}
        >▲</button>
        <button
          className={"neon-control-btn"}
          tabIndex={-1}
          aria-label="Move Right"
          onTouchStart={() => handleTouch('right', true)}
          onTouchEnd={() => handleTouch('right', false)}
          onMouseDown={() => handleTouch('right', true)}
          onMouseUp={() => handleTouch('right', false)}>
          ▶
        </button>
        <button
          className="neon-control-btn neon-btn-accent"
          tabIndex={-1}
          aria-label="Shoot"
          onTouchStart={() => handleButtonClick('shoot')}
          onClick={() => handleButtonClick('shoot')}
        >
          <span role="img" aria-label="Gun">&#128299;</span>
        </button>
      </div>
    );
  }

  return (
    <div className="neon-app-root">
      <HUD />
      <div className="game-canvas-container" key={gameSession}>
        <canvas
          id="game-canvas"
          key={gameSession}
          width={THEME.canvasWidth}
          height={THEME.canvasHeight}
          ref={canvasRef}
          tabIndex={1}
          aria-label="Game Canvas"
        ></canvas>
        <Overlay />
      </div>
      <NeonControls />
      {/* Hide footer when in Game Over for a more focused overlay */}
      {(gameState !== 'over') && (
        <footer className="footer-note">2024 &copy; Neon Wasteland Alien Zombie Shooter</footer>
      )}
    </div>
  );
}

// PUBLIC_INTERFACE - Central endless-game world. Single spawn logic, score/coin/kill-only state.
class EndlessGameWorld {
  /**
   * EndlessGameWorld provides core game state and zombie spawning for the endless mode.
   * Implements dynamic zombie spawn interval (random between min/max, decreasing as kills rise),
   * and ensures spawn timing is recalculated immediately after every kill without timer overlaps.
   * 
   * Now supports dynamic scaling of zombies: 
   * - Start with a base number,
   * - Each 2500-point milestone increases the spawn count by 2 (cumulative),
   * - Milestones are triggered only once each and reset on Play Again,
   * - Zombies always die in one hit; never increase in strength.
   */
  constructor(theme, onHUD, onDeath) {
    this.theme = theme;
    this.onHUD = onHUD;
    this.onDeath = onDeath;
    this.width = theme.canvasWidth;
    this.height = theme.canvasHeight;
    this.groundY = this.height - 120;
    this.playerGroundY = this.groundY - 48;
    this.playerGravity = 1.6;
    this.playerJumpStrength = 22.5;
    this.state = 'running';

    // Responsive: keep true canvas/player size updated on window resize
    this._handleResize = () => {
      let canvas = document.getElementById('game-canvas');
      if (canvas) {
        let rect = canvas.getBoundingClientRect();
        const newWidth = Math.round(rect.width);
        const newHeight = Math.round(rect.height);
        this.width = newWidth;
        this.height = newHeight;
        // Log resize debug: player/canvas/boundary info using live DOM
        if (typeof window !== "undefined" && window.console) {
          let playerWidth = this.player && this.player.width ? this.player.width : 0;
          let playerX = this.player && typeof this.player.x === "number" ? this.player.x : 0;
          let rightEdge = playerX + playerWidth;
          let maxRightX = newWidth - playerWidth;
          const resizeLog = {
            'canvasWidth': newWidth,
            'player.x': playerX,
            'player.width': playerWidth,
            'player.x + player.width': rightEdge,
            'maxRightX': maxRightX,
            'playerAtLeft': playerX <= 0,
            'playerAtRight': rightEdge >= newWidth,
          };
          console.log('[DEBUG][RESIZE]', resizeLog);
        }
      }
      // Player width remains constant unless display scaling is used on sprite as well
      // (If you add sprite scaling for the player DOM element, update this.player.width similarly)
    };
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("resize", this._handleResize);
      setTimeout(this._handleResize, 50);
    }
    // --- Initial spawn interval tuning for higher early challenge ---
    this._zombieSpawnMinInterval = 2000;
    this._zombieSpawnMaxInterval = 3000;
    this._zombieSpawnAbsoluteMin = 1000;
    this._zombieSpawnAbsoluteMax = 2000;
    this.zombieSpawnTimer = 0; // ms remaining until next spawn
    this._lastKillCount = 0;

    // Tracks if initial zombies have spawned to guarantee smooth flow (used for triple-immediate zombies)
    this._spawnedInitialZombies = false;

    // Milestone mechanism: tracks what point milestones have been reached (integer score thresholds)
    this._zombieSpawnMilestones = []; // e.g., [2500,5000,7500] for those already crossed

    this.baseZombies = 3;    // Start with 3 zombies
    this.milestoneBase = 2500; // Each milestone is 2500 points
    this.zombiePerMilestone = 2; // +2 zombies per-milestone
    this.reset();
  }

  /**
   * Resets state and starts initial zombies.
   */
  reset() {
    this.scrollX = 0;
    this.score = 0;
    this.coins = 0;
    this.kills = 0;
    this.zombies = [];
    this.bullets = [];
    this.effects = [];
    this._playerSpawn();

    // Milestone list is reset on play again
    this._zombieSpawnMilestones = [];
    this._spawnedInitialZombies = false; // Will be set true after first three immediate zombies

    // On reset, clear spawn timers
    this.zombieSpawnTimer = 0;
    this._lastKillCount = 0;
    this._spawnAccumulator = 0;

    // maxZombies is now managed by _currentMaxZombieCount, but we preserve for legacy API if referenced
    this.maxZombies = this.baseZombies; 

    // Make higher initial pressure at score 0: spawn 3 zombies immediately, each with increased speed
    const speedBoosts = [
      1 + (Math.random() * 0.2 + 0.13), // +13–33%
      1 + (Math.random() * 0.17 + 0.16),
      1 + (Math.random() * 0.15 + 0.2)
    ];
    const spawnSides = [
      Math.random() < 0.5 ? "left" : "right",
      Math.random() < 0.5 ? "left" : "right",
      Math.random() < 0.5 ? "left" : "right"
    ];
    for (let i = 0; i < 3; ++i) {
      let zombie = this._spawnZombie(undefined, undefined, spawnSides[i]);
      zombie.speed = zombie.speed * speedBoosts[i];
      this.zombies.push(zombie);
    }

    // Schedule timer for WHEN regular timer will take over (simulate the old "second zombie" logic for smoothness)
    this._initialSecondZombieDelay = Math.floor(Math.random() * 350) + 300;
    this._secondZombieSpawned = true; // triple spawn disables stagger
    this._spawnedInitialZombies = true;

    // Get the tight 2–3s spawn interval for initial state
    this._updateZombieSpawnInterval(true);

    this._updateHUD();
  }

  /**
   * Updates the zombie spawn interval, supporting special logic if score is sufficiently high.
   * After score > 700, spawn intervals sharply accelerate, with possible double spawns and zombie speed-up.
   * @param {boolean} isInitial If true, uses initial intervals; else adapts for kill count and score.
   */
  _updateZombieSpawnInterval(isInitial = false) {
    const HIGH_SCORE_THRESHOLD = 700;
    // If score exceeds 700, enter "frenzy" spawn mode for greater pressure.
    if (this.score > HIGH_SCORE_THRESHOLD) {
      // New interval: 0.7–1.3s, so 700–1300ms; allow brief randomization for fairness
      const minInterval = 700, maxInterval = 1300;
      this._zombieSpawnMinInterval = minInterval;
      this._zombieSpawnMaxInterval = maxInterval;

      // Random interval for next spawn
      let randomDelay = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
      this.zombieSpawnTimer = randomDelay;
      this._lastSpawnTime = Date.now();

      // Track if in high-score mode for use in update()
      this._inHighScoreMode = true;
      // Chance for double spawn next frame handled in update()
      return;
    }

    // --- Initial state: use much tighter intervals (2–3s) for starting challenge! ---
    if (isInitial || (typeof this.score === "number" && this.score === 0)) {
      this._zombieSpawnMinInterval = 2000;
      this._zombieSpawnMaxInterval = 3000;
      this._inHighScoreMode = false;
      let randomDelay = Math.floor(Math.random() * (3000 - 2000 + 1)) + 2000;
      this.zombieSpawnTimer = randomDelay;
      this._lastSpawnTime = Date.now();
      return;
    }

    // Normal progression up to high score: linearly reduce interval as kills increase.
    let k = Math.max(0, this.kills);
    let minStart = 2000, maxStart = 3000, minTarget = 1000, maxTarget = 2000;
    let steps = Math.floor(k / 5);
    let totalSteps = 20; // After 100 kills, it reaches minimum

    // Smooth interpolation based on steps
    function lerp(a, b, t) { return a + (b - a) * t; }
    let t = Math.min(steps / totalSteps, 1);

    let minInterval = Math.round(lerp(minStart, minTarget, t));
    let maxInterval = Math.round(lerp(maxStart, maxTarget, t));
    if (minInterval < minTarget) minInterval = minTarget;
    if (maxInterval < maxTarget) maxInterval = maxTarget;
    if (minInterval < 1000) minInterval = 1000; // enforce abs min
    if (maxInterval < 2000) maxInterval = 2000; // enforce abs min

    this._zombieSpawnMinInterval = minInterval;
    this._zombieSpawnMaxInterval = maxInterval;
    this._inHighScoreMode = false;

    // On initial or after kill: choose a random wait in the interval (applies to next zombie spawn only)
    let randomDelay = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
    this.zombieSpawnTimer = randomDelay;
    this._lastSpawnTime = Date.now();
  }

  /**
   * Core update loop.
   * Handles player, zombies, bullet physics, effects, and dynamic zombie spawn.
   */
  update(control) {
    if (this.state !== 'running') return;

    // === LIVE DOM SIZES FOR RESPONSIVE CANVAS AND SPRITE ===
    let canvas = null;
    // Find the actual canvas DOM element each frame for up-to-date size info
    if (typeof window !== "undefined" && window.document) {
      canvas = document.getElementById('game-canvas');
    }
    let canvasWidth = this.width;
    let playerWidth = this.player.width;
    if (canvas) {
      // `width` is the actual drawing buffer width; `offsetWidth` is CSS/displayed size
      // To be fully accurate (e.g., on responsive layouts), use getBoundingClientRect
      const rec = canvas.getBoundingClientRect();
      // Use the rendered width (should match internal this.width at 1:1)
      canvasWidth = Math.round(rec.width);
    }
    // For full accuracy, if player sprite will be scaled too, update playerWidth similarly here
    // If you use display scaling for player (e.g. with CSS), adjust playerWidth
    // Otherwise, rely on this.player.width as the actual hitbox/sprite size

    // Player controls/movement
    // --- Compute up-to-date DOM-based boundaries ---
    const player = this.player;
    let dx = 0;

    const minX = 0;
    let maxX = (canvasWidth - playerWidth);
    if (maxX < minX) maxX = minX;

    // Clamp player's position BEFORE processing input in case of a recent resize
    if (player.x < minX) {
      player.x = minX;
    }
    if (player.x > maxX) {
      player.x = maxX;
    }

    // Only allow left if player.x > minX, right if player.x + width < canvasWidth
    if (control.left && player.x > minX) {
      dx -= player.speed;
    }
    if (control.right && player.x + player.width < canvasWidth) {
      dx += player.speed;
    }
    // Clamp dx if it would move the player beyond minX/maxX
    if (dx < 0 && player.x + dx < minX) {
      dx = minX - player.x;
    }
    if (dx > 0 && player.x + dx > maxX) {
      dx = maxX - player.x;
    }
    player.x += dx;

    // Clamp again after moving
    if (player.x < minX) {
      player.x = minX;
    }
    if (player.x > maxX) {
      player.x = maxX;
    }

    player.dir = dx > 0 ? 1 : dx < 0 ? -1 : player.dir;

    if (this.player.x - this.scrollX > canvasWidth * 0.4)
      this.scrollX = this.player.x - canvasWidth * 0.4;
    if (this.scrollX < 0) this.scrollX = 0;
    // Jumping
    let onGround = (Math.abs(this.player.y - this.playerGroundY) < 1);
    if (control.jump && onGround && !this.player.isJumping) {
      this.player.velocityY = -this.playerJumpStrength;
      this.player.isJumping = true;
    }
    if (!onGround || this.player.velocityY !== 0) {
      this.player.velocityY += this.playerGravity;
      this.player.y += this.player.velocityY;
      if (this.player.y > this.playerGroundY) {
        this.player.y = this.playerGroundY;
        this.player.velocityY = 0;
        this.player.isJumping = false;
      }
    } else {
      this.player.velocityY = 0;
      this.player.isJumping = false;
      this.player.y = this.playerGroundY;
    }
    // Shooting (single-shot, no ammo)
    if (control.shoot && this.player.shootCooldown <= 0) {
      this._shoot();
      this.player.shootCooldown = 16;
      this.effects.push({ type: 'muzzle', x: this.player.x + this.player.dir * 30, y: this.player.y + 32, t: 0 });
    }
    if (this.player.shootCooldown > 0) this.player.shootCooldown -= 1;

    // Bullets and hit logic
    let killsBefore = this.kills;
    this.bullets.forEach((b, i, arr) => {
      b.x += b.vx;
      for (let z of this.zombies) {
        if (!z.dead && z.x < b.x && b.x < z.x + z.w && z.y < b.y && b.y < z.y + z.h) {
          // Zombies always die instantly on bullet hit
          z.dead = true;
          z._diedAt = Date.now();
          this.kills += 1;
          this.coins += z.coins;

          // Score milestone logic:
          // Determine pre-kill score for this shot
          const preScore = this.score;
          this.score += 100;

          // Find milestones crossed by this new score (triggered only once)
          const prevMilestone = Math.floor(preScore / this.milestoneBase);
          const newMilestone = Math.floor(this.score / this.milestoneBase);

          for (let msIdx = prevMilestone + 1; msIdx <= newMilestone; ++msIdx) {
            const milestoneScore = msIdx * this.milestoneBase;
            if (
              this.score >= milestoneScore && // Only if current score reaches/crosses it!
              !this._zombieSpawnMilestones.includes(milestoneScore) // Only trigger once per milestone
            ) {
              this._zombieSpawnMilestones.push(milestoneScore);
            }
          }

          this.effects.push({
            type: 'label',
            x: z.x + z.w / 2,
            y: z.y - 13,
            t: 0,
            text: "+2",
            fill: "#39ff14",
            outline: "#1a1a1a",
          });
          this.effects.push({ type: 'juice', x: z.x + z.w / 2, y: z.y + z.h / 2, t: 0 });
          arr[i]._hit = true;
        }
      }
    });
    this.bullets = this.bullets.filter(b => b.x > this.scrollX - 60 && b.x < this.scrollX + this.width + 60 && !b._hit);

    // If a kill was scored, immediately update spawn interval and timer for the new difficulty.
    if (this.kills !== this._lastKillCount) {
      this._lastKillCount = this.kills; // sync
      this._updateZombieSpawnInterval(false);
    }

    // Remove dead zombies (fall away visually)
    for (let z of this.zombies) {
      if (z.dead && !z._falling) {
        z._falling = true;
        z._vy = 2 + Math.random() * 3;
      }
      if (z._falling) {
        z.y += z._vy;
        z._vy += 0.5;
      }
    }
    this.zombies = this.zombies.filter(z => !z._falling || z.y < this.groundY + 90);

    // Enemy zombie movement/collision
    for (let z of this.zombies) {
      if (!z.dead) {
        // Move left or right according to their spawn direction/velocity (z.speed signed)
        z.x += z.spawnDir === "left" ? Math.abs(z.speed) : -Math.abs(z.speed);
        // Respawn if out of bounds (left or right)
        if ((z.spawnDir === "left" && z.x > this.scrollX + this.width + 140) ||
            (z.spawnDir === "right" && z.x < this.scrollX - 140)) {
          Object.assign(
            z,
            this._spawnZombie(
              undefined,
              undefined,
              Math.random() < 0.5 ? "left" : "right"
            )
          );
        }
        // Collision with player triggers DEATH and sacrifice!
        // Zombies are ALWAYS 1 hit kill; never get stronger.
        if (this._collide(this.player, z)) {
          this.state = 'sacrifice';
          this.onDeath && this.onDeath();
          return;
        }
      }
    }

    // Particle/labels/effects updates
    for (let e of this.effects) {
      e.t += 1;
    }
    this.effects = this.effects.filter(e =>
      (e.type === "muzzle" && e.t < 12) ||
      (e.type === "juice" && e.t < 30) ||
      (e.type === "ammo" && e.t < 500) ||
      (e.type === "label" && e.t < 33)
    );

    // ---- SPAWN LOGIC ----

    // Only spawn if below max zombies (alive, not dead)
    const numLivingZombies = this.zombies.filter(z => !z.dead).length;
    const maxToSpawn = this._maxZombieCount();
    let now = Date.now();
    let dt = 16; // capped update

    // Time accumulation for frame-correct decrement
    if (typeof this._lastUpdateTs !== 'number') this._lastUpdateTs = now;
    dt = now - this._lastUpdateTs;
    this._lastUpdateTs = now;
    if (dt > 200) dt = 32;

    // Handle initial game start immediate/delayed zombie spawns
    if (!this._spawnedInitialZombies) {
      // Zombie #1 is already spawned in reset(); Zombie #2 spawns after "this._initialSecondZombieDelay"
      if (!this._secondZombieSpawned) {
        if (typeof this._initialSecondZombieElapsed === "undefined") this._initialSecondZombieElapsed = 0;
        this._initialSecondZombieElapsed += dt;
        if (this._initialSecondZombieElapsed >= this._initialSecondZombieDelay) {
          // Spawn the second zombie
          this.zombies.push(this._spawnZombie(undefined, undefined, Math.random() < 0.5 ? "left" : "right"));
          this._secondZombieSpawned = true;
          // After both initial zombies, enable the regular spawn timer system (interval-based)
          this._updateZombieSpawnInterval(true /* isInitial */);
          this._spawnedInitialZombies = true;
        }
      }
      // During this phase, skip regular timer logic entirely
    } else {
      // --- Main interval timer system (never overlaps) ---
      if (numLivingZombies < maxToSpawn) {
        if (typeof this.zombieSpawnTimer !== "number") this.zombieSpawnTimer = 0;
        this.zombieSpawnTimer -= dt;

        // Enhanced spawn logic: after high-score, handle snappy interval and possible double/triple spawns & speedup.
        const score = this.score;
        const inFrenzy = !!this._inHighScoreMode;
        const frenzyDoubleChance = 0.33; // 33% chance to double-spawn, cannot exceed maxToSpawn
        const frenzyTripleChance = 0.11; // rare, <11% chance for triple

        while (this.zombieSpawnTimer <= 0 && this.zombies.filter(z => !z.dead).length < maxToSpawn) {
          let nToSpawn = 1;

          // After score 700, occasionally double-or-triple spawn to increase challenge
          if (inFrenzy) {
            if (Math.random() < frenzyDoubleChance && this.zombies.filter(z => !z.dead).length <= maxToSpawn - 2) {
              nToSpawn = 2;
              // 10% of the time, upgrade to 3 if very high score and room (over 1300 score)
              if (score > 1300 && Math.random() < frenzyTripleChance && this.zombies.filter(z => !z.dead).length <= maxToSpawn - 3) {
                nToSpawn = 3;
              }
            }
          }

          // SPAWN ZOMBIES (single/double/triple)
          for (let i = 0; i < nToSpawn && this.zombies.filter(z => !z.dead).length < maxToSpawn; ++i) {
            const spawnSide = Math.random() < 0.5 ? "left" : "right";
            let zombie = this._spawnZombie(undefined, undefined, spawnSide);
            if (inFrenzy) {
              // Up to 19% speedup for base zombie, small variety for fairness and unpredictability
              let speedBoost = 1 + (Math.random() * 0.19 + 0.09); // 9–28% faster
              zombie.speed = zombie.speed * speedBoost;
            }
            this.zombies.push(zombie);
          }

          // Get randomized next interval (difficulty-adjusted)
          let minI = this._zombieSpawnMinInterval, maxI = this._zombieSpawnMaxInterval;
          if (inFrenzy) {
            // Ensure hard lower/upper bounds for high-score mode
            minI = 700; maxI = 1300;
          } else {
            if (minI < this._zombieSpawnAbsoluteMin) minI = this._zombieSpawnAbsoluteMin;
            if (maxI < this._zombieSpawnAbsoluteMax) maxI = this._zombieSpawnAbsoluteMax;
          }
          let nextDelay = Math.floor(Math.random() * (maxI - minI + 1)) + minI;
          this.zombieSpawnTimer += nextDelay;
        }
      }
      // If at max, do not decrement spawn timer, just wait for a zombie to die.
    }

    // Update HUD
    this._updateHUD();
  }

  draw(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this._drawBG(ctx);

    // === DEBUG VISUAL: Red line at true right boundary where player is clamped ===
    // Compute current canvas width (buffer/native) and player width
    let renderedPlayerWidth = this.player.width;
    let domCanvasWidth = canvas.width;
    let canvasRect = canvas.getBoundingClientRect();
    // For visual correctness (if canvas/css size != buffer size), calculate scale ratio
    let scaleX = 1;
    if (canvasRect.width !== 0 && canvas.width !== 0) {
      scaleX = canvas.width / canvasRect.width;
    }
    let debugDomWidth = Math.round(canvasRect.width);
    let maxRightX = debugDomWidth - renderedPlayerWidth;
    // Compute draw-x in buffer coords
    let rightBoundaryBufferX;
    {
      // If no scaling: rightBoundaryBufferX = canvas.width - player.width
      // But, for responsive canvas, convert DOM pixel to buffer pixel:
      const boundaryDomX = debugDomWidth - renderedPlayerWidth; // px relative to visible canvas
      // Convert DOM X to drawing buffer X
      rightBoundaryBufferX = Math.round(boundaryDomX * scaleX);
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(rightBoundaryBufferX, 0);
    ctx.lineTo(rightBoundaryBufferX, canvas.height);
    ctx.strokeStyle = "#ef2532";
    ctx.lineWidth = 3; // Make it stand out
    ctx.shadowColor = "#c21029";
    ctx.shadowBlur = 4;
    ctx.globalAlpha = 0.73;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(-this.scrollX, 0);

    // Ground
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.groundY, 5000, 120);
    var grd = ctx.createLinearGradient(0, this.groundY, 0, this.groundY + 120);
    grd.addColorStop(0, "#202026");
    grd.addColorStop(0.5, "#1a1a1a");
    grd.addColorStop(1, "#1e2323");
    ctx.fillStyle = grd;
    ctx.shadowColor = "#39ff148c";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();

    // Neon toxic ground
    let toxicNoise = Math.sin(Date.now() / 470) * 9;
    for (let s = 1; s <= 2; ++s) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.scrollX + this.width / 1.9, this.groundY + 70 + toxicNoise * s, 400 + 70 * s, Math.PI, Math.PI * 2, false);
      ctx.lineWidth = 2 + s;
      ctx.strokeStyle = s % 2 === 0 ? "#39ff142d" : "#39ff1477";
      ctx.shadowColor = "#39ff14aa";
      ctx.shadowBlur = 24 + s * 4;
      ctx.stroke();
      ctx.restore();
    }

    // Draw zombies
    for (let z of this.zombies) {
      this._drawZombie(ctx, z);
    }

    // Draw player
    this._drawPlayer(ctx, this.player);

    // Bullets
    for (let b of this.bullets) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, 2 * Math.PI, false);
      ctx.shadowColor = this.theme.accent;
      ctx.shadowBlur = 14;
      ctx.fillStyle = this.theme.accent;
      ctx.globalAlpha = 0.89;
      ctx.fill();
      ctx.restore();
    }

    // Particle/effects & labels
    for (let e of this.effects) {
      if (e.type === 'muzzle') {
        ctx.save();
        ctx.globalAlpha = 1 - e.t / 16;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 16 - e.t, 0, Math.PI * 2);
        ctx.fillStyle = "#fff2";
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      }
      if (e.type === 'juice') {
        ctx.save();
        ctx.globalAlpha = 1 - e.t / 28;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 22 + e.t * 2, 0, Math.PI * 2);
        ctx.fillStyle = this.theme.primary;
        ctx.shadowColor = "#39ff14cc";
        ctx.shadowBlur = 35;
        ctx.fill();
        ctx.restore();
      }
      if (e.type === 'label') {
        ctx.save();
        ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
        let alpha = Math.max(0, 1 - e.t / 32 - 0.21);
        ctx.globalAlpha = alpha;
        // Animate upward float
        let yFloat = e.y - e.t * 1.5 - 26 * Math.max(0.3, alpha);
        ctx.lineWidth = 4;
        ctx.strokeStyle = e.outline || '#181718';
        ctx.strokeText(e.text, e.x - 13, yFloat);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "#fff3";
        ctx.strokeText(e.text, e.x - 13, yFloat - 1);
        ctx.fillStyle = e.fill;
        ctx.fillText(e.text, e.x - 13, yFloat);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  _playerSpawn() {
    this.player = {
      x: 100,
      y: this.playerGroundY,
      width: 32,
      height: 56,
      speed: 6,
      dir: 1,
      alive: true,
      shootCooldown: 0,
      velocityY: 0,
      isJumping: false,
    };
    this.playerVelocityY = 0;
    this.playerIsJumping = false;
  }

  _updateHUD() {
    this.onHUD && this.onHUD({
      score: this.score,
      coins: this.coins,
      kills: this.kills,
    });
  }

  /**
   * Spawns a zombie at a side (left/right), speed varies, always 1-hit kill.
   * No health, no increasing defense, no mutations ever.
   */
  _spawnZombie(x, _unused, side) {
    // All zombies are 1-hit, no HP, no increase in strength ever!
    const type = zombieTypes[0];
    let spawnDir = side;
    if (!spawnDir) spawnDir = Math.random() < 0.5 ? "left" : "right";
    let entryX;
    if (typeof x === "number") {
      entryX = x;
    } else if (spawnDir === "left") {
      entryX = this.scrollX - 120 - Math.random() * 80;
    } else {
      entryX = this.scrollX + this.width + 120 + Math.random() * 80;
    }

    // Entry/movement speed: base is intentionally slow, scaling with score for difficulty, but zombies are always 1 hit kill.
    const baseSpeed = 0.65 + Math.min(this.score / 3500, 1.0) + Math.random() * 0.26;
    const speed = baseSpeed * (spawnDir === "left" ? 1 : -1);

    return {
      x: entryX,
      y: this.groundY - type.h + 8,
      w: type.w,
      h: type.h,
      speed: speed,
      dead: false,
      _falling: false,
      type: type.name,
      color: type.color,
      shadow: type.shadow,
      head: type.head,
      eyes: type.eyes,
      coins: type.coins,
      label: type.label,
      labelColor: type.labelColor,
      // Zombies never get HP or any defensive stat
      spawnDir,
    };
  }

  /**
   * Calculates the current max number of zombies to spawn, based on
   * milestone progress (scales at every 2500, 5000, 7500, ...).
   * Always:
   *   count = baseZombies + milestonesReached * zombiesPerMilestone
   *   (e.g. base 3, +2 at 2500, +4 at 5000, etc.)
   */
  _maxZombieCount() {
    // This ensures as soon as a milestone is unlocked, the extra zombies are available
    // Always minimum of baseZombies, plus milestones hit times zombiesPerMilestone
    return this.baseZombies + this._zombieSpawnMilestones.length * this.zombiePerMilestone;
  }

  _shoot() {
    this.bullets.push({
      x: this.player.x + this.player.dir * 32,
      y: this.player.y + 22,
      vx: this.player.dir * 20,
      vy: 0,
    });
  }

  _collide(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.width > b.x &&
      a.y < b.y + b.h &&
      a.y + a.height > b.y
    );
  }

  _drawBG(ctx) {
    const grd = ctx.createLinearGradient(0, 0, 0, this.height);
    grd.addColorStop(0, "#292940");
    grd.addColorStop(0.4, "#1a1a1a");
    grd.addColorStop(1, "#252536");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.globalAlpha = 0.59;
    ctx.beginPath();
    ctx.arc(this.width / 2, 200 + Math.sin(Date.now() / 1000) * 18, 340, 0, Math.PI * 2);
    ctx.fillStyle = "#39ff1435";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 130;
    ctx.fill();
    ctx.restore();
  }

  _drawPlayer(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-16, 0, 32, 50, 12);
    ctx.fillStyle = "#1e1e22";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -15, 16, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1e1f2f";
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.86;
    ctx.beginPath();
    ctx.ellipse(-6, -8, 5, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(+6, -8, 5, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#39ff14";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 9;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(p.dir === 1 ? 0.08 : -0.12);
    ctx.beginPath();
    ctx.rect(p.dir === 1 ? 15 : -41, 13, 26, 8);
    ctx.fillStyle = "#2ecffd";
    ctx.shadowColor = "#2ecffd";
    ctx.shadowBlur = 5;
    ctx.globalAlpha = 0.89;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 7;
    ctx.moveTo(0, 12); ctx.lineTo(p.dir * 16, 28);
    ctx.strokeStyle = "#39ff14";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 5;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  _drawZombie(ctx, z) {
    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-z.w / 2, 0, z.w, z.h, Math.max(8, Math.min(16, Math.round(z.w / 4))));
    ctx.fillStyle = z.dead ? "#3ba04e" : z.color;
    ctx.shadowColor = z.dead ? "#37c84666" : z.shadow;
    ctx.shadowBlur = z.dead ? 3 : 17;
    ctx.globalAlpha = z.dead ? 0.65 : 1;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -10, Math.max(10, z.w / 2), Math.max(7, z.w / 2.7), 0, 0, Math.PI * 2);
    ctx.fillStyle = z.head;
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = z.dead ? 0.33 : 1;
    ctx.beginPath();
    ctx.arc(-7, -12, 3, 0, Math.PI * 2);
    ctx.arc(+7, -12, 3, 0, Math.PI * 2);
    ctx.fillStyle = z.eyes;
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -3, 8, 0, Math.PI, false);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#aa2c69";
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}

export default App;
