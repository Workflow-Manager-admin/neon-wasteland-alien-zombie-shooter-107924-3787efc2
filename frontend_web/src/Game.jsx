import React, { useState, useEffect, useRef } from "react";
import { saveHighscore } from "./supabaseClient";
import Leaderboard from "./components/Leaderboard.jsx";

/*
 SPRITE & ASSET INTEGRATION INSTRUCTIONS
 
 == Where do you put asset files? ==
 - Place all custom sprite/image files in: ./public/assets/
 - Asset file names must follow conventions: e.g. "zombie.png", "bot.png", "player.png", etc.
 - Filenames are case-sensitive. For each entity, the asset must be in assets/<entitykey>.png or .svg
 
 == How do I add a new asset for an entity? ==
 1. Put the file in /public/assets/ or /assets/ (if in dev mode).
 2. Add the key and file to ASSET_LIST below (e.g.: { key: 'skeleton', files: ['skeleton.png', 'skeleton.svg'] })
 3. Use the entity key for rendering (in ENEMY_TYPES), e.g. 'skeleton'
 4. The game will auto-load and use the asset if present; otherwise it falls back to SVG neon shape.
 5. To swap player/bot/zombie image, just update or overwrite the asset file.

 == Responsive Sprite Sizing ==
 - The renderers scale all sprites and fallback SVGs for responsive layout at any screen size.
 - Recommended sprite sizes: match entity .w/.h (as in ENEMY_TYPES).

*/

const ASSET_LIST = [
  { key: "player", files: ["player.png", "player.svg"] },
  { key: "player_left", files: ["player_left.png", "player_left.svg"] },
  { key: "zombie", files: ["zombie.png", "zombie.svg"] },
  { key: "bird", files: ["bird.png", "bird.svg"] },
  { key: "bot", files: ["bot.png", "bot.svg"] },
];

const assetImages = {}; // {key: HTMLImageElement | null}
(function preloadSprites() {
  ASSET_LIST.forEach((asset) => {
    let loaded = false;
    for (const filename of asset.files) {
      const img = new window.Image();
      img.src = `${process.env.PUBLIC_URL || ""}/assets/${filename}`;
      img.onload = () => {
        if (!loaded) {
          assetImages[asset.key] = img;
          loaded = true;
        }
      };
      img.onerror = () => {
        if (
          !loaded &&
          asset.files.indexOf(filename) === asset.files.length - 1
        ) {
          assetImages[asset.key] = null;
        }
      };
      if (img.complete && img.naturalWidth > 0) {
        assetImages[asset.key] = img;
        loaded = true;
      }
    }
    if (!loaded) assetImages[asset.key] = null;
  });
})();

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
    speed: 1.36, // SLOWER for balance!
    color: "#6efd9a",
    eye: "#fb73fa",
    score: 100,
    radius: 28,
    damage: 24,
  },
  bird: {
    key: "bird",
    w: 38,
    h: 36,
    speed: 2.3, // slower
    color: "#2ecffd",
    eye: "#39ff14",
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

// ------------ BULLET EMOJIS / GUN EMOJIS ------------
const BULLET_EMOJIS = ["🚀", "🔫", "💥"];
function chooseBulletEmoji() {
  // Add variation and fun
  return BULLET_EMOJIS[Math.floor(rand(0, BULLET_EMOJIS.length))];
}

const PLAYER_MAX_HEALTH = 120; // was 1 hit KO before, now 120 HP
const PLAYER_INVULN_FRAMES = 850; // ms of invulnerability after hit

// ------------ React Main Game Component ------------
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
    w: 32,
    h: 56,
    dir: 1,
    cd: 0,
    radius: 28,
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
        p.x + (p.dir === 1 ? 18 : -18); // Offset: barrel tip
      let bulletY = dims.height - 120 - 28; // Gun barrel height
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
    // New spawn algorithm: slower, then ramps up
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
      drawEnemy(ctx, e, dims);
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
      w: 32,
      h: 56,
      dir: 1,
      cd: 0,
      radius: 28,
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
          <span className="zombie-icon" /> Score:{" "}
          <b style={{ marginLeft: 7 }}>{score}</b>
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
 * Render the player using asset from /assets if available, or fallback to SVG neon shape (alien).
 * To add a new player sprite, place a "player.png" (facing right) or "player_left.png" (left) in /assets.
 */
function drawPlayer(ctx, p, dims) {
  const facing =
    p.dir === -1 && assetImages["player_left"] ? "player_left" : "player";
  const img = assetImages[facing];
  ctx.save();
  ctx.translate(p.x, dims.height - 120);

  // Gun barrel coordinates for bullets
  const barrelX = p.dir === 1 ? 18 : -18, barrelY = -28;

  // Flashy muzzle effect when shooting
  if (p.cd > 130 && p.cd < 170) {
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.shadowColor = "#2ecffd";
    ctx.shadowBlur = 30;
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 7.3;
    ctx.beginPath();
    ctx.moveTo(barrelX, barrelY);
    ctx.lineTo(p.dir === 1 ? 56 : -56, barrelY + 7);
    ctx.stroke();
    ctx.globalAlpha = 0.23;
    ctx.beginPath();
    ctx.arc(barrelX, barrelY, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Sprited
  if (img && img.complete && img.naturalWidth > 0) {
    const w = 34,
      h = 56;
    ctx.drawImage(img, -w / 2, -h + 15, w, h);
  } else {
    // Neon fallback alien shape (SVG-like vector glow)
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
    // Draw arms
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

  // Draw brief invulnerability flash
  if (p.invulnUntil && Date.now() < p.invulnUntil) {
    ctx.save();
    ctx.globalAlpha = 0.49 + 0.13 * Math.sin(Date.now() / 110);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, -20, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Render a bullet as an emoji "fired" from the gun, or fallback to blue-plasma neon.
 * Add more fun emojis to BULLET_EMOJIS list to customize.
 */
function drawBullet(ctx, b, dims) {
  ctx.save();
  ctx.font = "bold 30px Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const emoji = b.emoji || "🚀";
  ctx.shadowColor = "#2ecffd";
  ctx.shadowBlur = 16;
  ctx.globalAlpha = 1;
  ctx.fillText(emoji, b.x, b.y + 1);
  ctx.restore();
}

/**
 * Draw an enemy - use asset from /assets if present, otherwise draw neon SVG.
 * For new enemy: add to ENEMY_TYPES, supply a sprite, and game handles rest.
 * @param ctx HTMLCanvasContext
 * @param e entity object
 * @param dims screen size
 */
function drawEnemy(ctx, e, dims) {
  const img = assetImages[e.key];
  ctx.save();
  ctx.globalAlpha = 0.98;

  // Try to use asset image if loaded (e.g. zombie.png)
  if (img && img.complete && img.naturalWidth > 0) {
    let w = e.w || (e.radius ? e.radius * 2 : 38),
      h = e.h || w;
    let cx = e.x - w / 2,
      cy = e.y - h / 2;
    ctx.drawImage(img, cx, cy, w, h);
  } else {
    // SVG neon fallback for each enemy type
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 14;

    if (e.key === "bird") {
      // Bird: neon glowing circle + wings
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = e.color;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(e.x + 5, e.y - 2, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      // Flapping wings
      let wingG = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, e.radius);
      wingG.addColorStop(0, "#fff");
      wingG.addColorStop(1, "#2ecffd44");
      ctx.save();
      ctx.globalAlpha = 0.16 + 0.12 * Math.abs(Math.sin(Date.now() / 110));
      ctx.fillStyle = wingG;
      ctx.beginPath();
      ctx.ellipse(
        e.x,
        e.y,
        e.radius * (1.3 + 0.26 * Math.abs(Math.sin(Date.now() / 140))),
        e.radius * 0.7,
        Math.PI * 0.14 * Math.sin(Date.now() / 200),
        0,
        2 * Math.PI
      );
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 0.98;
    } else if (e.key === "bot") {
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);

      // Eyes
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
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
      // Zombie: neon green glowing body + head
      ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2 + 13, e.w, e.h - 14);
      ctx.beginPath();
      ctx.arc(e.x, e.y - e.h / 2 + 22, 17, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
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

      // Forehead glow
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

/**
 * Health HUD: draws player health as neon bar (bottom left, screen responsive)
 */
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
