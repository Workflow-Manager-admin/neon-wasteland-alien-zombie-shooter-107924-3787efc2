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

const BULLET_EMOJIS = ["🟢", "💥", "➡️", "•", "⚡"];
function chooseBulletEmoji() {
  return BULLET_EMOJIS[Math.floor(rand(0, BULLET_EMOJIS.length))];
}

const PLAYER_MAX_HEALTH = 120;
const PLAYER_INVULN_FRAMES = 850;

// --- ASSET info ---
const ASSET_BASE = "/assets/";
const SPRITES = {
  player: "player.png", // facing right
  player_left: "player_left.png",
  zombie: "zombie.png",
  bird: "bird.png",
  bot: "bot.png",
  bullet: "bullet.png",
};

/**
 * Utility: Loads all required sprite images and sets up fallback error handling.
 * Exposes: images[name], loadedStatus[name] (true if loaded or errored)
 */
function useGameSprites() {
  const [assetsLoaded, setAssetsLoaded] = useState({});
  const imagesRef = useRef({});

  // Only loads once
  useEffect(() => {
    let hasUnmounted = false;
    const assets = {};
    const loaded = {};
    Object.entries(SPRITES).forEach(([key, file]) => {
      const img = new window.Image();
      img.src = ASSET_BASE + file;
      img.onload = () => {
        loaded[key] = true;
        imagesRef.current[key] = img;
        if (!hasUnmounted) setAssetsLoaded({ ...loaded });
      };
      img.onerror = () => {
        loaded[key] = false;
        imagesRef.current[key] = null;
        if (!hasUnmounted) setAssetsLoaded({ ...loaded });
      };
      // Pre-mount, not in async event
      imagesRef.current[key] = img;
    });
    // update initial state (usually empty)
    setAssetsLoaded({ ...loaded });
    return () => {
      hasUnmounted = true;
    };
  }, []); // Load only once

  return {
    images: imagesRef.current,
    loaded: assetsLoaded, // if key in loaded, either loaded or failed, if undefined, not yet
  };
}

// PUBLIC_INTERFACE
export default function Game() {
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
  // Player, enemies, bullets, keys, timers
  const playerRef = useRef({
    x: 200,
    y: dims.height - 120, // <-- Start near the bottom
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

  // PNG asset management
  const { images: spriteImgs, loaded: loadedSprites } = useGameSprites();

  useEffect(() => {
    const onR = () => setDims(getDims());
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("[DIAG] Canvas ref is NULL at initial mount!");
      return;
    }
    let ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("[DIAG] Canvas could not get 2d context. Canvas:", canvas);
      return;
    }
    ctx.clearRect(0, 0, dims.width, dims.height);
    // Diagnostic demo: draw player/zombie reference figures and ground
    const refGroundY = dims.height - Math.max(48, dims.height * 0.06);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, refGroundY);
    ctx.lineTo(dims.width, refGroundY);
    ctx.strokeStyle = "#ff00ff";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#39ff14";
    ctx.stroke();
    ctx.restore();
    const px = Math.round(dims.width * 0.25), zy = Math.round(dims.width * 0.75);
    const charY = refGroundY - 56;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, charY, 32, 0, 2 * Math.PI);
    ctx.fillStyle = "#39ff14";
    ctx.shadowColor = "#ffff00";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#23243a";
    ctx.stroke();

    if (spriteImgs.player && loadedSprites.player) {
      ctx.drawImage(spriteImgs.player, px-34, charY-34, 68, 68);
    } else {
      ctx.font = "bold 44px Segoe UI Emoji";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = "#000";
      ctx.fillText("👽", px, charY - 8);
    }
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#39ff14";
    ctx.textBaseline = "top";
    ctx.fillText("Player", px, charY + 33);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(zy, charY, 32, 0, 2 * Math.PI);
    ctx.fillStyle = "#fb73fa";
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#181925";
    ctx.stroke();

    if (spriteImgs.zombie && loadedSprites.zombie) {
      ctx.drawImage(spriteImgs.zombie, zy-34, charY-34, 68, 68);
    } else {
      ctx.font = "bold 45px Segoe UI Emoji";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = "#000";
      ctx.fillText("🧟", zy, charY - 8);
    }
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#fb73fa";
    ctx.textBaseline = "top";
    ctx.fillText("Zombie", zy, charY + 33);
    ctx.restore();

    ctx.save();
    ctx.font = "bold 26px Arial";
    ctx.fillStyle = "#fff757";
    ctx.globalAlpha = 1.0;
    ctx.textAlign = "center";
    ctx.fillText("Canvas Primitives Test – Both entities MUST be fully visible above line", dims.width / 2, Math.max(50, charY - 70));
    ctx.restore();
    if (gameState !== "play") return;
    let animId, last = performance.now();
    const loop = (ts) => {
      const dt = ts - last;
      last = ts;
      tickRef.current++;
      updateLogic(dt);
      draw(ctx, spriteImgs, loadedSprites);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [gameState, dims, loadedSprites]); // Re-run if sprite loads change

  function startGame() {
    reset();
    setPlayerHealth(PLAYER_MAX_HEALTH);
    setGS("play");
  }

  function updateLogic(dt) {
    const p = playerRef.current;
    if (keysRef.current.left) {
      p.x -= 8;
      p.dir = -1;
    }
    if (keysRef.current.right) {
      p.x += 8;
      p.dir = 1;
    }
    p.x = Math.max(32, Math.min(dims.width - 32, p.x));
    if (keysRef.current.shoot && p.cd <= 0) {
      let bulletEmoji = chooseBulletEmoji();
      let bulletX = p.x + (p.dir === 1 ? 22 : -22);
      let bulletY = dims.height - 120 - 20;
      bulletsRef.current = [
        ...bulletsRef.current,
        { x: bulletX, y: bulletY, vx: p.dir * 22, r: 13, emoji: bulletEmoji },
      ];
      p.cd = 170;
    }
    p.cd -= dt;
    bulletsRef.current = [...bulletsRef.current]
      .map((b) => ({ ...b, x: b.x + b.vx }))
      .filter((b) => b.x > -60 && b.x < dims.width + 60);
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
    enemiesRef.current = [...enemiesRef.current]
      .map((e) => ({ ...e, x: e.x + e.vx }))
      .filter(
        (e) => e.x > -e.w - 80 && e.x < dims.width + e.w + 80 && !e.dead
      );
    let hit = false;
    bulletsRef.current = [...bulletsRef.current];
    enemiesRef.current = [...enemiesRef.current];
    for (let bi = 0; bi < bulletsRef.current.length; ++bi) {
      const b = bulletsRef.current[bi];
      for (let ei = 0; ei < enemiesRef.current.length; ++ei) {
        const e = enemiesRef.current[ei];
        if (e.dead) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        let collide = false;
        if (e.key === "bird") {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < (b.r + e.radius) * 0.92) collide = true;
        } else {
          const rx = e.x - e.w / 2, ry = e.y - e.h / 2;
          let closestX = Math.max(rx, Math.min(b.x, rx + e.w));
          let closestY = Math.max(ry, Math.min(b.y, ry + e.h));
          let dist = Math.hypot(closestX - b.x, closestY - b.y);
          if (dist < (b.r + 7)) collide = true;
        }
        if (collide) {
          enemiesRef.current[ei].dead = true;
          bulletsRef.current[bi]._kill = true;
          setScore((s) => s + e.score);
          hit = true;
        }
      }
    }
    bulletsRef.current = bulletsRef.current.filter((b) => !b._kill);
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
      let ex = e.x - e.w / 2, ey = e.y - e.h / 2;
      let overlap =
        ex < playerHitRect.x + playerHitRect.w &&
        ex + e.w > playerHitRect.x &&
        ey < playerHitRect.y + playerHitRect.h &&
        ey + e.h > playerHitRect.y;
      if (overlap) {
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

  function draw(ctx, spriteImgs, loadedSprites) {
    if (!ctx) return;
    const { width, height } = dims;

    ctx.clearRect(0, 0, width, height);
    drawBG(ctx, width, height);

    // Draw entities, using asset PNGs with fallback to geometric (neon) shape
    for (const e of enemiesRef.current) {
      if (e.dead) continue;
      drawEnemy(ctx, e, dims, tickRef.current, spriteImgs, loadedSprites);
    }
    for (const b of bulletsRef.current) {
      drawBullet(ctx, b, dims, spriteImgs, loadedSprites);
    }
    drawPlayer(ctx, playerRef.current, dims, spriteImgs, loadedSprites);

    drawHealthMeter(ctx, playerRef.current, width, height);
  }

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
        flapt: Math.random() * Math.PI * 2,
      },
    ];
  }

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

/**
 * PUBLIC_INTERFACE
 * Neon-scanned background with reference ground line for debugging
 */
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
 * Draws the player using the player.png asset or a neon rectangle as fallback.
 */
function drawPlayer(ctx, p, dims, spriteImgs = {}, loadedSprites = {}) {
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha = 1.0;

  // Determine side: (simple) if p.dir < 0 and we have player_left sprite, flip
  let facingLeft = p.dir < 0;
  let img = null;

  if (spriteImgs.player && loadedSprites.player && !facingLeft) {
    img = spriteImgs.player;
  } else if (spriteImgs.player_left && loadedSprites.player_left && facingLeft) {
    img = spriteImgs.player_left;
  } else if (spriteImgs.player && loadedSprites.player) {
    img = spriteImgs.player;
  }

  let pw = 68, ph = 68;
  let px = Math.round(p.x - pw/2), py = Math.round(p.y - ph/2);
  if (img) {
    try {
      ctx.drawImage(img, px, py, pw, ph);
    } catch(e) {
      // If drawImage exception, fallback to neons
      neonPlayerFallback(ctx, p, dims);
    }
  } else {
    neonPlayerFallback(ctx, p, dims);
  }
  ctx.restore();
}

// Draws fallback neon shape for player
function neonPlayerFallback(ctx, p, dims) {
  let rectX = Math.round(p.x - 34), rectY = Math.round(p.y - 34);
  ctx.fillStyle = "#FF00FF";
  ctx.shadowColor = "#ffff00";
  ctx.shadowBlur = 19;
  ctx.fillRect(rectX, rectY, 68, 68);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#FFFF00";
  ctx.lineWidth = 4;
  ctx.strokeRect(rectX, rectY, 68, 68);
}

/**
 * PUBLIC_INTERFACE
 * Draws an enemy using its asset PNG or neon fallback shape.
 */
function drawEnemy(ctx, e, dims, tick, spriteImgs = {}, loadedSprites = {}) {
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha = 1.0;
  let img = null;
  let w = 64, h = 64;

  if (e.key === "zombie" && spriteImgs.zombie && loadedSprites.zombie) img = spriteImgs.zombie;
  else if (e.key === "bot" && spriteImgs.bot && loadedSprites.bot) img = spriteImgs.bot;
  else if (e.key === "bird" && spriteImgs.bird && loadedSprites.bird) img = spriteImgs.bird;

  let px = Math.round(e.x - w/2), py = Math.round(e.y - h/2);
  if (img) {
    try {
      ctx.drawImage(img, px, py, w, h);
    } catch (err) {
      neonEnemyFallback(ctx, e, dims);
    }
  } else {
    neonEnemyFallback(ctx, e, dims);
  }
  ctx.restore();
}

// Draws fallback neon shape for enemy, with emoji type color cue
function neonEnemyFallback(ctx, e, dims) {
  let rectX = Math.round(e.x - 32), rectY = Math.round(e.y - 32);
  let color = "#00F5FF", border = "#D80000";
  if (e.key === "zombie") {
    color = "#00F5FF";
    border = "#D80000";
  } else if (e.key === "bot") {
    color = "#aa2c69";
    border = "#fff";
  } else if (e.key === "bird") {
    color = "#2ecffd";
    border = "#39ff14";
  }
  ctx.shadowBlur = 15;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillRect(rectX, rectY, 64, 64);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = border;
  ctx.lineWidth = 4;
  ctx.strokeRect(rectX, rectY, 64, 64);
}

/**
 * PUBLIC_INTERFACE
 * Draws a bullet using bullet.png or as neon projectile (fallback).
 */
function drawBullet(ctx, b, dims, spriteImgs = {}, loadedSprites = {}) {
  ctx.save();
  let useImg = spriteImgs.bullet && loadedSprites.bullet;
  let w = 29, h = 18;
  let bx = b.x - w/2, by = b.y - h/2;

  if (useImg) {
    try {
      ctx.globalAlpha = 0.95;
      ctx.shadowColor = "#39ff14";
      ctx.shadowBlur = 7;
      ctx.drawImage(spriteImgs.bullet, bx, by, w, h);
      ctx.shadowBlur = 0;
    } catch (err) {
      neonBulletFallback(ctx, b);
    }
  } else {
    neonBulletFallback(ctx, b);
  }
  ctx.restore();
}

// Draws neon bullet fallback (glowing circle)
function neonBulletFallback(ctx, b) {
  ctx.globalAlpha = 1;
  ctx.shadowColor = "#6efd9a";
  ctx.shadowBlur = 19;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 11, 0, 2 * Math.PI);
  ctx.fillStyle = "#6efd9a";
  ctx.fill();
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 5, 0, 2 * Math.PI);
  ctx.fillStyle = "#39ff14";
  ctx.fill();
}

/**
 * PUBLIC_INTERFACE
 * Health HUD: neon bar with label (bottom left, screen responsive)
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
