import React, { useRef, useEffect, useState } from "react";
import "./App.css";

/**
 * Neon Wasteland Alien Zombie Shooter
 * Simple endless shooter - single file logic, no level/milestone stacking,
 * minimal hooks, draws background and minimal player/zombie/bullet cycle.
 **/

// PUBLIC_INTERFACE
function App() {
  const canvasRef = useRef();
  const [gameState, setGameState] = useState("menu"); // menu | running | over
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [kills, setKills] = useState(0);
  const [playerDead, setPlayerDead] = useState(false);
  const [gameSession, setGameSession] = useState(0); // for remount and reset

  // --- FREESOUND MUSIC STATE ---
  const audioRef = useRef(null);
  const [bgmError, setBgmError] = useState(null);

  // Controls - One simple object (keyboard only, easy to add touch later)
  const [control, setControl] = useState({
    left: false,
    right: false,
    shoot: false,
    jump: false
  });

  // Main game world instance (reset per game)
  const gameWorld = useRef(null);

  // Start or restart game
  const startGame = React.useCallback(async () => {
    setScore(0);
    setKills(0);
    setCoins(0);
    setPlayerDead(false);
    setGameSession(s => s + 1);
    setGameState("running");
    setControl({
      left: false,
      right: false,
      shoot: false,
      jump: false
    });

    // --- FREESOUND MUSIC LOGIC ---
    setBgmError(null);

    // Stop any previous music
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Try to fetch Freesound preview url and play
    const FREESOUND_API = "https://freesound.org/apiv2/sounds/815595/?token=Qa32IPNmELYZ3iBhstYE6aRryuYkMuQPoZVj53Me";
    try {
      let resp = await fetch(FREESOUND_API);
      if (!resp.ok) throw new Error(`Freesound API error ${resp.status}: ${resp.statusText}`);
      let data = await resp.json();
      // preview-lq-mp3 is universally available
      let mp3url = data && data.previews && data.previews["preview-lq-mp3"];
      if (!mp3url) throw new Error("No audio preview found for sound.");
      // Create and play audio
      let audioObj = new Audio(mp3url);
      audioRef.current = audioObj;
      audioObj.volume = 1.0; // Full volume
      // Loop logic: restart audio at end (manual seamless loop)
      audioObj.loop = false;
      audioObj.addEventListener("ended", function() {
        // Restart immediately if game is still running
        if (gameState === "running") {
          audioObj.currentTime = 0;
          audioObj.play().catch(() => {});
        }
      });
      // Try to play (autoplay policy may block, but will generally work after user action)
      try {
        await audioObj.play();
      } catch (err) {
        setBgmError("Cannot play music: Autoplay blocked or error. Try clicking Start again.");
      }
    } catch (err) {
      setBgmError("Failed to load background music: " + (err.message || "Unknown error"));
    }

    // Core world logic
    gameWorld.current = new EndlessGameWorld({
      onScore: setScore,
      onKills: setKills,
      onCoins: setCoins,
      onGameOver: () => {
        setPlayerDead(true);
        setTimeout(() => setGameState("over"), 1200);
        // Pause music on game over
        if (audioRef.current) audioRef.current.pause();
      }
    });
  }, [gameState]);

  // Frame draw loop
  useAnimationFrame(() => {
    if (
      gameState === "running" &&
      canvasRef.current &&
      gameWorld.current
    ) {
      gameWorld.current.step(control);
      gameWorld.current.draw(canvasRef.current);
    }
  }, gameState === "running");

  // Cleanup audio on menu/game end
  useEffect(() => {
    if (gameState !== "running" && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // On unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [gameState]);

  // Keyboard controls (basic, no stacking combos)
  useEffect(() => {
    const onKeyDown = e => {
      if (gameState !== "running") return;
      if (["ArrowLeft", "a", "A"].includes(e.key)) setControl(c => ({ ...c, left: true }));
      if (["ArrowRight", "d", "D"].includes(e.key)) setControl(c => ({ ...c, right: true }));
      if ([" ", "w", "W"].includes(e.key)) setControl(c => ({ ...c, shoot: true }));
      if (["ArrowUp"].includes(e.key)) setControl(c => ({ ...c, jump: true }));
    };
    const onKeyUp = e => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) setControl(c => ({ ...c, left: false }));
      if (["ArrowRight", "d", "D"].includes(e.key)) setControl(c => ({ ...c, right: false }));
      if ([" ", "w", "W"].includes(e.key)) setControl(c => ({ ...c, shoot: false }));
      if (["ArrowUp"].includes(e.key)) setControl(c => ({ ...c, jump: false }));
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gameState]);

  return (
    <div className="neon-app-root">
      <HUD score={score} coins={coins} kills={kills} />
      <div className="game-canvas-container" key={gameSession}>
        <canvas
          id="game-canvas"
          ref={canvasRef}
          width={800}
          height={600}
          tabIndex={1}
          aria-label="Game Canvas"
        />
        {gameState !== "running" && (
          <Overlay
            state={gameState}
            score={score}
            kills={kills}
            coins={coins}
            onStart={startGame}
            playerDead={playerDead}
            bgmError={bgmError}
          />
        )}
      </div>
      <footer className="footer-note">2024 &copy; Neon Wasteland Alien Zombie Shooter</footer>
    </div>
  );
}

// PUBLIC_INTERFACE
function HUD({ score, coins, kills }) {
  return (
    <div className="hud-container">
      <div className="hud-left">
        <div className="hud-label">
          <span className="zombie-icon" /> Kills: {kills}
        </div>
      </div>
      <div className="hud-center">
        <div className="hud-title">SCORE: {score}</div>
      </div>
      <div className="hud-right">
        <div className="hud-label coins">
          <span className="coin-icon" /> {coins}
        </div>
      </div>
    </div>
  );
}

/**
 * Overlay component with extra error message support for background music loading/playing
 */
// PUBLIC_INTERFACE
function Overlay({ state, score, kills, coins, onStart, playerDead, bgmError }) {
  if (state === "menu")
    return (
      <div className="game-overlay" tabIndex={-1}>
        <h1 className="neon-title">NEON WASTELAND <span className="accent-text">ZOMBIE SHOOTER</span></h1>
        <p className="subtitle neon-text">
          Survive as long as you can, shoot zombies, collect coins.<br />
          <b>No levels.</b> Just action.<br /><br />
          Controls: <kbd>←</kbd>/<kbd>→</kbd> or <kbd>A</kbd>/<kbd>D</kbd> to move<br />
          <kbd>Space</kbd> or <kbd>W</kbd> to shoot<br />
          <kbd>↑</kbd> to jump
        </p>
        <button className="neon-btn" onClick={onStart} autoFocus>
          Start Game
        </button>
        {bgmError && (
          <div style={{
            marginTop: '1em',
            color: '#ff7777',
            background: '#23243a',
            borderRadius: '8px',
            padding: '8px 18px',
            maxWidth: 400,
            fontSize: '1em',
            textAlign: 'center',
            boxShadow: '0 0 10px #aa2c6922'
          }}>
            <b>Music error:</b> {bgmError}
          </div>
        )}
      </div>
    );
  if (state === "over")
    return (
      <div className="game-overlay" tabIndex={-1}>
        <div className="game-over-title">GAME OVER</div>
        <div className="big-score">Final Score: {score}</div>
        <div className="coins neon-glow">Coins: <span>{coins}</span></div>
        <div className="neon-text" style={{ color: "var(--neon-primary)" }}>
          Zombies Killed: <span style={{ color: "var(--neon-accent)", fontWeight: 600 }}>{kills}</span>
        </div>
        <button className="neon-btn" style={{ fontSize: "1.2em", marginTop: "1.2em" }} onClick={onStart}>
          PLAY AGAIN
        </button>
        {bgmError && (
          <div style={{
            marginTop: '1em',
            color: '#ff7777',
            background: '#23243a',
            borderRadius: '8px',
            padding: '8px 18px',
            maxWidth: 400,
            fontSize: '1em',
            textAlign: 'center',
            boxShadow: '0 0 10px #aa2c6922'
          }}>
            <b>Music error:</b> {bgmError}
          </div>
        )}
      </div>
    );
  return null;
}


// PUBLIC_INTERFACE: useAnimationFrame
function useAnimationFrame(callback, running = true) {
  const reqRef = useRef();
  useEffect(() => {
    if (!running) return;
    let animate = ts => {
      callback(ts);
      reqRef.current = requestAnimationFrame(animate);
    };
    reqRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(reqRef.current);
  }, [callback, running]);
}

/**
 * PUBLIC_INTERFACE - Minimal endless-game world, basic single-zombie cycle,
 * draws _drawBG and ground, simple player+zombie+bullet system.
 * No extra milestone or progression logic.
 */
class EndlessGameWorld {
  constructor({ onScore, onKills, onCoins, onGameOver }) {
    this.width = 800;
    this.height = 600;
    this.groundY = this.height - 120;
    this.playerY = this.groundY - 48;
    this.state = "running";
    this.scrollX = 0;
    this.score = 0;
    this.kills = 0;
    this.coins = 0;
    this.onScore = onScore || (() => {});
    this.onKills = onKills || (() => {});
    this.onCoins = onCoins || (() => {});
    this.onGameOver = onGameOver || (() => {});
    this.zombies = [];
    this.bullets = [];
    this.effects = [];
    this._spawnPlayer();
    this._spawnInitialZombies();
    this.spawnTimer = 0;
    this.spawnInterval = 2000;
    this.lastTs = performance.now();
  }

  _spawnPlayer() {
    this.player = {
      x: 100,
      y: this.playerY,
      width: 32,
      height: 56,
      speed: 6,
      alive: true,
      shootTimer: 0,
      vy: 0,
      isJumping: false,
    };
  }

  _spawnInitialZombies() {
    // 3 zombies at random sides, all type green
    this.zombies = [];
    for (let i = 0; i < 3; ++i) {
      this.zombies.push(this._spawnZombie(Math.random() < 0.5 ? "left" : "right"));
    }
  }

  _spawnZombie(side) {
    let type = {
      color: "#6efd9a",
      shadow: "#39ff1475",
      head: "#161e13",
      eyes: "#fb73fa",
      speed: 1.2,
      w: 44,
      h: 62,
      coins: 2,
    };
    let entryX = side === "left" ? -60 : this.width + 60;
    let dir = side === "left" ? 1 : -1;
    let y = this.groundY - type.h + 8;
    return {
      x: entryX,
      y,
      w: type.w,
      h: type.h,
      speed: type.speed * (0.9 + Math.random() * 0.2),
      dir,
      dead: false,
      color: type.color,
      shadow: type.shadow,
      head: type.head,
      eyes: type.eyes,
      coins: type.coins,
    };
  }

  step(control) {
    let now = performance.now();
    let dt = Math.min(2, (now - this.lastTs) / 16.67);
    this.lastTs = now;

    // Player
    if (!this.player.alive) return;
    if (control.left) this.player.x = Math.max(0, this.player.x - this.player.speed * dt);
    if (control.right) this.player.x = Math.min(this.width - this.player.width, this.player.x + this.player.speed * dt);
    // Jump
    if (control.jump && !this.player.isJumping) {
      this.player.vy = -17;
      this.player.isJumping = true;
    }
    this.player.y += this.player.vy * dt;
    if (this.player.y < this.playerY - 96) this.player.vy += 2 * dt; // falling
    else this.player.vy += 1.4 * dt;
    if (this.player.y >= this.playerY) {
      this.player.y = this.playerY;
      this.player.vy = 0;
      this.player.isJumping = false;
    }
    // Shoot
    this.player.shootTimer -= 16 * dt;
    if (control.shoot && this.player.shootTimer <= 0) {
      this.bullets.push({
        x: this.player.x + this.player.width,
        y: this.player.y + 18,
        vx: 15,
        radius: 4,
        alive: true,
        color: "#39ff14"
      });
      this.player.shootTimer = 220;
    }

    // Bullets step
    this.bullets.forEach(bul => {
      bul.x += bul.vx * dt;
      if (bul.x > this.width + 30) bul.alive = false;
    });
    this.bullets = this.bullets.filter(b => b.alive);

    // Zombies walk
    this.zombies.forEach(zm => {
      if (zm.dead) return;
      zm.x += zm.speed * zm.dir * dt;
    });

    // Bullet-zombie collisions
    for (let i = 0; i < this.zombies.length; ++i) {
      let z = this.zombies[i];
      if (z.dead) continue;
      for (let j = 0; j < this.bullets.length; ++j) {
        let b = this.bullets[j];
        if (
          b.alive &&
          b.x > z.x &&
          b.x < z.x + z.w &&
          b.y > z.y &&
          b.y < z.y + z.h
        ) {
          z.dead = true;
          b.alive = false;
          this.score += 150;
          this.coins += z.coins;
          this.kills += 1;
          this.onScore(this.score);
          this.onKills(this.kills);
          this.onCoins(this.coins);
          this.effects.push({ x: z.x + z.w / 2, y: z.y + z.h / 2, t: 0 });
        }
      }
    }
    // Remove dead zombies
    let livingZs = this.zombies.filter(z => !z.dead && z.x > -90 && z.x < this.width + 90);
    // Respawn
    while (livingZs.length < 3) {
      livingZs.push(this._spawnZombie(Math.random() < 0.5 ? "left" : "right"));
    }
    this.zombies = livingZs;

    // Player-zombie collision = game over
    for (let i = 0; i < this.zombies.length; ++i) {
      let z = this.zombies[i];
      if (
        !z.dead &&
        this.player.alive &&
        z.x + z.w > this.player.x + 8 &&
        z.x < this.player.x + this.player.width - 3 &&
        z.y + z.h > this.player.y + 10 &&
        z.y < this.player.y + this.player.height - 5
      ) {
        this.player.alive = false;
        this.onGameOver();
        break;
      }
    }

    // Animate effects (score poof)
    this.effects.forEach(e => (e.t += dt));
    this.effects = this.effects.filter(e => e.t < 19);
  }

  // PUBLIC_INTERFACE
  draw(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this._drawBG(ctx);

    // Draw ground band
    ctx.save();
    ctx.fillStyle = "#3fff33bb";
    ctx.fillRect(0, this.groundY, this.width, 28);
    ctx.restore();

    // Player
    if (this.player.alive) {
      ctx.save();
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#39ff14";
      ctx.shadowBlur = 16;
      ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
      ctx.restore();

      // Draw "visor"
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.player.x + 19, this.player.y + 16, 6, 0, 2 * Math.PI);
      ctx.fillStyle = "#39ff14";
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 3;
      ctx.fill();
      ctx.restore();
    }

    // Bullets
    this.bullets.forEach(b => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#39ff14";
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    });

    // Zombies
    this.zombies.forEach(z => {
      if (z.dead) return;
      ctx.save();
      ctx.fillStyle = z.color;
      ctx.shadowColor = "#39ff14";
      ctx.shadowBlur = 13;
      ctx.fillRect(z.x, z.y, z.w, z.h);
      // Eyes
      ctx.fillStyle = "#fb73fa";
      ctx.beginPath();
      ctx.arc(z.x + 13, z.y + 17, 5, 0, 2 * Math.PI);
      ctx.arc(z.x + 30, z.y + 17, 4.6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // Head
      ctx.save();
      ctx.fillStyle = z.head;
      ctx.beginPath();
      ctx.arc(z.x + z.w / 2, z.y + 9, 13, 0, 2 * Math.PI);
      ctx.shadowColor = "#0e1116";
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.restore();
    });

    // Score/kill effect pops
    this.effects.forEach(e => {
      ctx.save();
      ctx.globalAlpha = 1 - e.t / 19;
      ctx.font = "bold 18px Segoe UI, Arial";
      ctx.fillStyle = "#39ff14";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.1;
      ctx.textAlign = "center";
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 8;
      ctx.fillText("+150", e.x, e.y - e.t * 2.5);
      ctx.restore();
    });
  }

  // PUBLIC_INTERFACE
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
  }
}

export default App;
