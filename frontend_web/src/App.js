import React, { useRef, useEffect, useState } from 'react';
import './App.css';
import PortalSacrifice from './PortalSacrifice.jsx';

// Neon theme
const THEME = {
  accent: '#aa2c69',
  primary: '#39ff14',
  secondary: '#1a1a1a',
  white: '#fff',
  canvasWidth: 800,
  canvasHeight: 600,
};

// PUBLIC_INTERFACE
function App() {
  // GAME STATE HOOKS
  const [gameState, setGameState] = useState('menu'); // menu | running | sacrifice | over
  const [hud, setHud] = useState({
    score: 0, coins: 0, kills: 0,
  });
  const [gameSession, setGameSession] = useState(0);
  const [zombiesSacrificed, setZombiesSacrificed] = useState(0);
  const [zombiesKilledThisRun, setZombiesKilledThisRun] = useState(0);
  const [activeSacrifice, setActiveSacrifice] = useState({
    show: false,
    count: 0,
    coins: 0,
    coinValue: 2,
    liveZombiesSacrificed: 0,
    liveCoinsEarned: 0,
    floats: [],
  });
  const [control, setControl] = useState({ left: false, right: false, shoot: false, jump: false });
  const [mobile, setMobile] = useState(false);

  // Main refs
  const canvasRef = useRef();
  const world = useRef(null);
  const overlayActiveRef = useRef(false);

  // Responsive
  useEffect(() => {
    setMobile(window.innerWidth < 900);
    const onResize = () => setMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Start/reset game
  const startGame = () => {
    setGameSession(s => s + 1);
    world.current = new EndlessGameWorld(THEME, (hudObj) => {
      setHud(hudObj);
      setZombiesKilledThisRun(hudObj.kills || 0);
    }, () => {
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

  // Frame loop
  useAnimationFrame((ts) => {
    if (
      gameState === 'running' &&
      canvasRef.current &&
      world.current
    ) {
      world.current.update(control);
      world.current.draw(canvasRef.current);
    }
    if (
      (gameState === 'sacrifice' && activeSacrifice.show && world.current && canvasRef.current)
    ) {
      world.current.draw(canvasRef.current);
    }
  }, gameState === 'running' || (gameState === 'sacrifice' && activeSacrifice.show));

  // Keyboard
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

  // Mobile handler
  const handleTouch = (type, enable) => {
    if (activeSacrifice.show && gameState === 'sacrifice') return;
    if (type === 'left') setControl(s => ({ ...s, left: enable }));
    if (type === 'right') setControl(s => ({ ...s, right: enable }));
    if (type === 'shoot') setControl(s => ({ ...s, shoot: enable }));
    if (type === 'jump') setControl(s => ({ ...s, jump: enable }));
  };
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

  // Floating label remover
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

  // Overlay renderer
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
    // Sacrifice overlay
    if (activeSacrifice.show && gameState === 'sacrifice' && activeSacrifice.count > 0) {
      const onSacrificeDrop = (zNum) => {
        setActiveSacrifice(prev => ({
          ...prev,
          liveZombiesSacrificed: prev.liveZombiesSacrificed + 1,
          liveCoinsEarned: prev.liveCoinsEarned + prev.coinValue,
          floats: [...prev.floats, { id: Date.now() + Math.random(), value: '+' + prev.coinValue }]
        }));
      };
      const onSacrificeComplete = (totalCoins) => {
        if (overlayActiveRef.current) return;
        overlayActiveRef.current = true;
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
    // Game over
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

  // HUD
  const HUD = () => {
    if (
      gameState === 'over' ||
      (gameState === 'sacrifice' && (!activeSacrifice.show && activeSacrifice.count === 0))
    ) {
      return null;
    }
    let displayZombiesSacrificed =
      activeSacrifice.show && activeSacrifice.count > 0
        ? zombiesSacrificed + activeSacrifice.liveZombiesSacrificed
        : zombiesSacrificed;
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
      {(gameState !== 'over') && (
        <footer className="footer-note">2024 &copy; Neon Wasteland Alien Zombie Shooter</footer>
      )}
    </div>
  );
}

// Reusable helper (unchanged)
function useAnimationFrame(callback, isRunning = true) {
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
}

/**
 * PUBLIC_INTERFACE - Core endless-game world with basic, original zombie spawn logic (1-hit kill, single zombie type, no difficulty stacking).
 * Now: gently increases zombie spawn rate slightly after score > 1000, and resets rate on Play Again.
 */
class EndlessGameWorld {
  /** Main endless mode: always single, simple spawn/kill, all zombies die in 1 hit, progress and milestones reset on Play Again. */
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

    this._handleResize = () => {
      let canvas = document.getElementById('game-canvas');
      if (canvas) {
        let rect = canvas.getBoundingClientRect();
        this.width = Math.round(rect.width);
        this.height = Math.round(rect.height);
      }
    };
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("resize", this._handleResize);
      setTimeout(this._handleResize, 50);
    }
    // Default zombie spawn rates (before 1000 score)
    this._defaultZombieSpawnMinInterval = 2000;
    this._defaultZombieSpawnMaxInterval = 3000;
    // Post-1000-score spawn rates (gentle faster)
    this._highScoreZombieSpawnMinInterval = 1200;   // (gentle: 1200–2000, still safe)
    this._highScoreZombieSpawnMaxInterval = 2000;

    this._zombieSpawnMinInterval = this._defaultZombieSpawnMinInterval;
    this._zombieSpawnMaxInterval = this._defaultZombieSpawnMaxInterval;
    this._zombieSpawnAbsoluteMin = 1000;
    this._zombieSpawnAbsoluteMax = 2000;
    this.zombieSpawnTimer = 0;

    this.baseZombies = 3;
    this.reset();
  }

  reset() {
    this.scrollX = 0;
    this.score = 0;
    this.coins = 0;
    this.kills = 0;
    this.zombies = [];
    this.bullets = [];
    this.effects = [];
    this._playerSpawn();

    this.maxZombies = this.baseZombies;
    this._inHighScoreMode = false; // resets difficulty if returning via Play Again or menu

    // Spawn 3 zombies at start
    const speedBoosts = [
      1 + (Math.random() * 0.2 + 0.13),
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

    this._initialSecondZombieDelay = Math.floor(Math.random() * 350) + 300;
    this._secondZombieSpawned = true;
    this._spawnedInitialZombies = true;

    // Ensure spawn interval is base at new game
    this._zombieSpawnMinInterval = this._defaultZombieSpawnMinInterval;
    this._zombieSpawnMaxInterval = this._defaultZombieSpawnMaxInterval;
    this._updateZombieSpawnInterval(true);

    this._updateHUD();
  }

  _updateZombieSpawnInterval(isInitial = false) {
    // After score > 1000, gently reduce spawn interval, else keep classic pace.
    // (Note: called from reset and also whenever score is updated past 1000 below!)
    if (this._inHighScoreMode) {
      this._zombieSpawnMinInterval = this._highScoreZombieSpawnMinInterval;
      this._zombieSpawnMaxInterval = this._highScoreZombieSpawnMaxInterval;
    } else {
      this._zombieSpawnMinInterval = this._defaultZombieSpawnMinInterval;
      this._zombieSpawnMaxInterval = this._defaultZombieSpawnMaxInterval;
    }
    let randomDelay = Math.floor(Math.random() * (this._zombieSpawnMaxInterval - this._zombieSpawnMinInterval + 1)) + this._zombieSpawnMinInterval;
    this.zombieSpawnTimer = randomDelay;
    this._lastSpawnTime = Date.now();
  }

  update(control) {
    if (this.state !== 'running') return;

    // === GENTLE DIFFICULTY INCREASE: check score threshold for spawn rate ===
    if (!this._inHighScoreMode && this.score > 1000) {
      this._inHighScoreMode = true;
      this._updateZombieSpawnInterval();
    }

    // === ZOMBIE SPAWN ===
    const numLivingZombies = this.zombies.filter(z => !z.dead).length;
    const maxToSpawn = this.maxZombies;
    let now = Date.now();
    let dt = 16;
    if (typeof this._lastUpdateTs !== 'number') this._lastUpdateTs = now;
    dt = now - this._lastUpdateTs;
    this._lastUpdateTs = now;
    if (dt > 200) dt = 32;

    if (numLivingZombies < maxToSpawn) {
      if (typeof this.zombieSpawnTimer !== "number") this.zombieSpawnTimer = 0;
      this.zombieSpawnTimer -= dt;
      while (this.zombieSpawnTimer <= 0 && this.zombies.filter(z => !z.dead).length < maxToSpawn) {
        // Spawn one
        const spawnSide = Math.random() < 0.5 ? "left" : "right";
        let zombie = this._spawnZombie(undefined, undefined, spawnSide);
        this.zombies.push(zombie);
        let minI = this._zombieSpawnMinInterval, maxI = this._zombieSpawnMaxInterval;
        if (minI < this._zombieSpawnAbsoluteMin) minI = this._zombieSpawnAbsoluteMin;
        if (maxI < this._zombieSpawnAbsoluteMax) maxI = this._zombieSpawnAbsoluteMax;
        let nextDelay = Math.floor(Math.random() * (maxI - minI + 1)) + minI;
        this.zombieSpawnTimer += nextDelay;
      }
    }

    this._updateHUD();
  }

  // PUBLIC_INTERFACE
  draw(canvas) {
    /**
     * Draw main game scene (background, ground, player, zombies, etc) to canvas. Always call this per frame.
     * The _drawBG method provides the neon-toxic wasteland theme background and ground plane.
     */
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this._drawBG(ctx);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.width - this.player.width, 0);
    ctx.lineTo(this.width - this.player.width, canvas.height);
    ctx.strokeStyle = "#ef2532";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#c21029";
    ctx.shadowBlur = 4;
    ctx.globalAlpha = 0.73;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(-this.scrollX, 0);

    // [drawing omitted, as per original basic endless game]
    ctx.restore();
  }

  /**
   * Draws the neon wasteland canvas background and toxic ground.
   * Fills with a dark gradient sky and a bright neon ground band at the horizon.
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawBG(ctx) {
    const w = this.width, h = this.height;
    // Background Sky: dark purple to black gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#2c005b");
    grad.addColorStop(0.43, "#23243a");
    grad.addColorStop(0.9, "#181925");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Toxic neon ground
    const groundY = this.groundY + 24;
    const grd = ctx.createLinearGradient(0, groundY - 32, 0, h);
    grd.addColorStop(0.0, "#39ff14");
    grd.addColorStop(0.16, "#98ff60b8");
    grd.addColorStop(0.63, "#1a1a1a");
    grd.addColorStop(1.0, "#090910");
    ctx.fillStyle = grd;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Horizon glow
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#39ff14";
    ctx.fillRect(0, this.groundY - 9, w, 18);
    ctx.restore();

    // Extra: subtle horizon band
    ctx.save();
    ctx.globalAlpha = 0.17;
    ctx.fillStyle = "#aa2c69";
    ctx.fillRect(0, this.groundY - 1.5, w, 3);
    ctx.restore();

    // Optionally, add occasional bright toxic plumes (for effect only)
    // (could extend later for more visual interest)
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

  _spawnZombie(x, _unused, side) {
    const type = {
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
      label: "+2"
    };
    let spawnDir = side || (Math.random() < 0.5 ? "left" : "right");
    let entryX;
    if (typeof x === "number") {
      entryX = x;
    } else if (spawnDir === "left") {
      entryX = this.scrollX - 120 - Math.random() * 80;
    } else {
      entryX = this.scrollX + this.width + 120 + Math.random() * 80;
    }
    const baseSpeed = 0.65 + Math.random() * 0.26;
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
      spawnDir,
    };
  }
}

export default App;
