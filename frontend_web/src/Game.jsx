import React, { useState, useEffect, useRef } from "react";
import { saveHighscore } from "./supabaseClient";
import Leaderboard from "./components/Leaderboard.jsx";

/*
SPRITE & ASSET INTEGRATION INSTRUCTIONS

== Where to put asset files ==
- Place all custom sprite/image files in: ./public/assets/
- Asset file names must follow these safe conventions:
  "player.png"      // main alien character (facing right, transparent BG)
  "player_left.png" // main alien character (facing left), optional
  "zombie.png"      // enemy: zombie (facing right—if side-on), or centered
  "bird.png"        // enemy: bird, transparent BG
  "bot.png"         // enemy: bot/robot, transparent BG
  "bullet.png"      // neon bullet, transparent BG (optional)
- PNG or SVG files are recommended (.png preferred for wide compatibility).
- Filenames are *case-sensitive* (match above exactly).
- For new/unique entities, use their "key" (e.g. "zombie.png", "bird.svg").

== Notes ==
- Assets are loaded from "/assets/<filename>" at runtime (i.e., yourapp.com/assets/zombie.png).
- If an image or SVG is missing or fails to load, game will fall back to drawing a neon shape.
- Optimal sprite size: width ≈ entity .w, height ≈ entity .h, with some transparent border for glow.

== Responsive Design ==
- Game layout and entity rendering are fully responsive.
- Asset presence or loading failures will NOT break the visuals, only revert to neon shapes if missing.

*/

// ────── Image Asset Preload Logic ──────
const ASSET_LIST = [
  { key: 'player', files: ['player.png', 'player.svg'] },
  { key: 'player_left', files: ['player_left.png', 'player_left.svg'] },
  { key: 'zombie', files: ['zombie.png', 'zombie.svg'] },
  { key: 'bird', files: ['bird.png', 'bird.svg'] },
  { key: 'bot', files: ['bot.png', 'bot.svg'] },
  { key: 'bullet', files: ['bullet.png', 'bullet.svg'] }
];

const assetImages = {}; // {key: HTMLImageElement | null}

// This function preloads all listed images.
// Run only once at module level.
(function preloadSprites() {
  ASSET_LIST.forEach(asset => {
    let loaded = false;
    for (const filename of asset.files) {
      // Try PNG, then SVG for each key
      const img = new window.Image();
      img.src = `${process.env.PUBLIC_URL || ""}/assets/${filename}`;
      // don't block just because first fails; listen for load/error
      img.onload = () => {
        if (!loaded) {
          assetImages[asset.key] = img;
          loaded = true;
        }
      };
      img.onerror = () => {
        // fallback to next file in list
        if (!loaded && asset.files.indexOf(filename) === asset.files.length - 1) {
          assetImages[asset.key] = null;
        }
      };
      // If loaded immediately from cache
      if (img.complete && img.naturalWidth > 0) {
        assetImages[asset.key] = img;
        loaded = true;
      }
    }
    if (!loaded) assetImages[asset.key] = null;
  });
})();
// ────────────── CONSTANTS AND THEME ──────────────
const THEME = {
  primary: "#39ff14",
  accent: "#aa2c69",
  dark: "#1a1a1a",
  canvasW: 0.95,
  canvasH: 0.90
};
const ENEMY_TYPES = {
  zombie: { key: "zombie", w: 44, h: 62, speed: 2, color: "#6efd9a", eye: "#fb73fa", score: 100, radius: 28 },
  bird: { key: "bird", w: 38, h: 36, speed: 3.2, color: "#2ecffd", eye: "#39ff14", score: 170, radius: 18 },
  bot: { key: "bot", w: 41, h: 46, speed: 2.8, color: "#aa2c69", eye: "#fff", score: 130, radius: 22 }
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
// Nearest color triplet for synthwave
const SCANLINE_COLOR = "rgba(58,255,20,0.18)";

// ────────────── MAIN GAME COMPONENT ──────────────
// PUBLIC_INTERFACE
export default function Game() {
  // ─ HOOKS (ALL AT TOP) ─
  const [dims, setDims] = useState(getDims());
  const [gameState, setGS] = useState("menu"); // menu | play | over
  const [score, setScore] = useState(0);
  const [showLB, setShowLB] = useState(false);
  const [namePrompt, setNP] = useState(false);
  const [playerName, setPN] = useState("");
  const [status, setStatus] = useState("");
  const [touchUI, setTouch] = useState(window.innerWidth < 900);

  const canvasRef = useRef(null);
  const playerRef = useRef({
    x: 200, y: 0, w: 32, h: 56, dir: 1, cd: 0,
    radius: 28
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
    const kDown = e => {
      if (gameState !== "play") return;
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = true;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = true;
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) keysRef.current.shoot = true;
    };
    const kUp = e => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = false;
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) keysRef.current.shoot = false;
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
    let animId, last = performance.now();
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
    setGS("play");
  }

  // ──────────── UPDATE GAME STATE ─────────────
  function updateLogic(dt) {
    const p = playerRef.current;
    // Player move
    if (keysRef.current.left) { p.x -= 8; p.dir = -1; }
    if (keysRef.current.right) { p.x += 8; p.dir = 1; }
    p.x = Math.max(32, Math.min(dims.width - 32, p.x));

    // Player shoot (cooldown)
    if (keysRef.current.shoot && p.cd <= 0) {
      bulletsRef.current = [
        ...bulletsRef.current,
        { x: p.x, y: dims.height - 120, vx: p.dir * 25, r: 7 }
      ];
      p.cd = 180;
    }
    p.cd -= dt;

    // Bullets move - clone so bullet death doesn't mutate in-loop
    bulletsRef.current = [...bulletsRef.current]
      .map(b => ({ ...b, x: b.x + b.vx }))
      .filter(b => b.x > -30 && b.x < dims.width + 30);

    // Enemy spawning - adaptive interval and random type
    spawnTimer.current += dt;
    const targetDelay = Math.max(450, 1300 - score * 35);
    if (spawnTimer.current > targetDelay) {
      spawnTimer.current = 0;
      spawnEnemy();
    }

    // Enemy movement and clearing dead
    enemiesRef.current = [...enemiesRef.current]
      .map(e => ({ ...e, x: e.x + e.vx }))
      .filter(e => e.x > -e.w - 70 && e.x < dims.width + e.w + 70 && !e.dead);

    // ─── Collision: Bullet vs Enemy (circle-rect or circle-circle/radius math) ───
    let hit = false;
    bulletsRef.current = [...bulletsRef.current];
    enemiesRef.current = [...enemiesRef.current];
    for (let bi = 0; bi < bulletsRef.current.length; ++bi) {
      const b = bulletsRef.current[bi];
      for (let ei = 0; ei < enemiesRef.current.length; ++ei) {
        const e = enemiesRef.current[ei];
        if (e.dead) continue;
        // Distance (center-to-center)
        const dx = b.x - e.x, dy = b.y - e.y;
        // For birds/zombies/bots: use radius or bounding box approx
        let collide = false;
        if (e.key === "bird") {
          // Both circles
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < (b.r + e.radius)) collide = true;
        } else {
          // Circle-bullet vs rectangle enemy: closest point
          const rx = e.x - e.w / 2, ry = e.y - e.h / 2;
          let closestX = Math.max(rx, Math.min(b.x, rx + e.w));
          let closestY = Math.max(ry, Math.min(b.y, ry + e.h));
          let dist = Math.hypot(closestX - b.x, closestY - b.y);
          if (dist < (b.r + 7)) collide = true;
        }
        if (collide) {
          enemiesRef.current[ei].dead = true;
          bulletsRef.current[bi]._kill = true;
          setScore(s => s + e.score);
          hit = true; // For potential effects
        }
      }
    }
    bulletsRef.current = bulletsRef.current.filter(b => !b._kill);

    // ─── Player collision with enemies (circle-rectangle logic) ───
    const playerY = dims.height - 120;
    const playerHitY = playerY - 35;
    let playerHitRect = {
      x: p.x - 16,
      y: playerHitY,
      w: 32,
      h: 50
    };
    for (let i = 0; i < enemiesRef.current.length; ++i) {
      const e = enemiesRef.current[i];
      if (e.dead) continue;
      // for now, enemy is box/rect, player as smaller box
      let ex = e.x - e.w / 2, ey = e.y - e.h / 2;
      let overlap =
        ex < playerHitRect.x + playerHitRect.w &&
        ex + e.w > playerHitRect.x &&
        ey < playerHitRect.y + playerHitRect.h &&
        ey + e.h > playerHitRect.y;
      if (overlap) {
        setGS("over");
        setTimeout(() => setNP(true), 600);
      }
    }
  }

  // ──────────── VISUAL DRAW ─────────────
  function draw(ctx) {
    if (!ctx) return;
    const { width, height } = dims;
    ctx.clearRect(0, 0, width, height);
    drawBG(ctx, width, height);
    // Draw all enemies
    for (const e of enemiesRef.current) {
      if (e.dead) continue;
      drawEnemy(ctx, e);
    }
    // Draw all bullets
    for (const b of bulletsRef.current) {
      drawBullet(ctx, b);
    }
    // Draw player
    drawPlayer(ctx, playerRef.current, dims);
  }

  // ──────────── ENEMY SPAWN ─────────────
  function spawnEnemy() {
    const key = ENEMY_KEYS[Math.floor(Math.random() * ENEMY_KEYS.length)];
    const base = ENEMY_TYPES[key];
    const sideL = Math.random() < 0.5;
    enemiesRef.current = [
      ...enemiesRef.current,
      {
        ...base,
        x: sideL ? -base.w : dims.width + base.w,
        y: key === "bird"
          ? rand(dims.height * 0.22, dims.height * 0.53)
          : dims.height - base.h - 88,
        vx: sideL ? base.speed : -base.speed,
        dead: false
      }
    ];
  }

  // ──────────── HIGH SCORE SAVE ─────────────
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

  // ──────────── RESET GAME ─────────────
  function reset() {
    enemiesRef.current = [];
    bulletsRef.current = [];
    playerRef.current = {
      x: Math.floor(dims.width * 0.14),
      y: dims.height - 120,
      w: 32, h: 56, dir: 1, cd: 0, radius: 28
    };
    setScore(0);
    setNP(false);
    setStatus("");
    spawnTimer.current = 0;
    spawnEnemy();
  }

  // ──────────── CANVAS & HUD RENDER ─────────────
  return (
    <div className="neon-app-root">
      {/* HUD */}
      <div className="hud-container">
        <div className="hud-label">
          <span className="zombie-icon" /> Score: <b style={{ marginLeft: 7 }}>{score}</b>
        </div>
        <div className="hud-center">
          <span className="hud-title" style={{ textShadow: "0 0 9px #39ff14,0 0 14px #39ff14" }}>
            NEON WASTELAND ZOMBIE SHOOTER
          </span>
        </div>
        {gameState === "play" && (
          <button className="neon-btn" onClick={() => setGS("menu")}>Quit</button>
        )}
      </div>
      {/* Canvas Box */}
      <div
        className="game-canvas-container"
        style={{
          marginTop: 60,
          width: dims.width,
          height: dims.height,
          boxShadow: "0 0 44px 8px #aa2c6926"
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
            background: "#191925"
          }}
        />
        {gameState === "menu" && (
          <div className="game-overlay">
            <h1 className="neon-title">NEON WASTELAND ZOMBIE SHOOTER</h1>
            <div className="subtitle" style={{ marginBottom: 25, textShadow: "0 0 14px #aa2c69" }}>
              Press <kbd>Space</kbd> / <kbd>W</kbd> to shoot, <kbd>Left/Right</kbd> to move
            </div>
            <button
              className="neon-btn"
              onClick={startGame}
              autoFocus
              style={{ fontWeight: 700, fontSize: "1.22em", margin: 10 }}
            >Start Game</button>
            <button className="neon-btn neon-btn-accent" style={{ marginTop: 18 }} onClick={() => setShowLB(true)}>
              Leaderboard
            </button>
          </div>
        )}
        {gameState === "over" && !namePrompt && (
          <div className="game-overlay">
            <h1 className="game-over-title">GAME&nbsp;OVER</h1>
            <div className="big-score">Your Score: {score}</div>
          </div>
        )}
        {namePrompt && (
          <div className="game-overlay">
            <div style={{ marginBottom: 10, fontWeight: 700, fontSize: "1.16em" }}>Your Score: {score}</div>
            <input
              value={playerName}
              onChange={e => setPN(e.target.value.slice(0, 15))}
              placeholder="name"
              className="neon-input"
              style={{ padding: "8px 14px", fontSize: "1.12em", borderRadius: 8, marginBottom: 5, border: "none" }}
            />
            <button className="neon-btn" style={{ marginTop: 10 }} onClick={handleSave}>Save</button>
            <div style={{ marginTop: 8 }}>{status}</div>
          </div>
        )}
        <Leaderboard visible={showLB} onClose={() => setShowLB(false)} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// DRAW HELPERS (NEON SHAPES & BACKGROUND)
/* -- Canvas Drawing Utilities: Responsive Images + Neon Fallbacks -- */

// Neon synthwave background and scanlines
function drawBG(ctx, w, h) {
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
}

/**
 * Draws the player using a sprite image if available, or SVG/neon vector as fallback.
 * To swap in your own asset: Place your file in /public/assets/ as "player.png" (for right-facing) and/or "player_left.png" (for left).
 * The sprite is centered at (p.x, p.y), scaled for canvas responsiveness.
 */
function drawPlayer(ctx, p, dims) {
  // Pick correct facing
  const facing = p.dir === -1 && assetImages['player_left'] ? 'player_left' : 'player';
  const img = assetImages[facing];
  // Gun barrel: anchored at player's hand
  const handX = p.x + (p.dir === 1 ? 13 : -13);
  const handY = dims.height - 120 - 30;
  ctx.save();
  ctx.translate(p.x, dims.height - 120);

  // If shooting, draw a laser glow/bullet from gun
  if (p.cd > 140 && p.cd < 170) {
    // Add a brief visible laser glow when firing!
    ctx.save();
    ctx.globalAlpha = 0.68;
    ctx.shadowColor = "#39ffef";
    ctx.shadowBlur = 24;
    ctx.strokeStyle = "#2ecffd";
    ctx.lineWidth = 7 + Math.sin(Date.now() / 80) * 1.2;
    ctx.beginPath();
    ctx.moveTo(p.dir === 1 ? 13 : -13, -30);
    ctx.lineTo(p.dir === 1 ? 41 : -41, -28);
    ctx.stroke();
    // Glow core
    ctx.globalAlpha = 0.53;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#a7f4ff";
    ctx.lineWidth = 3.3;
    ctx.beginPath();
    ctx.moveTo(p.dir === 1 ? 13 : -13, -30);
    ctx.lineTo(p.dir === 1 ? 45 : -45, -28);
    ctx.stroke();
    ctx.restore();
  }

  if (img && img.complete && img.naturalWidth > 0) {
    // Draw sprite image (user asset)
    const w = 34, h = 56; // preferred visual size for scaling
    ctx.drawImage(
      img,
      -w / 2,
      -h + 15, // y offset so feet sit on ground
      w,
      h
    );
  } else {
    // Fallback: Neon SVG-style alien with simple "gun"
    ctx.shadowColor = "#9633f9";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#9633f9";
    ctx.fillRect(-17, -43, 34, 46); // torso
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 19;
    ctx.beginPath();
    ctx.arc(0, -60, 18, 0, Math.PI * 2); // head
    ctx.fillStyle = "#39ff14";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, -64, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#aa2c69";
    ctx.fill();
    // Draw arms holding gun, facing respective directions
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5.3;
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(p.dir === 1 ? 16 : -16, -27);
    ctx.stroke();
    ctx.restore();
    // Draw a gun barrel
    ctx.save();
    ctx.fillStyle = "#2ecffd";
    ctx.shadowColor = "#2ecffd";
    ctx.shadowBlur = 10;
    ctx.fillRect(p.dir === 1 ? 14 : -26, -32, 12, 5);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Draws player-fired bullet as either image or a neon blue plasma, with strong glow.
 * To swap with user asset: place "bullet.png" (transparent). Size will match in-game radius.
 */
function drawBullet(ctx, b) {
  const img = assetImages['bullet'];
  ctx.save();
  if (img && img.complete && img.naturalWidth > 0) {
    // Draw bullet sprite (centered, scaled to bullet radius)
    const w = (b.r || 7) * 2, h = (b.r || 7) * 2;
    ctx.drawImage(img, b.x - w / 2, b.y - h / 2, w, h);
  } else {
    // Neon bullet (radial blue plasma)
    ctx.globalAlpha = 1;
    ctx.shadowColor = "#39ffef";
    ctx.shadowBlur = 18;
    // Glowing core
    ctx.fillStyle = "#2ecffd";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r || 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.46;
    ctx.beginPath();
    ctx.arc(b.x, b.y, (b.r || 7) * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draws enemies using sprite if found OR SVG/neon fallback.
 * To provide custom assets: name zombie/bird/bot sprites by key and place in /public/assets/ (see asset preloader above).
 */
function drawEnemy(ctx, e) {
  const img = assetImages[e.key];
  ctx.save();
  ctx.globalAlpha = 0.98;

  if (img && img.complete && img.naturalWidth > 0) {
    // Use user-provided sprite: scale using game entity w/h
    let w = e.w || (e.radius ? e.radius * 2 : 38);
    let h = e.h || w;
    let cx = e.x - w / 2, cy = e.y - h / 2;
    if (e.key === "bird") {
      cx = e.x - w / 2;
      cy = e.y - h / 2;
    }
    ctx.drawImage(img, cx, cy, w, h);
  } else {
    // SVG style fallback with gradients, glows
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 14;

    if (e.key === "bird") {
      // Bird: neon glowing circle with barely-visible flappy wings
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = e.color;
      ctx.fill();

      // Eyes
      ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(e.x + 5, e.y - 2, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      // Flapping wings: neon transparent ellipse, slightly animated
      let wingG = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, e.radius);
      wingG.addColorStop(0, "#fff");
      wingG.addColorStop(1, "#2ecffd44");
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.12 * Math.abs(Math.sin(Date.now() / 110));
      ctx.fillStyle = wingG;
      ctx.beginPath();
      ctx.ellipse(
        e.x, e.y,
        e.radius * (1.3 + 0.26 * Math.abs(Math.sin(Date.now() / 140))),
        e.radius * 0.7, 
        Math.PI * 0.14 * Math.sin(Date.now() / 200), 0, 2 * Math.PI
      );
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 0.98;
    } else if (e.key === "bot") {
      // Bot: neon rectangle body, glowing neon eye/camera
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
      ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
      // Dual neon "eyes"
      ctx.beginPath();
      ctx.arc(e.x + e.w / 5, e.y - e.h / 4, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#fb73fa";
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.x - e.w / 5, e.y - e.h / 4, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#39ff14";
      ctx.shadowBlur = 7;
      ctx.fill();

      // Edge: neon stroke
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
      ctx.globalAlpha = 0.98;
    } else {
      // Zombie: glowy green body, big glowing head, synthwave accent
      ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2 + 13, e.w, e.h - 14);

      ctx.beginPath();
      ctx.arc(e.x, e.y - e.h / 2 + 22, 17, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(e.x - 6, e.y - e.h / 2 + 24, 3.7, 0, Math.PI * 2);
      ctx.fillStyle = "#fb73fa";
      ctx.shadowColor = "#fff";
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.x + 6, e.y - e.h / 2 + 25, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#39ff14";
      ctx.shadowBlur = 5;
      ctx.fill();

      // Shine overlay glow
      ctx.globalAlpha = 0.21;
      ctx.beginPath();
      ctx.arc(e.x - 4, e.y - e.h / 2 + 18, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.globalAlpha = 0.98;
    }
  }
  ctx.restore();
}
