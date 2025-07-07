import React, { useState, useEffect, useRef, useCallback } from "react";
import { saveHighscore } from "./supabaseClient";
import Leaderboard from "./components/Leaderboard.jsx";

/**
 * PUBLIC_INTERFACE
 * Main Game Component - handles all game logic, UI, canvas rendering, controls, spawn, and leaderboard.
 */
const THEME = {
  accent: "#aa2c69",
  primary: "#39ff14",
  secondary: "#1a1a1a",
  canvasMaxW: 0.95,  // 95vw
  canvasMaxH: 0.90,  // 90vh
};

const ENEMIES = [
  { key: "zombie", color: "#6efd9a", shadow: "#39ff1475", head: "#161e13", eye: "#fb73fa", speed: 2, w: 44, h: 62, score: 100 },
  { key: "bird", color: "#2ecffd", shadow: "#2ecffd84", head: "#283957", eye: "#39ff14", speed: 3.2, w: 38, h: 36, score: 170 },
  { key: "bot", color: "#aa2c69", shadow: "#aa2c697a", head: "#32213e", eye: "#fff", speed: 2.8, w: 41, h: 46, score: 130 }
];

function randomEnemyType() {
  return ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
}

function createPlayer(x, y) {
  return {
    x, y,
    width: 32,
    height: 56,
    speed: 8.5,
    dir: 1,
    shootCooldown: 0,
  };
}

function createBullet(x, y, dir) {
  return {
    x,
    y,
    vx: dir * 25,
    vy: 0,
    width: 12,
    height: 8,
    dir,
  };
}

function spawnEnemy(canvasW, setEnemies, spawnTick=0) {
  // spawn at both sides, more aggressive as tick increases
  const type = randomEnemyType();
  const fromLeft = Math.random() > 0.5;
  setEnemies(es =>
    [
      ...es,
      {
        ...type,
        x: fromLeft ? -type.w : canvasW + type.w,
        y: 410 + Math.round(Math.random() * 95) - (type.key === "bird" ? 100 : 0),
        fromLeft,
        dead: false,
        diedTick: spawnTick || 0
      }
    ]
  );
}

function boxCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.width > b.x && a.y < b.y + b.h && a.y + a.height > b.y;
}

function getCanvasDims() {
  // Maximizes canvas up to 95vw x 90vh but preserves 4:3 aspect (or uses all available)
  const vw = Math.floor(window.innerWidth * THEME.canvasMaxW);
  const vh = Math.floor(window.innerHeight * THEME.canvasMaxH);
  let width = Math.min(1024, Math.max(480, vw));
  let height = Math.floor(width * 0.75);
  if (height > vh) {
    height = Math.max(340, vh);
    width = Math.floor(height * (4/3));
  }
  return { width, height };
}

function drawBG(ctx, width, height) {
  // synthwave background gradient + horizon
  const grad = ctx.createLinearGradient(0,0,0, height);
  grad.addColorStop(0, "#392990");
  grad.addColorStop(0.46, "#23243a");
  grad.addColorStop(1, "#111117");
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,width,height);
  // sunrise circle
  ctx.save();
  ctx.globalAlpha = 0.21;
  ctx.beginPath();
  ctx.arc(width/2, 160, 220, 0, Math.PI*2);
  ctx.fillStyle = "#aa2c69";
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 90;
  ctx.fill();
  ctx.restore();
  // scanlines
  for (let i=0; i<height; i+=14) {
    ctx.save();
    ctx.globalAlpha = 0.08+(i/height)*0.09;
    ctx.fillStyle = "#39ff14";
    ctx.fillRect(0, i, width, 2);
    ctx.restore();
  }
}

function drawPlayer(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.save(); // Body
  ctx.beginPath();
  ctx.roundRect(-16, 0, 32, 50, 12);
  ctx.fillStyle = "#1e1e22";
  ctx.shadowColor = THEME.primary;
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();
  ctx.save(); // Head
  ctx.beginPath();
  ctx.ellipse(0, -15, 16, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#aa2c69";
  ctx.shadowColor = THEME.primary;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
  ctx.save(); // Eyes
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.ellipse(-6, -8, 5, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(+6, -8, 5, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = THEME.primary;
  ctx.shadowColor = THEME.primary;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
  ctx.save(); // Blaster
  ctx.rotate(p.dir === 1 ? 0.06 : -0.11);
  ctx.beginPath();
  ctx.rect(p.dir === 1 ? 16 : -41, 18, 26, 8);
  ctx.fillStyle = "#2ecffd";
  ctx.shadowColor = "#2ecffd";
  ctx.shadowBlur = 5;
  ctx.globalAlpha = 0.89;
  ctx.fill();
  ctx.restore();
  ctx.save(); // Arm
  ctx.beginPath();
  ctx.lineWidth = 7;
  ctx.moveTo(0, 12);
  ctx.lineTo(p.dir*18, 29);
  ctx.strokeStyle = THEME.primary;
  ctx.shadowColor = THEME.primary;
  ctx.shadowBlur = 5;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawEnemy(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.key === "zombie" || !e.key) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-e.w/2, 0, e.w, e.h, 12);
    ctx.fillStyle = e.dead ? "#3ba04e" : e.color;
    ctx.shadowColor = e.dead ? "#37c84666" : e.shadow;
    ctx.shadowBlur = e.dead ? 3 : 14;
    ctx.globalAlpha = e.dead ? 0.46 : 1;
    ctx.fill();
    ctx.restore();
    ctx.save(); // Head
    ctx.beginPath();
    ctx.ellipse(0, -12, Math.max(10, e.w/2), Math.max(7, e.w/2.8), 0, 0, Math.PI * 2);
    ctx.fillStyle = e.head;
    ctx.shadowColor = THEME.primary;
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.restore();
    ctx.save(); // Eyes
    ctx.globalAlpha = e.dead ? 0.19 : 1;
    ctx.beginPath();
    ctx.arc(-7, -11, 3, 0, Math.PI*2);
    ctx.arc(+7, -11, 3, 0, Math.PI*2);
    ctx.fillStyle = e.eye;
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  } else if (e.key === "bird") {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 8, e.w/2, e.h/2, 0, 0, Math.PI*2);
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.shadow;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = e.dead ? 0.39 : 1;
    ctx.fill();
    ctx.restore();
    ctx.save(); // Wings
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = e.dead ? 0.07 : 0.08 + 0.17 * Math.abs(Math.sin(Date.now()/142));
    ctx.beginPath();
    ctx.ellipse(-12, 6, 12, 4, -0.32, 0, Math.PI*2);
    ctx.ellipse(12, 6, 12, 4, 0.32, 0, Math.PI*2);
    ctx.fill(); ctx.restore();
    ctx.save(); // Eye
    ctx.beginPath();
    ctx.arc(+8, 5, 3, 0, Math.PI*2);
    ctx.fillStyle = e.eye;
    ctx.shadowColor = "#2ecffd";
    ctx.shadowBlur = 7;
    ctx.globalAlpha = 0.98;
    ctx.fill();
    ctx.restore();
  } else if (e.key === "bot") {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-e.w/2, 5, e.w, e.h, 13);
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.shadow;
    ctx.shadowBlur = e.dead ? 1.2 : 13;
    ctx.globalAlpha = e.dead ? 0.21 : 1;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -10, Math.max(12, e.w/2), 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = e.head;
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -8, 8, 0, Math.PI*2);
    ctx.fillStyle = e.eye;
    ctx.globalAlpha = 0.79;
    ctx.shadowBlur = 13;
    ctx.shadowColor = "#fff";
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawBullet(ctx, b) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(b.x, b.y, 8, 0, 2 * Math.PI, false);
  ctx.shadowColor = "#2ecffd";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#2ecffd";
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.restore();
}

const HUD_PERSIST_STYLE = {
  position: "fixed", left: 0, top:0, width:"100vw", zIndex:5,
  background: "linear-gradient(to bottom, rgba(26,26,26,0.94) 85%, rgba(26,26,26,0.14) 100%)",
  boxShadow: "0 0 16px #39ff1440", padding: 0, margin:0
};

function Game() {
  // Canvas sizing/state
  const [dims, setDims] = useState(getCanvasDims());
  const [gameState, setGameState] = useState("menu"); // menu|playing|gameover
  const [score, setScore] = useState(0);
  const [player, setPlayer] = useState(() => createPlayer(Math.round(dims.width/5), dims.height-210));
  const [enemies, setEnemies] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [control, setControl] = useState({ left:false, right:false, face:1, shoot:false });
  const [lastDir, setLastDir] = useState(1);
  const [tick, setTick] = useState(0);
  const [touchUI, setTouchUI] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [scoreStatus, setScoreStatus] = useState("");
  const [sendingScore, setSendingScore] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const canvasRef = useRef();

  // Responsive canvas
  useEffect(() => {
    function handleResize() {
      const d = getCanvasDims();
      setDims(d);
    }
    window.addEventListener("resize", handleResize);
    setTouchUI(window.innerWidth < 900);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keyboard controls
  useEffect(() => {
    function down(e) {
      if (gameState !== "playing") return;
      if (["ArrowLeft", "a", "A"].includes(e.key)) { setControl(s => ({...s, left:true, face:-1})); setLastDir(-1);}
      if (["ArrowRight", "d", "D"].includes(e.key)) { setControl(s => ({...s, right:true, face:1})); setLastDir(1);}
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) setControl(s => ({...s, shoot:true}));
    }
    function up(e) {
      if (["ArrowLeft", "a", "A"].includes(e.key)) setControl(s => ({...s,left:false}));
      if (["ArrowRight", "d", "D"].includes(e.key)) setControl(s => ({...s,right:false}));
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) setControl(s => ({...s,shoot:false}));
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    }
  }, [gameState]);

  // Main game loop (tick)
  useEffect(() => {
    if (gameState !== "playing") return;
    let animId;
    function loop() {
      setTick(t => t + 1);
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState]);

  // Tick: game logic
  useEffect(() => {
    if (gameState !== "playing") return;

    setPlayer(p => {
      let nx = p.x;
      if (control.left) nx = Math.max(12, nx - p.speed);
      if (control.right) nx = Math.min(dims.width-28, nx + p.speed);
      return { ...p, x:nx, dir: control.face ?? lastDir };
    });

    setBullets(bs => bs.map(b => ({...b, x: b.x + b.vx})).filter(b => b.x > -45 && b.x < dims.width+45));

    setEnemies(es => es.map(e => ({
      ...e,
      x: e.fromLeft ? e.x + e.speed : e.x - e.speed,
    })).filter(e => e.x > -80 && e.x < dims.width+80 && !e.dead));

    setBullets(bs => {
      const newEnemies = [...enemies];
      let scoreAdd = 0;
      const remain = [];
      for (let b of bs) {
        let hit = false;
        for (let i = 0; i < newEnemies.length; ++i) {
          const e = newEnemies[i];
          if (!e.dead && boxCollide(b, {...e, width: e.w, height: e.h})) {
            hit = true;
            newEnemies[i] = { ...e, dead: true, diedTick: tick};
            scoreAdd += e.score;
            break;
          }
        }
        if (!hit) remain.push(b);
      }
      setEnemies(newEnemies);
      if (scoreAdd > 0) setScore(s => s + scoreAdd);
      return remain;
    });

    // Player collision
    for (let e of enemies) {
      if (!e.dead && boxCollide(player, {...e, width: e.w, height: e.h})) {
        setGameState("gameover");
        setTimeout(() => setShowNamePrompt(true), 700);
        return;
      }
    }

    setEnemies(es => es.filter(e => !e.dead || (tick - (e.diedTick||0) < 22)));

    // Enemy spawn
    if (tick % Math.max(28, 44 - Math.floor(tick/160)) === 0) {
      spawnEnemy(dims.width, setEnemies, tick);
    }
  // eslint-disable-next-line
  }, [tick, control, dims, gameState]); // player, enemies, ...

  // Shooting
  useEffect(() => {
    if (gameState !== "playing") return;
    if (control.shoot && player.shootCooldown <= 0) {
      setBullets(bs => [...bs, createBullet(player.x + player.dir * 29, player.y + 27, player.dir)]);
      setPlayer(p => ({...p, shootCooldown: 10}));
    }
  }, [control.shoot, player.x, player.y, player.dir, gameState]);

  // Shoot cooldown
  useEffect(() => {
    if (gameState !== "playing") return;
    if (player.shootCooldown > 0) {
      const timeout = setTimeout(() => setPlayer(p=>({...p, shootCooldown: Math.max(0, p.shootCooldown-1)})), 15);
      return () => clearTimeout(timeout);
    }
  }, [player.shootCooldown, gameState]);

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0,0,dims.width,dims.height);
    drawBG(ctx, dims.width, dims.height);
    enemies.forEach(e => drawEnemy(ctx, {...e, w: e.w, h: e.h}));
    bullets.forEach(b => drawBullet(ctx, b));
    drawPlayer(ctx, player);
    if (gameState === "gameover") {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#161c33af";
      ctx.fillRect(0,0,dims.width,dims.height);
      ctx.restore();
    }
  }, [player, enemies, bullets, gameState, tick, dims]);

  // Game control handlers
  function startGame() {
    setScore(0);
    const spawnX = Math.round(dims.width/5);
    setPlayer(createPlayer(spawnX, dims.height-210));
    setEnemies([]); setBullets([]);
    setGameState("playing");
    setScoreStatus(""); setShowNamePrompt(false); setSendingScore(false);
    setTick(0);
  }
  function quitGame() {
    setGameState("menu");
    setScore(0);
    setPlayer(createPlayer(Math.round(dims.width/5), dims.height-210));
    setEnemies([]); setBullets([]);
    setScoreStatus(""); setShowNamePrompt(false); setSendingScore(false);
    setTick(0);
  }

  // Touch controls
  function handleTouch(type, enable) {
    if (gameState !== "playing") return;
    if (type === "left") { setControl(c => ({...c, left: enable, face: -1})); setLastDir(-1);}
    if (type === "right") { setControl(c => ({...c, right: enable, face: 1})); setLastDir(1);}
    if (type === "shoot") {
      setControl(c => ({...c, shoot: enable}));
      if (enable) setTimeout(() => setControl(c => ({...c, shoot: false})), 85);
    }
    if (type === "faceleft" && enable) { setControl(c => ({...c, face: -1})); setLastDir(-1);}
    if (type === "faceright" && enable) { setControl(c => ({...c, face: 1})); setLastDir(1);}
  }

  // Save highscore
  async function saveScoreAndReset(e) {
    if (e) e.preventDefault();
    setSendingScore(true);
    setScoreStatus("");
    try {
      let name = playerName || "Anon";
      await saveHighscore(name, score);
      setScoreStatus("Score saved!");
    } catch (err) {
      setScoreStatus("Error! Not saved.");
    }
    setTimeout(quitGame, 1100);
  }

  // NeonControls
  const NeonControls = useCallback(() => (
    <div className={"btn-panel" + (touchUI ? " btn-panel-mobile" : "")}>
      <button className="neon-control-btn" tabIndex={-1} aria-label="Face Left"
        onTouchStart={()=>handleTouch("faceleft",true)} onMouseDown={()=>handleTouch("faceleft",true)}
      >⮜</button>
      <button className="neon-control-btn" tabIndex={-1} aria-label="Move Left"
        onTouchStart={()=>handleTouch("left",true)} onTouchEnd={()=>handleTouch("left",false)}
        onMouseDown={()=>handleTouch("left",true)} onMouseUp={()=>handleTouch("left",false)}
      >◀</button>
      <button className="neon-control-btn" tabIndex={-1} aria-label="Move Right"
        onTouchStart={()=>handleTouch("right",true)} onTouchEnd={()=>handleTouch("right",false)}
        onMouseDown={()=>handleTouch("right",true)} onMouseUp={()=>handleTouch("right",false)}
      >▶</button>
      <button className="neon-control-btn" tabIndex={-1} aria-label="Face Right"
        onTouchStart={()=>handleTouch("faceright",true)} onMouseDown={()=>handleTouch("faceright",true)}
      >⮞</button>
      <button className="neon-control-btn neon-btn-accent" tabIndex={-1} aria-label="Shoot"
        onTouchStart={()=>handleTouch("shoot",true)} onClick={()=>handleTouch("shoot",true)}
      >💥</button>
    </div>
  ), [touchUI]);

  // HUD, persistent at all times
  const Hud = useCallback(() => (
    <div className="hud-container" style={HUD_PERSIST_STYLE}>
      <div className="hud-left">
        <div className="hud-title">SCORE: {score}</div>
      </div>
      <div className="hud-center"/>
      <div className="hud-right" style={{flexDirection:'column',alignItems:'flex-end'}}>
        <button className="neon-btn neon-btn-accent" onClick={quitGame}>Quit</button>
        <button className="neon-btn" style={{marginTop:12, background:"#323252", color: "#39ff14"}} onClick={()=>setShowLeaderboard(true)}>
          Leaderboard
        </button>
      </div>
    </div>
  ), [score]);

  // Overlay modal screens
  function GameOverlay() {
    if (gameState === "menu") {
      return (
        <div className="game-overlay">
          <h1 className="neon-title" style={{marginBottom:'0.12em'}}>SYNTH ZOMBIE SHOOTER</h1>
          <p className="subtitle neon-text" style={{marginBottom:'2.0em'}}>Fight zombies, birds, & bots! Shoot left/right in a neon dystopia.<br/>Top score? Try for leaderboard immortality!</p>
          <button className="neon-btn" onClick={startGame} autoFocus>Start Game</button>
          <button className="neon-btn neon-btn-accent" onClick={()=>setShowLeaderboard(true)} style={{marginLeft:"1em"}}>Leaderboard</button>
        </div>
      );
    }
    if (showNamePrompt) {
      return (
        <div className="game-overlay">
          <div style={{marginBottom:'1.2em'}}>
            <div className="game-over-title neon-text">GAME OVER</div>
            <div className="big-score neon-text">Score: {score}</div>
          </div>
          <form onSubmit={saveScoreAndReset}>
            <div>
              <label style={{fontSize:'1.24em',letterSpacing:'.06em',color:THEME.primary}}>Enter Name for High Score:</label>
            </div>
            <input
              className="neon-input"
              type="text"
              maxLength={16}
              autoFocus
              value={playerName}
              disabled={sendingScore}
              onChange={e => setPlayerName(e.target.value.replace(/[^a-z0-9_\\- ]/ig,''))}
              style={{
                margin: '0.8em auto', fontSize: '1.09em', padding: '.5em 1em',
                background: '#191925', color: THEME.primary, borderRadius: '10px',
                border: `2px solid ${THEME.primary}`, boxShadow: '0 0 8px #39ff1460'
              }}
            />
            <button type="submit" className="neon-btn" style={{width: 140,marginBottom:'0.7em'}} disabled={sendingScore}>Save</button>
          </form>
          <div style={{fontSize: '1.1em', minHeight:'2em', color: THEME.accent, fontWeight:700, marginTop:7}}>
            {scoreStatus}
          </div>
          <button className="neon-btn neon-btn-accent" onClick={quitGame} style={{marginTop:'1.4em'}}>Quit to Menu</button>
        </div>
      );
    }
    if (gameState === "gameover") {
      return (
        <div className="game-overlay">
          <div className="game-over-title neon-text">GAME OVER</div>
          <div className="big-score neon-text">Score: {score}</div>
        </div>
      );
    }
    return null;
  }

  // Add missing modern neon input style (for name prompt) if not already exist
  useEffect(() => {
    if (!document.getElementById('synth-neon-input')) {
      const style = document.createElement("style");
      style.id = "synth-neon-input";
      style.innerHTML = ".neon-input:focus { outline: 2px solid #2ecffd; box-shadow: 0 0 18px #2ecffd99; }";
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div className="neon-app-root" style={{flexDirection:'column'}}>
      <Hud />
      <div className="game-canvas-container"
        style={{
          width: dims.width, maxWidth:"98vw",
          height: dims.height, minHeight:280,
        }}>
        <canvas
          id="game-canvas"
          width={dims.width}
          height={dims.height}
          ref={canvasRef}
          tabIndex={1}
          aria-label="Game Canvas"
        />
        <GameOverlay />
        <Leaderboard visible={showLeaderboard} onClose={()=>setShowLeaderboard(false)} />
      </div>
      <NeonControls />
      <footer className="footer-note">2024 &copy; Neon Synth Zombie Shooter</footer>
    </div>
  );
}

export default Game;
