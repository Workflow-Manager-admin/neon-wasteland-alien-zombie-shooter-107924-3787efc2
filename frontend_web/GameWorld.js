import React, { useRef, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";


/**
 * PUBLIC_INTERFACE
 * GameWorld handles all game logic, rendering, and input propagation for a single level.
 * Props:
 *   running: bool (if game is live/updating)
 *   level: int (current level)
 *   coins: int (current total coins)
 *   onHUD: fn({level, score, coins, kills, levelGoal}) - informs app state
 *   onGameOver: fn() - called when player dies
 *   onLevelComplete: fn(kills, goal, coinValue, coins) - triggers portal sacrifice
 *   killsThisLevel: int (external kill tracker)
 *   levelGoal: int (enemies to kill for this level)
 */
const THEME = {
  accent: "#aa2c69",
  primary: "#39ff14",
  canvas: { width: 800, height: 600 },
};

function clamp(n, a, b) { return Math.max(a, Math.min(n, b)); }

// PUBLIC_INTERFACE
export default function GameWorld({
  running,
  level,
  coins,
  onHUD,
  onGameOver,
  onLevelComplete,
  killsThisLevel,
  levelGoal,
}) {
  // Internal game state
  const [gameState, setGameState] = useState("running"); // running | freeze | done
  const [control, setControl] = useState({ left: false, right: false, shoot: false, jump: false });
  const [hudState, setHudState] = useState({
    level, score: 0, coins, kills: 0, levelGoal: levelGoal || (6 + level * 2)
  });

  // Canvas/World refs
  const canvasRef = useRef();
  const world = useRef();

  // Setup game world on mount or level change
  useEffect(() => {
    world.current = new NeonGameEngine({
      theme: THEME,
      level,
      coins,
      levelGoal,
      onScore: (score) => setHudState(s => ({ ...s, score })),
      onCoins: (coins) => setHudState(s => ({ ...s, coins })),
      onKill: (kills) => setHudState(s => ({ ...s, kills })),
      onHUD: (hud) => {
        setHudState(hud); onHUD && onHUD(hud);
      },
      onGameOver: () => { setGameState("done"); onGameOver && onGameOver(); },
      onLevelComplete: () => {
        setGameState("freeze");
        setTimeout(() => {
          onLevelComplete(
            world.current.kills,
            world.current.levelGoal,
            world.current.coinValue,
            world.current.coins
          );
        }, 480);
      }
    });
    setGameState("running");
    // Reset HUD state
    setHudState({
      level, score: 0, coins, kills: 0, levelGoal
    });
  }, [level, levelGoal]); // new instance per level change

  // Game loop (only runs if running)
  useAnimationFrame(() => {
    if (!canvasRef.current || !world.current) return;
    if (gameState === "running" && running) {
      world.current.update(control);
      world.current.draw(canvasRef.current);
      setHudState(world.current.getHUD());
      onHUD && onHUD(world.current.getHUD());
    }
    if (gameState === "freeze") {
      world.current.draw(canvasRef.current);
    }
  }, running && gameState === "running");

  // Keyboard/gamepad
  useEffect(() => {
    const keydown = (e) => {
      if (gameState !== "running" || !running) return;
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
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    };
  }, [gameState, running]);

  // Onscreen (mobile) neon controls
  function handleTouch(type, enable) {
    if (gameState !== "running") return;
    if (type === "left") setControl(s => ({ ...s, left: enable }));
    if (type === "right") setControl(s => ({ ...s, right: enable }));
    if (type === "shoot") setControl(s => ({ ...s, shoot: enable }));
    if (type === "jump") setControl(s => ({ ...s, jump: enable }));
  }
  function handleButtonClick(type) {
    if (gameState !== "running") return;
    if (type === "shoot") {
      setControl(s => ({ ...s, shoot: true }));
      setTimeout(() => setControl(s => ({ ...s, shoot: false })), 72);
    }
    if (type === "jump") {
      setControl(s => ({ ...s, jump: true }));
      setTimeout(() => setControl(s => ({ ...s, jump: false })), 120);
    }
  }

  // HUD render
  function HUD() {
    return (
      <div className="hud-container">
        <div className="hud-left">
          <div className="hud-label">
            <span className="zombie-icon" /> x {hudState.kills} / {hudState.levelGoal}
          </div>
        </div>
        <div className="hud-center">
          <div className="hud-title">LEVEL {hudState.level}</div>
        </div>
        <div className="hud-right" style={{ flexDirection: "column", alignItems: "flex-end" }}>
          <div className="hud-label coins">
            <span className="coin-icon" /> {hudState.coins}
          </div>
          <p style={{
            margin: "2px 0 0 0",
            color: THEME.primary,
            fontWeight: 600,
            fontSize: "0.95em",
            textShadow: "0 0 5px #39ff14c7",
            letterSpacing: ".01em"
          }}>
            Zombies Killed: {hudState.kills}
          </p>
        </div>
      </div>
    );
  }

  // Neon on-screen controls
  function NeonControls() {
    return (
      <div className="btn-panel btn-panel-mobile" role="toolbar" aria-label="On-screen Controls">
        <button
          className="neon-control-btn"
          tabIndex={-1}
          aria-label="Move Left"
          onTouchStart={() => handleTouch('left', true)}
          onTouchEnd={() => handleTouch('left', false)}
          onMouseDown={() => handleTouch('left', true)}
          onMouseUp={() => handleTouch('left', false)}
        >◀</button>
        <button
          className="neon-control-btn"
          tabIndex={-1}
          aria-label="Jump"
          onTouchStart={() => handleButtonClick('jump')}
          onClick={() => handleButtonClick('jump')}
        >▲</button>
        <button
          className="neon-control-btn"
          tabIndex={-1}
          aria-label="Move Right"
          onTouchStart={() => handleTouch('right', true)}
          onTouchEnd={() => handleTouch('right', false)}
          onMouseDown={() => handleTouch('right', true)}
          onMouseUp={() => handleTouch('right', false)}
        >▶</button>
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
    <>
      <HUD />
      <div className="game-canvas-container">
        <canvas
          id="game-canvas"
          width={THEME.canvas.width}
          height={THEME.canvas.height}
          ref={canvasRef}
          tabIndex={1}
          aria-label="Game Canvas"
        />
      </div>
      <NeonControls />
    </>
  );
}

/**
 * NeonGameEngine: Pure JavaScript game logic engine
 * Handles: player, zombie, bullet, coin, platform, AI/physics, level, accomplishment
 */
class NeonGameEngine {
  constructor({ theme, level, coins, levelGoal, onScore, onCoins, onKill, onHUD, onGameOver, onLevelComplete }) {
    this.theme = theme;
    this.level = level;
    this.coinValue = 2;
    this.levelGoal = levelGoal || (6 + level * 2);
    this.kills = 0;
    this.score = 0;
    this.coins = coins || 0;
    this.onScore = onScore;
    this.onCoins = onCoins;
    this.onKill = onKill;
    this.onHUD = onHUD;
    this.onGameOver = onGameOver;
    this.onLevelComplete = onLevelComplete;
    this.reset();
  }
  reset() {
    this.width = this.theme.canvas.width;
    this.height = this.theme.canvas.height;
    this.groundY = this.height - 120;
    this.player = {
      x: 100,
      y: this.groundY - 48,
      width: 32,
      height: 56,
      speed: 6,
      dir: 1,
      alive: true,
      isJumping: false,
      velocityY: 0,
      shootCooldown: 0,
    };
    this.scrollX = 0;
    this.zombies = [];
    this.bullets = [];
    this.effects = [];
    this.spawned = 0;
    this.kills = 0;
    this.score = 0;
    this.zombieTypes = [
      {
        name: "green", color: "#6efd9a", shadow: "#39ff1475", head: "#161e13", eyes: "#fb73fa",
        speed: 1.2, w: 44, h: 62, coins: this.coinValue, labelColor: "#39ff14", label: "+2"
      }
    ];
    // Pre-spawn all zombies, enforce one batch (spawning must *stop* after killed enough!)
    for (let i = 0; i < this.levelGoal; ++i) {
      this.zombies.push(this._spawnZombie(400 + i * 90 + Math.random() * 90));
      this.spawned += 1;
    }
    this.levelComplete = false;
    this.over = false;
    this._reportHUD();
  }
  // MAIN UPDATE LOOP
  update(control) {
    if (this.levelComplete || this.over) return;
    // Player move
    let dx = 0;
    if (control.left) dx -= this.player.speed;
    if (control.right) dx += this.player.speed;
    this.player.x += dx;
    this.player.dir = dx > 0 ? 1 : dx < 0 ? -1 : this.player.dir;
    this.player.x = clamp(this.player.x, 20, 4800);
    // Side-scrolling
    if (this.player.x - this.scrollX > this.width * 0.4) this.scrollX = this.player.x - this.width * 0.4;
    if (this.scrollX < 0) this.scrollX = 0;
    // Jump
    let onGround = (Math.abs(this.player.y - (this.groundY - 48)) < 1);
    if (control.jump && onGround && !this.player.isJumping) {
      this.player.velocityY = -22.5;
      this.player.isJumping = true;
    }
    if (!onGround || this.player.velocityY !== 0) {
      this.player.velocityY += 1.6;
      this.player.y += this.player.velocityY;
      if (this.player.y > this.groundY - 48) {
        this.player.y = this.groundY - 48;
        this.player.velocityY = 0;
        this.player.isJumping = false;
      }
    } else {
      this.player.velocityY = 0;
      this.player.isJumping = false;
      this.player.y = this.groundY - 48;
    }
    // Shooting
    if (control.shoot && this.player.shootCooldown <= 0) {
      this._shoot();
      this.player.shootCooldown = 15; // fire rate
      this.effects.push({ type: "muzzle", x: this.player.x + this.player.dir * 30, y: this.player.y + 32, t: 0 });
    }
    if (this.player.shootCooldown > 0) this.player.shootCooldown -= 1;

    // Bullets logic: hit zombies
    this.bullets.forEach((b, i, arr) => {
      b.x += b.vx;
      for (let z of this.zombies) {
        if (!z.dead && z.x < b.x && b.x < z.x + z.w && z.y < b.y && b.y < z.y + z.h) {
          z.dead = true; z._diedAt = Date.now();
          z._killedBy = "bullet";
          if (!z._counted) {
            this.kills += 1;
            this.coins += z.coins;
            this.score += 100;
            this.onKill && this.onKill(this.kills);
            this.onScore && this.onScore(this.score);
            this.onCoins && this.onCoins(this.coins);
          }
          z._counted = true;
          arr[i]._hit = true;
          // Floating "+2" label visual
          this.effects.push({ type: "label", x: z.x + z.w / 2, y: z.y - 13, t: 0, text: "+2", fill: "#39ff14", outline: "#1a1a1a" });
        }
      }
    });
    this.bullets = this.bullets.filter(b => b.x > this.scrollX - 60 && b.x < this.scrollX + this.width + 60 && !b._hit);

    // Remove dead zombies (fall away)
    for (let z of this.zombies) {
      if (z.dead && !z._falling) { z._falling = true; z._vy = 2 + Math.random() * 3; }
      if (z._falling) { z.y += z._vy; z._vy += 0.5; }
    }
    this.zombies = this.zombies.filter(z => !z._falling || z.y < this.groundY + 110);

    // AI zombie movement/collision (no new spawns after level is complete)
    for (let z of this.zombies) {
      if (!z.dead) {
        z.x -= z.speed;
        if (z.x < this.scrollX - 140) Object.assign(z, this._spawnZombie(this.scrollX + this.width + 120 + Math.random() * 90));
        if (!z.dead && this._collide(this.player, z)) {
          this.over = true;
          this.onGameOver && this.onGameOver();
        }
      }
    }

    // Effects update
    for (let e of this.effects) e.t += 1;
    this.effects = this.effects.filter(e =>
      (e.type === "muzzle" && e.t < 12) ||
      (e.type === "label" && e.t < 33)
    );

    // Level finish?
    if (!this.levelComplete && this.kills >= this.levelGoal) {
      this.levelComplete = true;
      setTimeout(() => {
        this.onLevelComplete && this.onLevelComplete();
      }, 450);
      return;
    }
    // HUD update
    this._reportHUD();
  }
  getHUD() {
    return {
      level: this.level,
      score: this.score,
      coins: this.coins,
      kills: this.kills,
      levelGoal: this.levelGoal,
    };
  }
  _reportHUD() {
    this.onHUD && this.onHUD(this.getHUD());
  }
  _shoot() {
    this.bullets.push({
      x: this.player.x + this.player.dir * 26,
      y: this.player.y + 22,
      vx: this.player.dir * 19,
      vy: 0,
    });
  }
  _spawnZombie(x) {
    const type = this.zombieTypes[0];
    return {
      x: x,
      y: this.groundY - type.h + 8,
      w: type.w,
      h: type.h,
      speed: type.speed + Math.random() * 0.42,
      dead: false,
      _falling: false,
      _counted: false,
      type: type.name,
      color: type.color,
      shadow: type.shadow,
      head: type.head,
      eyes: type.eyes,
      coins: type.coins,
      label: type.label,
      labelColor: type.labelColor,
    };
  }
  _collide(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.width > b.x &&
      a.y < b.y + b.h &&
      a.y + a.height > b.y
    );
  }
  draw(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Background
    this._drawBG(ctx);
    ctx.save();
    ctx.translate(-this.scrollX, 0);
    // Ground
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.groundY, 5000, 120);
    let grd = ctx.createLinearGradient(0, this.groundY, 0, this.groundY + 120);
    grd.addColorStop(0, "#202026");
    grd.addColorStop(0.5, "#1a1a1a");
    grd.addColorStop(1, "#1e2323");
    ctx.fillStyle = grd;
    ctx.shadowColor = "#39ff148c";
    ctx.shadowBlur = 16;
    ctx.fill(); ctx.restore();

    // Neon toxic glow
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
    // Zombies
    for (let z of this.zombies) this._drawZombie(ctx, z);
    // Player
    this._drawPlayer(ctx, this.player);
    // Bullets
    for (let b of this.bullets) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2, false);
      ctx.shadowColor = this.theme.accent;
      ctx.shadowBlur = 14;
      ctx.fillStyle = this.theme.accent;
      ctx.globalAlpha = 0.89;
      ctx.fill();
      ctx.restore();
    }
    // Effects - labels
    for (let e of this.effects) {
      if (e.type === "muzzle") {
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
      if (e.type === "label") {
        ctx.save();
        ctx.font = "bold 22px Segoe UI, Arial, sans-serif";
        let alpha = Math.max(0, 1 - e.t / 32 - 0.21);
        ctx.globalAlpha = alpha;
        let yFloat = e.y - e.t * 1.5 - 26 * Math.max(0.3, alpha);
        ctx.lineWidth = 4;
        ctx.strokeStyle = e.outline || "#181718";
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
  _drawBG(ctx) {
    const grd = ctx.createLinearGradient(0, 0, 0, this.height);
    grd.addColorStop(0, "#292940");
    grd.addColorStop(0.4, "#1a1a1a");
    grd.addColorStop(1, "#252536");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, this.width, this.height);
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
    // Body
    ctx.save(); ctx.beginPath(); ctx.roundRect(-16, 0, 32, 50, 12);
    ctx.fillStyle = "#1e1e22";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 18;
    ctx.fill(); ctx.restore();
    // Head
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -15, 16, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1e1f2f";
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 8;
    ctx.fill(); ctx.restore();
    // Eyes
    ctx.save(); ctx.globalAlpha = 0.86;
    ctx.beginPath(); ctx.ellipse(-6, -8, 5, 7, 0, 0, Math.PI * 2); ctx.ellipse(6, -8, 5, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#39ff14"; ctx.shadowColor = "#39ff14"; ctx.shadowBlur = 9; ctx.fill();
    ctx.restore();
    // Gun
    ctx.save(); ctx.rotate(p.dir === 1 ? 0.08 : -0.12); ctx.beginPath(); ctx.rect(p.dir === 1 ? 15 : -41, 13, 26, 8);
    ctx.fillStyle = "#2ecffd"; ctx.shadowColor = "#2ecffd"; ctx.shadowBlur = 5; ctx.globalAlpha = 0.89; ctx.fill();
    ctx.restore();
    // Arm
    ctx.save(); ctx.beginPath(); ctx.lineWidth = 7; ctx.moveTo(0, 12); ctx.lineTo(p.dir * 16, 28);
    ctx.strokeStyle = "#39ff14"; ctx.shadowColor = "#39ff14"; ctx.shadowBlur = 5; ctx.globalAlpha = 0.7; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  _drawZombie(ctx, z) {
    ctx.save();
    ctx.translate(z.x, z.y);
    // Body
    ctx.save(); ctx.beginPath();
    ctx.roundRect(-z.w / 2, 0, z.w, z.h, Math.max(8, Math.min(16, Math.round(z.w / 4))));
    ctx.fillStyle = z.dead ? "#3ba04e" : z.color;
    ctx.shadowColor = z.dead ? "#37c84666" : z.shadow;
    ctx.shadowBlur = z.dead ? 3 : 17; ctx.globalAlpha = z.dead ? 0.65 : 1; ctx.fill(); ctx.restore();
    // Head
    ctx.save(); ctx.beginPath();
    ctx.ellipse(0, -10, Math.max(10, z.w / 2), Math.max(7, z.w / 2.7), 0, 0, Math.PI * 2);
    ctx.fillStyle = z.head; ctx.shadowColor = "#39ff14"; ctx.shadowBlur = 6; ctx.fill(); ctx.restore();
    // Eyes
    ctx.save(); ctx.globalAlpha = z.dead ? 0.33 : 1; ctx.beginPath();
    ctx.arc(-7, -12, 3, 0, Math.PI * 2); ctx.arc(7, -12, 3, 0, Math.PI * 2);
    ctx.fillStyle = z.eyes; ctx.shadowColor = "#aa2c69"; ctx.shadowBlur = 8; ctx.fill(); ctx.restore();
    // Mouth
    ctx.save(); ctx.beginPath(); ctx.arc(0, -3, 8, 0, Math.PI, false);
    ctx.lineWidth = 2; ctx.strokeStyle = "#aa2c69"; ctx.stroke(); ctx.restore();
    ctx.restore();
  }
}

// PUBLIC_INTERFACE: AnimationFrame hook
function useAnimationFrame(callback, enabled = true) {
  const req = useRef();
  useEffect(() => {
    if (!enabled) return;
    let anim = (ts) => { callback(ts); req.current = requestAnimationFrame(anim); };
    req.current = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(req.current);
  }, [callback, enabled]);
}
