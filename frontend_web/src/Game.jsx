import React, {
  useState, useEffect, useRef
} from "react";
import { saveHighscore } from "./supabaseClient";
import Leaderboard from "./components/Leaderboard.jsx";

console.log("[Game.jsx] MODULE LOADED (top-level — should always fire on import)");

/* ─────────── CONSTANTS ─────────── */
const THEME = {
  primary: "#39ff14",
  accent:  "#aa2c69",
  canvasW: 0.95,  // 95 vw
  canvasH: 0.90,  // 90 vh
};
const ENEMY_TYPES = {
  zombie: { key:"zombie", w:44, h:62, speed:2,  color:"#6efd9a", eye:"#fb73fa", score:100 },
  bird  : { key:"bird"  , w:38, h:36, speed:3.2,color:"#2ecffd", eye:"#39ff14", score:170 },
  bot   : { key:"bot"   , w:41, h:46, speed:2.8,color:"#aa2c69", eye:"#ffffff", score:130 },
};
const ENEMY_KEYS = Object.keys(ENEMY_TYPES);
const rand = (min, max) => Math.random()*(max-min)+min;
const getDims = () =>{
  const w = Math.floor(window.innerWidth  * THEME.canvasW);
  const h = Math.floor(window.innerHeight * THEME.canvasH);
  // keep ≤ 4:3 aspect
  const width  = Math.min(w, h*4/3);
  const height = Math.min(h, width*3/4);
  return { width, height };
};

/* ─────────── REACT GAME COMPONENT ─────────── */
export default function Game() {
  // ───── HOOK DECLARATIONS MUST BE AT TOP ─────
  const [dims, setDims]      = useState(getDims());
  const [gameState, setGS]   = useState("menu");   // menu | play | over
  const [score, setScore]    = useState(0);
  const [showLB, setShowLB]  = useState(false);
  const [namePrompt, setNP]  = useState(false);
  const [playerName, setPN]  = useState("");
  const [status, setStatus]  = useState("");
  const [touchUI, setTouch]  = useState(window.innerWidth < 900);

  const canvasRef   = useRef(null);
  const playerRef   = useRef({ x:120, y:0, w:32, h:56, dir:1, cd:0 });
  const enemiesRef  = useRef([]);
  const bulletsRef  = useRef([]);
  const keysRef     = useRef({left:false,right:false,shoot:false});
  const tickRef     = useRef(0);
  const spawnTimer  = useRef(0);

  // --- Add debug logging for useEffect on gameState ---
  useEffect(() => {
    console.log("[Game.jsx] useEffect([gameState]) fired, current gameState:", gameState);
    console.log(`[Game.jsx] gameState changed -->`, gameState);
  }, [gameState]);

  /* ─── resize listener ─── */
  useEffect(() => {
    const onR = () => setDims(getDims());
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  /* ─── keyboard ─── */
  useEffect(() => {
    const kDown = e => {
      if (gameState !== "play") return;
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left  = true;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = true;
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) keysRef.current.shoot = true;
    };
    const kUp = e => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left  = false;
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

  /* ─── core loop ─── */
  useEffect(() => {
    if (gameState !== "play") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Acquire 2d context, defensive so we can debug more easily
    let ctx = canvas.getContext("2d");
    if (!ctx) {
      // fallback: try to acquire again
      ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("[Game.jsx] Could not get canvas 2d context");
        return;
      }
    }

    let animId;
    let last = performance.now();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, dims]);

  // Insert debug log at top of startGame, before/after setGS
  function startGame() {
    console.log("[Game.jsx] Start Game CLICKED");
    console.log("[Game.jsx] gameState before setGS:", gameState);
    setGS("play");
    console.log("[Game.jsx] (after setGS) gameState (should still be previous):", gameState);
    // Optionally, you could also call reset() here if the correct effect is to start from a clean state.
  }

  /* ───────── update world ───────── */
  function updateLogic(dt) {
    // Instrument: log tick and enemies count at every call (top of updateLogic)
    console.log("tick", tickRef.current, "enemies:", enemiesRef.current.length);

    const p = playerRef.current;
    /* move */
    if (keysRef.current.left)  { p.x -= 8; p.dir = -1; }
    if (keysRef.current.right) { p.x += 8; p.dir =  1; }
    p.x = Math.max(16, Math.min(dims.width - 48, p.x));

    /* shoot */
    if (keysRef.current.shoot && p.cd <= 0) {
      bulletsRef.current.push({ x: p.x + p.dir*30, y: p.y + 30, vx: p.dir*25, r: 6 });
      p.cd = 200; // 200 ms cooldown
    }
    p.cd -= dt;

    /* bullets move -- always shallow clone before map/filter */
    bulletsRef.current = [...bulletsRef.current]
      .map(b=>({ ...b, x:b.x+b.vx }))
      .filter(b => b.x > -50 && b.x < dims.width+50);

    /* spawn enemies every adaptive interval */
    spawnTimer.current += dt;
    const targetDelay = Math.max(400, 1500 - score*40); // faster when score high
    if (spawnTimer.current > targetDelay) {
      console.log("SPAWN!", targetDelay);
      spawnTimer.current = 0;
      spawnEnemy();
    }

    /* move enemies -- always shallow clone before map/filter */
    enemiesRef.current = [...enemiesRef.current]
      .map(e => ({ ...e, x:e.x+e.vx }))
      .filter(e => e.x > -e.w-60 && e.x < dims.width+e.w+60 && !e.dead);

    /* handle collisions */
    bulletsRef.current.forEach((b, bi) => {
      enemiesRef.current.forEach((e, ei) => {
        if (!e.dead && Math.abs(b.x-e.x) < e.w/2 && Math.abs(b.y-e.y) < e.h/2) {
          // hit
          e.dead = true;
          bulletsRef.current[bi]._kill = true;
          setScore(s => s + e.score);
        }
      });
    });
    bulletsRef.current = [...bulletsRef.current].filter(b => !b._kill);

    /* player collision => game over */
    enemiesRef.current.forEach(e => {
      if (!e.dead && Math.abs(e.x-p.x) < e.w/2 && Math.abs(e.y-p.y) < e.h/2) {
        setGS("over");
        setTimeout(() => setNP(true), 600);
      }
    });
  }

  /* ───────── draw ───────── */
  function draw(ctx) {
    // Defensive checks so rendering never silently fails
    if (!ctx) return;
    const { width, height } = dims;
    ctx.clearRect(0,0,width,height);
    drawBG(ctx,width,height);

    // --- Draw Enemies
    for (const e of enemiesRef.current) {
      if (e.dead) continue;
      ctx.save();

      // Distinct colors per type for debug
      let fill;
      if (e.key === "zombie") fill = "#39ff14";
      else if (e.key === "bot") fill = "#ea2c97";
      else if (e.key === "bird") fill = "#2ecffd";
      else fill = "#aaa";

      ctx.globalAlpha = 0.97;
      ctx.shadowColor = fill;
      ctx.shadowBlur = 12;
      ctx.fillStyle = fill;

      if (e.key === "bird") {
        ctx.beginPath();
        ctx.arc(e.x, e.y, 19, 0, Math.PI * 2);
        ctx.fill();
        // "bird" eye
        ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(e.x+4, e.y-2, 3, 0, Math.PI*2);
        ctx.fillStyle = "#fff"; ctx.fill();
      } else if (e.key === "bot") {
        ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
        // Simple "eye"
        ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(e.x + e.w/4, e.y - e.h/4, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#fb73fa"; ctx.fill();
      } else {
        // Zombie (rect with a head)
        ctx.fillRect(e.x - e.w/2, e.y - e.h/2 + 12, e.w, e.h - 14);
        ctx.beginPath();
        ctx.arc(e.x, e.y - e.h/2 + 20, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- Draw Bullets (fireballs/lasers)
    for (const b of bulletsRef.current) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.shadowColor = "#2ecffd";
      ctx.shadowBlur = 13;
      ctx.fillStyle = "#2ecffd";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r || 7, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // --- Draw Player bottom-center (debug: magenta body, neon head)
    const p = playerRef.current;
    ctx.save();
    ctx.translate(p.x, p.y);

    // Body - bottom-aligned rectangle in bright color for visibility
    ctx.fillStyle = "#9633f9";
    ctx.shadowColor = "#9633f9";
    ctx.shadowBlur = 17;
    ctx.fillRect(-17, -49, 34, 49);
    // Head - neon accented circle
    ctx.beginPath();
    ctx.arc(0, -61, 18, 0, Math.PI*2);
    ctx.fillStyle = "#39ff14";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 16;
    ctx.fill();
    // "Eye"/visor - accent
    ctx.beginPath();
    ctx.arc(0, -64, 5, 0, Math.PI*2);
    ctx.fillStyle = "#aa2c69";
    ctx.fill();

    ctx.restore();
  }

  /* ───────── spawn helper ───────── */
  function spawnEnemy() {
    const key   = ENEMY_KEYS[Math.floor(Math.random() * ENEMY_KEYS.length)];
    const base  = ENEMY_TYPES[key];
    const sideL = Math.random() < 0.5;
    enemiesRef.current.push({
      ...base,
      x : sideL ? -base.w : dims.width+base.w,
      y : key === "bird" ? rand(dims.height*0.25, dims.height*0.55) : dims.height-base.h-64,
      vx: sideL ? base.speed : -base.speed,
      dead: false,
    });
  }

  /* ───────── save high‑score ───────── */
  async function handleSave() {
    try{
      await saveHighscore(playerName || "Anon", score);
      setStatus("Saved!");
    }catch(e){
      setStatus("Save failed");
    }
    setTimeout(() => { setGS("menu"); reset(); }, 1200);
  }

  /* ───────── helpers ───────── */
  function reset() {
    enemiesRef.current = [];
    bulletsRef.current = [];
    playerRef.current = { x:120, y:dims.height-210, w:32, h:56, dir:1, cd:0 };
    setScore(0); setNP(false); setStatus("");
    spawnEnemy();
  }

  /* ───────── UI elements ───────── */
  return (
    <div className="neon-app-root">
      <div style={{
        background: "#f06",
        color: "#fff",
        padding: "16px",
        fontSize: "1.3em",
        textAlign: "center",
        zIndex: 999,
        border: "3px solid #39ff14"
      }}>
        [Game.jsx] COMPONENT RENDERED!
      </div>
      {/* HUD */}
      <div className="hud-container" style={{position:"fixed",top:0,left:0,width:"100%"}}>
        <h2 style={{color:THEME.primary,margin:0}}>SCORE: {score}</h2>
        {gameState === "play" && <button className="neon-btn" onClick={() => setGS("menu")}>Quit</button>}
      </div>

      {/* Canvas */}
      <div className="game-canvas-container" style={{marginTop:80}}>
        <canvas
          ref={canvasRef}
          width={dims.width}
          height={dims.height}
          style={{width:dims.width, height:dims.height}}
        />
        { gameState === "menu" &&
          <div className="game-overlay">
            <h1 className="neon-title">SYNTH ZOMBIE SHOOTER</h1>
            <button
              className="neon-btn"
              onClick={() => {
                console.log("Start Game CLICKED");
                console.log("[Game.jsx] <Start Game> onClick: gameState before setGS:", gameState);
                startGame();
                console.log("[Game.jsx] <Start Game> onClick: gameState after setGS (should still be previous):", gameState);
              }}
              autoFocus
            >Start Game</button>
            <button className="neon-btn neon-btn-accent" onClick={() => setShowLB(true)}>Leaderboard</button>
          </div>
        }
        { gameState === "over" && !namePrompt &&
          <div className="game-overlay"><h1 className="game-over-title">GAME OVER</h1></div>
        }
        { namePrompt &&
          <div className="game-overlay">
            <h2 style={{marginBottom:10}}>Your Score: {score}</h2>
            <input
              value={playerName}
              onChange={e => setPN(e.target.value.slice(0,15))}
              placeholder="name"
              style={{padding:"8px 14px",fontSize:"1.1em"}}
            />
            <button className="neon-btn" onClick={handleSave}>Save</button>
            <div style={{marginTop:8}}>{status}</div>
          </div>
        }
        <Leaderboard visible={showLB} onClose={() => setShowLB(false)}/>
      </div>
    </div>
  );
}

/* ───────── helpers used above ───────── */
function drawBG(ctx, w, h) {
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,"#2b2870");g.addColorStop(.6,"#141429");g.addColorStop(1,"#0b0b15");
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  ctx.globalAlpha = .07; ctx.fillStyle = "#39ff14";
  for(let i=0; i<h; i+=14) ctx.fillRect(0,i,w,2);
  ctx.globalAlpha = 1;
}
function drawPlayer(ctx, p) {
  ctx.save(); ctx.translate(p.x,p.y);
  ctx.fillStyle = "#1e1e22"; ctx.shadowColor = THEME.primary; ctx.shadowBlur = 14;
  ctx.fillRect(-16,-50,32,50);
  ctx.beginPath(); ctx.arc(0,-62,16,0,Math.PI*2); ctx.fillStyle=THEME.accent; ctx.fill();
  ctx.restore();
}
function drawBullet(ctx, b) {
  ctx.save(); ctx.fillStyle = "#2ecffd"; ctx.shadowColor="#2ecffd"; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill(); ctx.restore();
}
