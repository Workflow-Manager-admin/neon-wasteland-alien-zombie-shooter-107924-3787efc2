import React, { useState, useEffect, useRef } from "react";
import { saveHighscore } from "./supabaseClient";
import Leaderboard from "./components/Leaderboard.jsx";

// ------------ GAME CONSTANTS AND THEME ------------
const THEME = {
  primary: "#39ff14",
  accent: "#aa2c69",
  dark: "#1a1a1a",
  canvasW: 0.95,
  canvasH: 0.9,
};

const ENEMY_TYPES = {
  zombie: {
    key: "zombie",
    w: 44,
    h: 62,
    speed: 1.36,
    color: "#39ff14",
    accent: "#6efd9a",
    eye: "#fb73fa",
    score: 100,
    radius: 28,
    damage: 24,
  },
  bird: {
    key: "bird",
    w: 38,
    h: 36,
    speed: 2.3,
    color: "#2ecffd",
    accent: "#39ff14",
    eye: "#fff",
    score: 170,
    radius: 18,
    damage: 18,
  },
  bot: {
    key: "bot",
    w: 41,
    h: 46,
    speed: 1.68,
    color: "#aa2c69",
    accent: "#fff",
    eye: "#fff",
    score: 130,
    radius: 22,
    damage: 22,
  },
};

const ENEMY_KEYS = Object.keys(ENEMY_TYPES);
const rand = (min, max) => Math.random() * (max - min) + min;
const getDims = () => {
  const w = Math.floor(window.innerWidth * THEME.canvasW);
  const h = Math.floor(window.innerHeight * THEME.canvasH);
  const width = Math.min(w, h * 4 / 3);
  const height = Math.min(h, width * 3 / 4);
  return { width, height };
};

const SCANLINE_COLOR = "rgba(58,255,20,0.18)";

// BULLETS: Use circle/emoji/plasma, randomly picked
const BULLET_EMOJIS = ["🟢", "💥", "➡️", "•", "⚡"];
function chooseBulletEmoji() {
  // Add variation and fun
  return BULLET_EMOJIS[Math.floor(rand(0, BULLET_EMOJIS.length))];
}

const PLAYER_MAX_HEALTH = 120;
const PLAYER_INVULN_FRAMES = 850;

// PUBLIC_INTERFACE
export default function Game() {
  // -- Hooks / State
  const [dims, setDims] = useState(getDims());
  const [gameState, setGS] = useState("menu"); // menu | play | over
  const [score, setScore] = useState(0);
  const [showLB, setShowLB] = useState(false);
  const [namePrompt, setNP] = useState(false);
  const [playerName, setPN] = useState("");
  const [status, setStatus] = useState("");
  const [playerHealth, setPlayerHealth] = useState(PLAYER_MAX_HEALTH);

  // Ref state
  const canvasRef = useRef(null);
  const playerRef = useRef({
    x: 200,
    y: 0,
    w: 36,
    h: 56,
    dir: 1,
    cd: 0,
    radius: 26,
    health: PLAYER_MAX_HEALTH,
    invulnUntil: 0,
  });
  const enemiesRef = useRef([]);
  const bulletsRef = useRef([]);
  const keysRef = useRef({ left: false, right: false, shoot: false });
  const tickRef = useRef(0);
  const spawnTimer = useRef(0);

  // Responsive resize
  useEffect(() => {
    const onR = () => setDims(getDims());
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const kDown = (e) => {
      if (gameState !== "play") return;
      if (["ArrowLeft", "a", "A"].includes(e.key))
        keysRef.current.left = true;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = true;
      if ([" ", "ArrowUp", "w", "W"].includes(e.key))
        keysRef.current.shoot = true;
    };
    const kUp = (e) => {
      if (["ArrowLeft", "a", "A"].includes(e.key))
        keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key))
        keysRef.current.right = false;
      if ([" ", "ArrowUp", "w", "W"].includes(e.key))
        keysRef.current.shoot = false;
    };
    window.addEventListener("keydown", kDown);
    window.addEventListener("keyup", kUp);
    return () => {
      window.removeEventListener("keydown", kDown);
      window.removeEventListener("keyup", kUp);
    };
  }, [gameState]);

  // Game loop
  useEffect(() => {
    if (gameState !== "play") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId,
      last = performance.now();
    const loop = (ts) => {
      const dt = ts - last;
      last = ts;
      tickRef.current++;
      updateLogic(dt);
      draw(ctx);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
    // eslint-disable-next-line
  }, [gameState, dims]);

  // Start or restart game
  function startGame() {
    reset();
    setPlayerHealth(PLAYER_MAX_HEALTH);
    setGS("play");
  }

  // ----------- GAME UPDATE LOGIC -----------
  function updateLogic(dt) {
    const p = playerRef.current;
    // Movement
    if (keysRef.current.left) {
      p.x -= 8;
      p.dir = -1;
    }
    if (keysRef.current.right) {
      p.x += 8;
      p.dir = 1;
    }
    p.x = Math.max(32, Math.min(dims.width - 32, p.x));

    // Cooldown for shoot
    if (keysRef.current.shoot && p.cd <= 0) {
      let bulletEmoji = chooseBulletEmoji();
      let bulletX =
        p.x + (p.dir === 1 ? 22 : -22); // Barrel tip offset
      let bulletY = dims.height - 120 - 20; // Height from bottom
      bulletsRef.current = [
        ...bulletsRef.current,
        { x: bulletX, y: bulletY, vx: p.dir * 22, r: 13, emoji: bulletEmoji },
      ];
      p.cd = 170;
    }
    p.cd -= dt;

    // Move bullets
    bulletsRef.current = [...bulletsRef.current]
      .map((b) => ({ ...b, x: b.x + b.vx }))
      .filter((b) => b.x > -60 && b.x < dims.width + 60);

    // Enemy spawn - spawn rate reduced for balance!
    spawnTimer.current += dt;
    const rateMod = Math.max(1, Math.floor(score / 950) + 1.0);
    const targetDelay = Math.min(
      1650 / rateMod,
      1500 - Math.min(score, 600) * 1.9
    );
    if (spawnTimer.current > targetDelay) {
      spawnTimer.current = 0;
      spawnEnemy();
    }

    // Enemy movement
    enemiesRef.current = [...enemiesRef.current]
      .map((e) => ({ ...e, x: e.x + e.vx }))
      .filter(
        (e) => e.x > -e.w - 80 && e.x < dims.width + e.w + 80 && !e.dead
      );

    // ---- Bullet vs Enemy collisions ----
    let hit = false;
    bulletsRef.current = [...bulletsRef.current];
    enemiesRef.current = [...enemiesRef.current];
    for (let bi = 0; bi < bulletsRef.current.length; ++bi) {
      const b = bulletsRef.current[bi];
      for (let ei = 0; ei < enemiesRef.current.length; ++ei) {
        const e = enemiesRef.current[ei];
        if (e.dead) continue;
        // Distance
        const dx = b.x - e.x,
          dy = b.y - e.y;
        let collide = false;
        if (e.key === "bird") {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < (b.r + e.radius) * 0.92) collide = true;
        } else {
          // Rectangle (enemy) + circle (bullet)
          const rx = e.x - e.w / 2,
            ry = e.y - e.h / 2;
          let closestX = Math.max(rx, Math.min(b.x, rx + e.w));
          let closestY = Math.max(ry, Math.min(b.y, ry + e.h));
          let dist = Math.hypot(closestX - b.x, closestY - b.y);
          if (dist < (b.r + 7)) collide = true;
        }
        if (collide) {
          // Remove one enemy and kill bullet
          enemiesRef.current[ei].dead = true;
          bulletsRef.current[bi]._kill = true;
          setScore((s) => s + e.score);
          hit = true;
        }
      }
    }
    bulletsRef.current = bulletsRef.current.filter((b) => !b._kill);

    // ----------- Player health & death -----------
    const playerY = dims.height - 120;
    const playerHitY = playerY - 35;
    let playerHitRect = {
      x: p.x - 16,
      y: playerHitY,
      w: 32,
      h: 50,
    };
    const now = Date.now();
    let playerGotHit = false;
    for (let i = 0; i < enemiesRef.current.length; ++i) {
      const e = enemiesRef.current[i];
      if (e.dead) continue;
      let ex = e.x - e.w / 2,
        ey = e.y - e.h / 2;
      let overlap =
        ex < playerHitRect.x + playerHitRect.w &&
        ex + e.w > playerHitRect.x &&
        ey < playerHitRect.y + playerHitRect.h &&
        ey + e.h > playerHitRect.y;
      if (overlap) {
        // If player's invuln expired, register hit
        if (!p.invulnUntil || now > p.invulnUntil) {
          playerGotHit = true;
          let dmg = e.damage || 18;
          p.health = Math.max(0, (p.health || PLAYER_MAX_HEALTH) - dmg);
          setPlayerHealth(p.health);
          p.invulnUntil = now + PLAYER_INVULN_FRAMES;
        }
      }
    }
    if ((p.health || PLAYER_MAX_HEALTH) <= 0) {
      setGS("over");
      setTimeout(() => setNP(true), 560);
    }
  }

  // ----------- Drawing (canvas) -----------
  function draw(ctx) {
    if (!ctx) return;
    const { width, height } = dims;
    ctx.clearRect(0, 0, width, height);
    drawBG(ctx, width, height);

    // Draw entities
    for (const e of enemiesRef.current) {
      if (e.dead) continue;
      drawEnemy(ctx, e, dims, tickRef.current);
    }
    for (const b of bulletsRef.current) {
      drawBullet(ctx, b, dims);
    }
    drawPlayer(ctx, playerRef.current, dims);

    // HUD Health Bar (drawn in-canvas)
    drawHealthMeter(ctx, playerRef.current, width, height);
  }

  // ----------- Enemy Spawning -----------
  function spawnEnemy() {
    const key = ENEMY_KEYS[Math.floor(Math.random() * ENEMY_KEYS.length)];
    const base = ENEMY_TYPES[key];
    const sideL = Math.random() < 0.5;
    enemiesRef.current = [
      ...enemiesRef.current,
      {
        ...base,
        x: sideL ? -base.w : dims.width + base.w,
        y:
          key === "bird"
            ? rand(dims.height * 0.22, dims.height * 0.53)
            : dims.height - base.h - 88,
        vx: sideL ? base.speed : -base.speed,
        dead: false,
        flapt: Math.random() * Math.PI * 2, // for birds only
      },
    ];
  }

  // ----------- HIGH SCORE SAVE ----------
  async function handleSave() {
    try {
      await saveHighscore(playerName || "Anon", score);
      setStatus("Saved!");
    } catch (e) {
      setStatus("Save failed");
    }
    setTimeout(() => {
      setGS("menu");
      reset();
    }, 1200);
  }

  function reset() {
    enemiesRef.current = [];
    bulletsRef.current = [];
    playerRef.current = {
      x: Math.floor(dims.width * 0.14),
      y: dims.height - 120,
      w: 36,
      h: 56,
      dir: 1,
      cd: 0,
      radius: 26,
      health: PLAYER_MAX_HEALTH,
      invulnUntil: 0,
    };
    setPlayerHealth(PLAYER_MAX_HEALTH);
    setScore(0);
    setNP(false);
    setStatus("");
    spawnTimer.current = 0;
    spawnEnemy();
  }

  // ----------- Main JSX -----------
  return (
    <div className="neon-app-root">
      <div className="hud-container">
        <div className="hud-label">
          <span style={{
            display: 'inline-block',
            width: 18, height: 18,
            verticalAlign: 'middle',
            marginRight: 7,
            marginTop: -2,
            borderRadius: 4,
            background: "linear-gradient(120deg,#39ff14 60%,#6efd9a 100%)",
            boxShadow: "0 0 6px #39ff14a0",
            border: "2px solid #181925"
          }} />
          Score: <b style={{ marginLeft: 7 }}>{score}</b>
        </div>
        <div className="hud-center">
          <span
            className="hud-title"
            style={{
              textShadow: "0 0 9px #39ff14,0 0 14px #39ff14",
            }}
          >
            NEON WASTELAND ZOMBIE SHOOTER
          </span>
        </div>
        {gameState === "play" && (
          <button className="neon-btn" onClick={() => setGS("menu")}>
            Quit
          </button>
        )}
      </div>
      <div
        className="game-canvas-container"
        style={{
          marginTop: 60,
          width: dims.width,
          height: dims.height,
          boxShadow: "0 0 44px 8px #aa2c6926",
        }}
      >
        <canvas
          id="game-canvas"
          ref={canvasRef}
          width={dims.width}
          height={dims.height}
          style={{
            width: dims.width,
            height: dims.height,
            borderRadius: 16,
            display: "block",
            background: "#191925",
          }}
        />
        {gameState === "menu" && (
          <div className="game-overlay">
            <h1 className="neon-title">NEON WASTELAND ZOMBIE SHOOTER</h1>
            <div
              className="subtitle"
              style={{
                marginBottom: 25,
                textShadow: "0 0 14px #aa2c69",
              }}
            >
              Press <kbd>Space</kbd> / <kbd>W</kbd> to shoot,{" "}
              <kbd>Left/Right</kbd> to move
            </div>
            <button
              className="neon-btn"
              onClick={startGame}
              autoFocus
              style={{
                fontWeight: 700,
                fontSize: "1.22em",
                margin: 10,
              }}
            >
              Start Game
            </button>
            <button
              className="neon-btn neon-btn-accent"
              style={{ marginTop: 18 }}
              onClick={() => setShowLB(true)}
            >
              Leaderboard
            </button>
          </div>
        )}
        {gameState === "over" && !namePrompt && (
          <div className="game-overlay">
            <h1 className="game-over-title">GAME&nbsp;OVER</h1>
            <div className="big-score">Your Score: {score}</div>
            <div className="big-score" style={{ color: "#faa", fontSize: "1.11em" }}>
              Health depleted!
            </div>
          </div>
        )}
        {namePrompt && (
          <div className="game-overlay">
            <div
              style={{
                marginBottom: 10,
                fontWeight: 700,
                fontSize: "1.16em",
              }}
            >
              Your Score: {score}
            </div>
            <input
              value={playerName}
              onChange={(e) => setPN(e.target.value.slice(0, 15))}
              placeholder="name"
              className="neon-input"
              style={{
                padding: "8px 14px",
                fontSize: "1.12em",
                borderRadius: 8,
                marginBottom: 5,
                border: "none",
              }}
            />
            <button
              className="neon-btn"
              style={{ marginTop: 10 }}
              onClick={handleSave}
            >
              Save
            </button>
            <div style={{ marginTop: 8 }}>{status}</div>
          </div>
        )}
        <Leaderboard visible={showLB} onClose={() => setShowLB(false)} />
      </div>
      <div className="footer-note" style={{ marginBottom: 8, color: "#2ecffd", fontSize: "0.96em" }}>
        Tip: Survive longer! Now with health bar, invulnerability after being hit, and emoji bullets.
      </div>
    </div>
  );
}

// --------- Canvas Neon Drawing Utilities & Helpers ---------

function drawBG(ctx, w, h) {
  // Neon gradient + scanlines as before
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#2b2870");
  g.addColorStop(0.66, "#141429");
  g.addColorStop(1, "#0b0b15");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.09;
  ctx.fillStyle = SCANLINE_COLOR;
  for (let i = 0; i < h; i += 14) ctx.fillRect(0, i, w, 2);
  ctx.globalAlpha = 1.0;

  // --- VISUAL DEBUG: Draw a NEON ground reference line for sprite placement debugging ---
  const groundY = h - Math.max(48, h * 0.06);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.strokeStyle = "#2ecffd";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 12;
  ctx.globalAlpha = 0.53;
  ctx.setLineDash([10, 12]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;
  ctx.restore();
}

/**
 * PUBLIC_INTERFACE
 * Draws the player as a neon alien/humanoid with gun. Gun and arm extend left/right based on facing.
 * All body parts and gun must be clearly visible and proportioned above the ground, taking into account canvas scaling.
 * 
 * - Baseline for player is always at ground level (calculated from canvas height).
 * - Responsive scaling used for desktop/mobile.
 * - Coherent y-origin and clear separation between torso, legs, arms, head, and weapon.
 */
function drawPlayer(ctx, p, dims) {
  ctx.save();

  // DEBUG: always show a ground alignment line (should match the drawBG groundY line)
  const groundY = dims.height - Math.max(48, dims.height * 0.06);

  // -- Define player anatomy: always draw from ground upward --
  ctx.translate(p.x, groundY);

  // Responsive, clamped height for full-body visibility
  const idealCharH = Math.max(62, Math.min(0.18 * dims.height, 108)); // never less than 62px, never more than 108
  const proportions = {
    headH: Math.round(idealCharH * 0.32),
    headW: Math.round(idealCharH * 0.25),
    torsoH: Math.round(idealCharH * 0.38),
    torsoW: Math.round(idealCharH * 0.14),
    legL: Math.round(idealCharH * 0.28),
    armL: Math.round(idealCharH * 0.57),
  };
  const headH = proportions.headH, headW = proportions.headW;
  const torsoH = proportions.torsoH, torsoW = proportions.torsoW;
  const legL = proportions.legL, armL = proportions.armL;
  const armW = Math.max(4, Math.round(idealCharH * 0.11));
  const gunW = Math.max(idealCharH * 0.34, 18), gunH = Math.max(idealCharH * 0.10, 9);

  // Attach leg origins to y=0 (ground), all body parts above.
  // Player always fully above ground now.
  // Facing direction: 1 = right, -1 = left
  const dir = p.dir === 1 ? 1 : -1;

  // -- DEBUG: Draw bounding box for figure for dev sanity --
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#2ecffd";
  ctx.lineWidth = 2;
  ctx.setLineDash([6,5]);
  ctx.strokeRect(-torsoW-8, -legL-torsoH-headH-8, 2*torsoW+16, legL+torsoH+headH+18);
  ctx.setLineDash([]);
  ctx.restore();

  // -- Draw legs (thicker, reach to y=0, base of canvas) --
  ctx.save();
  ctx.shadowColor = "#aa2c69";
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "#39ff14";
  ctx.lineWidth = armW+2;
  ctx.beginPath();
  ctx.moveTo(-torsoW*0.6, 0);         ctx.lineTo(-torsoW*0.6, legL);
  ctx.moveTo(torsoW*0.6, 0);          ctx.lineTo(torsoW*0.6, legL * 0.97);
  ctx.stroke();
  ctx.restore();

  // -- Draw torso (rectangle, above legs) --
  ctx.save();
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 11;
  ctx.fillStyle = "#552bfe";
  ctx.fillRect(-torsoW, -legL-torsoH, 2*torsoW, torsoH);
  ctx.restore();

  // -- Draw arms (1 gun arm, 1 relaxed arm) --
  ctx.save();
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 7;
  ctx.lineWidth = armW;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#fff";
  // Gun arm (forward, along gun)
  ctx.beginPath();
  ctx.moveTo(-torsoW*0.83, -legL-torsoH*0.4);
  ctx.lineTo(dir*(torsoW*1.45), -legL-torsoH*0.63);
  ctx.stroke();
  // Off arm
  ctx.beginPath();
  ctx.moveTo(torsoW*0.83, -legL-torsoH*0.13);
  ctx.lineTo(torsoW*1.18, -legL+torsoH*0.31);
  ctx.stroke();
  ctx.restore();

  // -- Draw gun (attached to end of gun arm, always visible, not below ground!) --
  ctx.save();
  ctx.shadowColor = "#2ecffd";
  ctx.shadowBlur = 8;
  const gunBaseX = dir*(torsoW*1.45);
  const gunBaseY = -legL-torsoH*0.63 - gunH/2;
  ctx.fillStyle = "#191925";
  ctx.fillRect(gunBaseX, gunBaseY, dir * gunW, gunH);
  // Barrel tip accent 
  ctx.fillStyle = "#2ecffd";
  ctx.fillRect(gunBaseX + dir*(gunW-gunH*0.28), gunBaseY+gunH*0.18, dir*Math.max(gunH*0.98,7), gunH*0.39);
  // Muzzle flash (shooting)
  if (p.cd > 130 && p.cd < 170) {
    ctx.save();
    ctx.globalAlpha = 0.83;
    ctx.shadowColor = "#2ecffd";
    ctx.shadowBlur = Math.max(21, gunH*2.2);
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = gunH*0.82;
    ctx.beginPath();
    ctx.moveTo(gunBaseX + dir*(gunW+gunH*0.92), gunBaseY+gunH*0.49);
    ctx.lineTo(gunBaseX + dir*(gunW+gunH*1.71), gunBaseY+gunH*0.55);
    ctx.stroke();
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.arc(gunBaseX + dir * (gunW+gunH*1.71), gunBaseY+gunH*0.67, gunH*0.65, 0, 2*Math.PI);
    ctx.stroke();
    ctx.restore();
  }
  // Gun emoji overlaid
  ctx.save();
  ctx.font = `${Math.round(gunH*1.32)}px Segoe UI Emoji, Apple Color Emoji, sans-serif`;
  ctx.globalAlpha = 0.96;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🔫", gunBaseX+dir*gunW*0.62, gunBaseY+gunH*0.45);
  ctx.restore();
  ctx.restore();

  // -- Draw head (on top of torso) --
  ctx.save();
  ctx.shadowColor = "#f7ffc3";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.ellipse(0, -legL-torsoH-headH/2, headW, headH, 0, 0, 2*Math.PI);
  ctx.fillStyle = "#39ff14";
  ctx.fill();
  // Neon eye/accent
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#aa2c69";
  ctx.beginPath();
  ctx.ellipse(0, -legL-torsoH-headH/2 - Math.max(4, headH*0.12), headW*0.28, headH*0.23, 0, 0, 2*Math.PI);
  ctx.fill();
  ctx.restore();

  // -- Visual debugging: show key anchor points --
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#2ecffd";
  // Ground/feet
  ctx.beginPath();
  ctx.arc(-torsoW*0.6, 0, 4, 0, 2*Math.PI);
  ctx.arc(torsoW*0.6, 0, 4, 0, 2*Math.PI);
  ctx.fill();
  // Head anchor (top)
  ctx.beginPath();
  ctx.arc(0, -legL-torsoH-headH, 3.2, 0, 2*Math.PI);
  ctx.fill();
  // Center
  ctx.beginPath();
  ctx.arc(0, -legL-torsoH/2, 2.6, 0, 2*Math.PI);
  ctx.fill();
  ctx.restore();

  // -- Player shield glow for invuln --
  if (p.invulnUntil && Date.now() < p.invulnUntil) {
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.22*Math.sin(Date.now()/110);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, -legL-torsoH*0.42, idealCharH*0.59, 0, 2*Math.PI);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}


// PUBLIC_INTERFACE
// Render a bullet as an emoji or neon glowing circle
function drawBullet(ctx, b, dims) {
  ctx.save();
  // With 85% probability, use emoji, otherwise plasma-style glowing dot
  if (b.emoji && Math.random() > 0.15) {
    ctx.font = "bold 31px Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#2ecffd";
    ctx.shadowBlur = 15;
    ctx.globalAlpha = 1;
    ctx.fillText(b.emoji, b.x, b.y + 1);
  } else {
    ctx.globalAlpha = 1;
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 19;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 11, 0, 2 * Math.PI);
    ctx.fillStyle = "#6efd9a";
    ctx.fill();
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#39ff14";
    ctx.fill();
  }
  ctx.restore();
}

// PUBLIC_INTERFACE
// Draws an enemy using only canvas primitives and/or emoji
function drawEnemy(ctx, e, dims, tick) {
  ctx.save();
  ctx.globalAlpha = 0.98;

  if (e.key === "bird") {
    // Neon flapping bird - composed ellipse/triangle/wing
    const t = (Date.now()/150 + e.flapt) % (2*Math.PI);
    const yBob = Math.sin(t) * 4.5;
    // Body (oval)
    ctx.save();
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 13;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + yBob, e.radius, e.radius*0.85, 0, 0, 2*Math.PI);
    ctx.fillStyle = "#2ecffd";
    ctx.fill();
    // Wing (flap)
    ctx.globalAlpha = 0.25 + 0.30 * Math.abs(Math.cos(t));
    ctx.save();
    ctx.translate(e.x - 3, e.y + yBob - 3);
    ctx.rotate(Math.PI / 2.2 * Math.sin(t));
    ctx.beginPath();
    ctx.ellipse(0, 0, e.radius*1.25, 7.5, 0, 0, 2*Math.PI);
    ctx.fillStyle = "#39ff1499";
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.98;
    // Eye
    ctx.beginPath();
    ctx.arc(e.x + 7, e.y + yBob - 4, 2.8, 0, 2*Math.PI);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 2;
    ctx.fill();
    // Beak (triangle)
    ctx.beginPath();
    ctx.moveTo(e.x + e.radius - 1, e.y + yBob);
    ctx.lineTo(e.x + e.radius + 9, e.y + yBob-4);
    ctx.lineTo(e.x + e.radius + 9, e.y + yBob+4);
    ctx.closePath();
    ctx.fillStyle = "#ffd900";
    ctx.fill();
    ctx.restore();
    // Occasionally show a "🐦" emoji bounce for extra personality
    if ((tick || 0)%111 < 12) {
      ctx.save();
      ctx.font = `${Math.round(e.radius*2.1)}px Segoe UI Emoji, Apple Color Emoji`;
      ctx.globalAlpha = 0.34;
      ctx.fillText("🐦", e.x + 1, e.y + yBob - e.radius - 8);
      ctx.restore();
    }
  } else if (e.key === "bot") {
    // Bot: Rectangle body + robot face accents + glowing eyes (or emoji every few seconds)
    ctx.save();
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 13;
    let w = e.w,
      h = e.h;
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - w / 2, e.y - h / 2, w, h);
    // Robot "antenna"
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y-h/2);
    ctx.lineTo(e.x, e.y-h/2-13);
    ctx.stroke();
    ctx.restore();

    // Eyes
    ctx.save();
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(e.x + w / 6, e.y - h / 6, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.shadowBlur = 17;
    ctx.fillStyle = "#39ff14";
    ctx.beginPath();
    ctx.arc(e.x - w / 6, e.y - h / 7, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Neon outline
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(e.x - w / 2, e.y - h / 2, w, h);
    ctx.restore();

    // Small mouth
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.moveTo(e.x - 7, e.y + h / 7);
    ctx.lineTo(e.x + 7, e.y + h / 7);
    ctx.globalAlpha = 0.5;
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.restore();

    // Rare personality boost: Draw 🤖 emoji
    if (tick && (tick%143 === 0)) {
      ctx.save();
      ctx.font = `${Math.round(w*1.13)}px Segoe UI Emoji, Apple Color Emoji`;
      ctx.globalAlpha = 0.19;
      ctx.fillText("🤖", e.x, e.y - h/2 + 18);
      ctx.restore();
    }
  } else {
    /**
     * Zombie: always draw feet-to-head fully above ground using canvas proportions and constant scale
     */
    ctx.save();

    // Guarantee ground anchor
    const groundY = dims.height - Math.max(42, dims.height * 0.05);

    // Proportion: always full visible
    const zH = Math.max(54, Math.min(dims.height * 0.16, 115));
    const zW = Math.max(27, Math.floor(zH * 0.60));
    const legL = Math.round(zH * 0.28);
    const torsoH = Math.round(zH * 0.36);
    const torsoW = Math.round(zW * 0.86);
    const headH = Math.round(zH * 0.29);
    const headW = Math.round(zW * 0.95);

    // DEBUG: bounding rect
    ctx.translate(e.x, groundY);
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = "#fb73fa";
    ctx.setLineDash([8,6]);
    ctx.strokeRect(-torsoW-8, -legL-torsoH-headH-9, 2*torsoW+16, legL+torsoH+headH+15);
    ctx.setLineDash([]);
    ctx.restore();

    // -- LEGS --
    ctx.save();
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = Math.max(5.2, torsoW * 0.15);
    ctx.beginPath();
    ctx.moveTo(-torsoW * 0.32, 0); // left foot
    ctx.lineTo(-torsoW * 0.32, legL);
    ctx.moveTo(torsoW * 0.32, 0);  // right foot
    ctx.lineTo(torsoW * 0.32, legL * 0.93);
    ctx.stroke();
    ctx.restore();

    // -- TORSO --
    ctx.save();
    ctx.shadowColor = "#6efd9a";
    ctx.shadowBlur = 13;
    ctx.fillStyle = "#6efd9a";
    ctx.beginPath();
    ctx.roundRect(
      -torsoW, -legL-torsoH, 2*torsoW, torsoH+7,
      Math.max(6, torsoW*0.24)
    );
    ctx.fill();
    ctx.restore();

    // -- Arms --
    ctx.save();
    ctx.shadowColor = "#6efd9a";
    ctx.shadowBlur = 6;
    ctx.strokeStyle = "#6efd9a";
    ctx.lineWidth = Math.max(3.4, torsoW * 0.16);
    ctx.lineCap = "round";
    ctx.beginPath();
    // Left arm
    ctx.moveTo(-torsoW * 0.96, -legL-torsoH/1.65 + 10*Math.sin(Date.now()/200));
    ctx.lineTo(-torsoW * 0.44, -legL-torsoH/2);
    // Right arm (a bit higher)
    ctx.moveTo(torsoW * 0.44, -legL-torsoH/2.35);
    ctx.lineTo(torsoW * 0.93, -legL-torsoH/1.65 + 11*Math.cos(Date.now()/210));
    ctx.stroke();
    ctx.restore();

    // -- Head on top of body
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#39ff14";
    ctx.beginPath();
    ctx.ellipse(0, -legL-torsoH-headH/2, headW, headH, Math.PI * 0.039, 0, 2*Math.PI);
    ctx.fill();
    // Forehead accent (white shine)
    ctx.globalAlpha = 0.13;
    ctx.beginPath();
    ctx.arc(-2, -legL-torsoH-headH/2 + Math.max(5, headH*0.27), headW*0.37, 0, 2*Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // -- Eyes --
    ctx.save();
    ctx.shadowBlur = Math.max(Math.round(headH*0.36), 6);
    ctx.fillStyle = "#fb73fa";
    ctx.beginPath();
    ctx.arc(-headW*0.28, -legL-torsoH-headH/2-2, headW*0.21, 0, 2*Math.PI);
    ctx.fill();
    ctx.shadowColor = "#fff";
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(headW*0.26, -legL-torsoH-headH/2-0.6, headW*0.16, 0, 2*Math.PI);
    ctx.fill();
    ctx.restore();

    // -- Mouth
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#aa2c69";
    ctx.lineWidth = Math.max(2, headW*0.10);
    ctx.beginPath();
    ctx.arc(0, -legL-torsoH-headH/2+headH*0.49, headW*0.29, Math.PI*0.22, Math.PI*0.75);
    ctx.stroke();
    ctx.restore();

    // -- Visual debugging connections: feet/head centers
    ctx.save();
    ctx.globalAlpha = 0.48;
    ctx.fillStyle = "#fb73fa";
    ctx.beginPath();
    ctx.arc(-torsoW*0.32, 0, 2.8, 0, 2*Math.PI); // left foot
    ctx.arc(torsoW*0.32, 0, 2.8, 0, 2*Math.PI);  // right foot
    ctx.arc(0, -legL-torsoH-headH, 2.4, 0, 2*Math.PI); // top head
    ctx.arc(0, -legL-torsoH/2, 2.3, 0, 2*Math.PI); // body center
    ctx.fill();
    ctx.restore();

    // -- Rare emoji for personality
    if (tick && tick % 121 === 0) {
      ctx.save();
      ctx.font = `${Math.round(headH * 1.15)}px Segoe UI Emoji, Apple Color Emoji`;
      ctx.globalAlpha = 0.18;
      ctx.fillText("🧟", 0, -legL-torsoH-headH/2+2);
      ctx.restore();
    }

    ctx.restore();
  }
  ctx.restore();
}

// PUBLIC_INTERFACE
// Health HUD: neon bar with label (bottom left, screen responsive)
function drawHealthMeter(ctx, p, width, height) {
  const HP = p.health !== undefined ? p.health : PLAYER_MAX_HEALTH;
  if (!HP || HP < 0) return;
  const maxW = Math.max(Math.floor(width * 0.33), 170);
  const barW = Math.round((HP / PLAYER_MAX_HEALTH) * maxW);
  const barH = 20;
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#191925";
  ctx.fillRect(18, height - 39, maxW + 13, barH + 12);
  ctx.fillStyle = "#39ff14";
  ctx.fillRect(24, height - 31, barW, barH);
  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2.1;
  ctx.strokeRect(24, height - 31, maxW, barH);
  ctx.font = "bold 15px Segoe UI, Arial";
  ctx.fillStyle = "#a5ffa5";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`Health: ${HP}`, 30, height - 21.2);
  ctx.restore();
}
