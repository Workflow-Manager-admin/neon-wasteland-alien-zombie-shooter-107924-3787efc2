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
            <div className="big-score neon-text">Final Score: <span style={{color:"#fff"}}>{hud.score}</span></div>
            <div className="coins neon-glow" style={{fontSize: "1.24em"}}>Coins: <span>{hud.coins}</span></div>
            <div className="neon-text" style={{
              color: "var(--neon-primary)",
              marginBottom: "1.2em",
              fontSize: "1.14em"
            }}>
              Zombies Sacrificed: <span style={{color:"var(--neon-accent)", fontWeight:600}}>{zombiesSacrificed}</span>
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
      <div className="game-canvas-container">
        <canvas
          id="game-canvas"
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
    // --- Zombie spawn variables for new logic ---
    this.spawnTimer = 0; // for interval-based spawn, controls when to spawn next zombie
    this.lastZombieSpawnTime = Date.now();
    this._minZombieSpawnDelay = 600; // minimal milliseconds between spawns, will increase as health increases
    this._baseZombieSpawnDelay = 1800; // base ms between spawns at lowest health
    this.maxZombies = 5;
    this._playerSpawn();
    // Start zombies: spawn both from left and right, scattered
    for (let i = 0; i < this.maxZombies - 1; ++i) {
      // Alternate initial spawns between left and right for variety at game start
      this.zombies.push(this._spawnZombie(undefined, undefined, i % 2 === 0 ? "left" : "right"));
    }
    this._updateHUD();
  }

  update(control) {
    if (this.state !== 'running') return;
    // Player controls/movement
    let dx = 0;
    if (control.left) dx -= this.player.speed;
    if (control.right) dx += this.player.speed;
    this.player.x += dx;
    this.player.dir = dx > 0 ? 1 : dx < 0 ? -1 : this.player.dir;
    if (this.player.x < 20) this.player.x = 20;
    if (this.player.x - this.scrollX > this.width * 0.4)
      this.scrollX = this.player.x - this.width * 0.4;
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
    this.bullets.forEach((b, i, arr) => {
      b.x += b.vx;
      for (let z of this.zombies) {
        if (!z.dead && z.x < b.x && b.x < z.x + z.w && z.y < b.y && b.y < z.y + z.h) {
          z.hp -= 1;
          if (z.hp <= 0) {
            z.dead = true;
            z._diedAt = Date.now();
            this.kills += 1;
            this.coins += z.coins;
            this.score += 100;
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
          }
          arr[i]._hit = true;
        }
      }
    });
    this.bullets = this.bullets.filter(b => b.x > this.scrollX - 60 && b.x < this.scrollX + this.width + 60 && !b._hit);

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
          // Spawn on random new side, update all zombie stats to current scaling
          Object.assign(
            z,
            this._spawnZombie(
              undefined,
              this._zombieHPByScore(),
              Math.random() < 0.5 ? "left" : "right"
            )
          );
        }
        // Collision with player triggers DEATH and sacrifice!
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

    // ---- NEW SPAWN LOGIC ----
    // Calculate desired min spawn interval based on zombie health (harder = spawn slower)
    // High health = larger hpModifier = longer delay
    const hp = this._zombieHPByScore();
    const hpModifier = 1 + ((hp - 1) * 0.8); // more health means up to 80% longer interval per extra HP
    const currentDelay = this._baseZombieSpawnDelay * hpModifier;
    const elapsedSinceSpawn = Date.now() - this.lastZombieSpawnTime;
    // Only spawn if below max zombies (alive, not dead)
    if (this.zombies.filter(z => !z.dead).length < this._maxZombieCount()) {
      if (elapsedSinceSpawn >= currentDelay) {
        // Spawn on either side randomly
        this.zombies.push(this._spawnZombie(undefined, hp, Math.random() < 0.5 ? "left" : "right"));
        this.lastZombieSpawnTime = Date.now();
      }
    }
    // Update HUD
    this._updateHUD();
  }

  draw(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this._drawBG(ctx);

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

  // Ensure only one method controls all zombie spawning/scaling
  /**
   * Spawns a zombie at a side (left/right), with health and proper speed for entry.
   * @param {number|undefined} x Optional x position override (otherwise calculated by side)
   * @param {number|undefined} hpOverride Optional health override, otherwise calculated from score
   * @param {'left'|'right'|undefined} side 'left' or 'right' to control spawn side; random if omitted
   */
  _spawnZombie(x, hpOverride, side) {
    // Zombies scale in health and speed with increased score; entry speed starts slow
    const type = zombieTypes[0];
    // health grows with score
    const hp = typeof hpOverride === "number" ? hpOverride : this._zombieHPByScore();
    // Pick spawn side: left or right (default random)
    let spawnDir = side;
    if (!spawnDir) spawnDir = Math.random() < 0.5 ? "left" : "right";
    // Entry X: if left, spawn just off left of view (or given x if specified); if right, spawn off right
    let entryX;
    if (typeof x === "number") {
      entryX = x;
    } else if (spawnDir === "left") {
      entryX = this.scrollX - 120 - Math.random() * 80;
    } else {
      entryX = this.scrollX + this.width + 120 + Math.random() * 80;
    }

    // Entry/movement speed: base is intentionally slow, scaling up with score for difficulty
    // Start at 0.65, never exceeding type.speed + 1.0; still some random for variety
    const baseSpeed = 0.65 + Math.min(this.score / 3500, 1.0) + Math.random() * 0.26;
    // If spawned from left, speed is positive rightward. If spawned from right, speed is negative (leftward).
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
      hp,
      maxhp: hp,
      spawnDir, // Record spawn direction for proper movement/respawn logic
    };
  }

  // Spawns eventually scale up to 7+ zombies; caps at score 4000+
  _maxZombieCount() {
    if (this.score < 600) return 4;
    if (this.score < 1200) return 5;
    if (this.score < 2000) return 6;
    if (this.score < 4000) return 7;
    return 8;
  }

  _zombieHPByScore() {
    if (this.score < 800) return 1;
    if (this.score < 1600) return 2;
    const calculated = Math.floor(this.score / 800);
    return Math.min(4, calculated);
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
