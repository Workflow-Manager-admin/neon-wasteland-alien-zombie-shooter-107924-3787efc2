import React, { useRef, useEffect, useState } from 'react';
import './App.css';
import supabase from './supabaseClient';

// Neon synthwave theme
const THEME = {
  accent: '#aa2c69',
  primary: '#39ff14',
  secondary: '#1a1a1a',
  white: '#fff',
  canvasWidth: 800,
  canvasHeight: 600,
};

const ENEMY_TYPES = [
  {
    key: 'zombie', color: '#6efd9a', shadow: '#39ff1475', head: '#161e13', eye: '#fb73fa', speed: 2, w: 44, h: 62, score: 100,
  },
  {
    key: 'bird', color: '#2ecffd', shadow: '#2ecffd84', head: '#283957', eye: '#39ff14', speed: 3.2, w: 38, h: 36, score: 170,
  },
  {
    key: 'bot', color: '#aa2c69', shadow: '#aa2c697a', head: '#32213e', eye: '#fff', speed: 2.8, w: 41, h: 46, score: 130,
  }
];

function randomEnemyType() {
  const idx = Math.floor(Math.random() * ENEMY_TYPES.length);
  return ENEMY_TYPES[idx];
}

// Animation loop hook
function useAnimationFrame(callback, running = true) {
  const req = useRef();
  useEffect(() => {
    if (running) {
      let anim = (ts) => {
        callback(ts);
        req.current = requestAnimationFrame(anim);
      };
      req.current = requestAnimationFrame(anim);
      return () => cancelAnimationFrame(req.current);
    }
  }, [running, callback]);
}

// PUBLIC_INTERFACE
function App() {
  // State
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [highscoreStatus, setHighscoreStatus] = useState('');
  
  // main gameplay refs
  const canvasRef = useRef();
  const [player, setPlayer] = useState(createPlayer());
  const [enemies, setEnemies] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [control, setControl] = useState({ left: false, right: false, face: 1, shoot: false });
  const [lastDir, setLastDir] = useState(1);
  const [touchUI, setTouchUI] = useState(false);
  const [tick, setTick] = useState(0);

  // Score submit
  const [sendingScore, setSendingScore] = useState(false);

  // Initial window sizing
  useEffect(() => {
    setTouchUI(window.innerWidth < 950);
    const onResize = () => setTouchUI(window.innerWidth < 950);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const down = (e) => {
      if (gameState !== 'playing') return;
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) { setControl(s => ({ ...s, left: true, face: -1 })); setLastDir(-1);}
      if (['ArrowRight', 'd', 'D'].includes(e.key)) { setControl(s => ({ ...s, right: true, face: 1 })); setLastDir(1);}
      if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) setControl(s => ({ ...s, shoot: true }));
    };
    const up = (e) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) setControl(s => ({ ...s, left: false }));
      if (['ArrowRight', 'd', 'D'].includes(e.key)) setControl(s => ({ ...s, right: false }));
      if ([' ', 'ArrowUp', 'w', 'W'].includes(e.key)) setControl(s => ({ ...s, shoot: false }));
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    }
  }, [gameState]);

  // Game loop
  useAnimationFrame(() => {
    if (gameState !== 'playing') return;
    setTick(t => t + 1);

    // Move player
    setPlayer(p => {
      let nx = p.x;
      if (control.left) { nx = Math.max(18, nx - p.speed); }
      if (control.right) { nx = Math.min(THEME.canvasWidth - 28, nx + p.speed); }
      return { ...p, x: nx, dir: control.face ?? lastDir };
    });

    // Bullets movement
    setBullets(bs => bs.map(b => ({ ...b, x: b.x + b.vx })).filter(b =>
      b.x > -40 && b.x < THEME.canvasWidth + 40)
    );

    // Enemies move: either L->R or R->L based on side
    setEnemies(es => es.map(e => ({
      ...e,
      x: e.fromLeft ? e.x + e.speed : e.x - e.speed,
    })).filter(e =>
      e.x > -80 && e.x < THEME.canvasWidth + 80 && !e.dead
    ));

    // Collision: bullets hit enemies
    setBullets(bs => {
      const newEnemies = [...enemies];
      const hits = [];
      let scoreAdd = 0;
      const remain = [];
      for (let b of bs) {
        let hit = false;
        for (let i = 0; i < newEnemies.length; ++i) {
          const e = newEnemies[i];
          if (!e.dead && boxCollide(b, e)) {
            hit = true;
            newEnemies[i] = { ...e, dead: true, diedTick: tick };
            scoreAdd += e.score;
            break;
          }
        }
        if (!hit) remain.push(b);
        else hits.push(b);
      }
      setEnemies(newEnemies);
      if (scoreAdd > 0) setScore(s => s + scoreAdd);
      return remain;
    });

    // Player collision (game over)
    for (let e of enemies) {
      if (!e.dead && boxCollide(player, e)) {
        setGameState('gameover');
        setTimeout(() => setShowNamePrompt(true), 700);
        return;
      }
    }

    // Remove old dead enemies
    setEnemies(es => es.filter(e => !e.dead || (tick - (e.diedTick||0) < 22)));

    // Enemy spawn timing
    if (tick % 37 === 0) {
      spawnEnemy(setEnemies);
    }
  }, gameState === 'playing');

  // Shooting!
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (control.shoot && player.shootCooldown <= 0) {
      // Fire bullet
      setBullets(bs =>
        [...bs, createBullet(player.x + player.dir * 29, player.y + 27, player.dir)]
      );
      setPlayer(p => ({ ...p, shootCooldown: 12 }));
    }
  }, [control.shoot, player.x, player.y, player.dir, gameState]); // trigger on shoot

  // Shoot cool down
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (player.shootCooldown > 0) {
      const timeout = setTimeout(() => {
        setPlayer(p => ({ ...p, shootCooldown: Math.max(0, p.shootCooldown - 1) }))
      }, 13);
      return () => clearTimeout(timeout);
    }
  }, [player.shootCooldown, gameState]);

  // New game
  function startGame() {
    setScore(0);
    setPlayer(createPlayer());
    setEnemies([]);
    setBullets([]);
    setGameState('playing');
    setHighscoreStatus('');
    setShowNamePrompt(false);
    setSendingScore(false);
    setTick(0);
  }
  // Quit to menu
  function quitGame() {
    setGameState('menu');
    setScore(0);
    setPlayer(createPlayer());
    setEnemies([]);
    setBullets([]);
    setHighscoreStatus('');
    setShowNamePrompt(false);
    setSendingScore(false);
    setTick(0);
  }

  // Touch controls
  function handleTouch(type, enable) {
    if (gameState !== 'playing') return;
    if (type === 'left') { setControl(c => ({ ...c, left: enable, face: -1 })); setLastDir(-1);}
    if (type === 'right') { setControl(c => ({ ...c, right: enable, face: 1 })); setLastDir(1);}
    if (type === 'shoot') {
      setControl(c => ({ ...c, shoot: enable }));
      if (enable) setTimeout(() => setControl(c => ({ ...c, shoot: false })), 90);
    }
    if (type === 'faceleft' && enable) { setControl(c => ({ ...c, face: -1 })); setLastDir(-1);}
    if (type === 'faceright' && enable) { setControl(c => ({ ...c, face: 1 })); setLastDir(1);}
  }

  // Save high score to Supabase
  async function saveScoreAndReset() {
    setSendingScore(true);
    setHighscoreStatus('');
    const username = playerName || 'Anon';
    try {
      await supabase
        .from('highscores')
        .insert([
          { player: username, score: score }
        ]);
      setHighscoreStatus('Score saved!');
    } catch (e) {
      setHighscoreStatus('Error saving score');
    }
    setTimeout(quitGame, 1100);
  }

  // Name prompt form
  function NamePrompt() {
    return (
      <div className="game-overlay">
        <div style={{marginBottom: '1.3em'}}>
          <div className="game-over-title neon-text">GAME OVER</div>
          <div className="big-score neon-text">Score: {score}</div>
        </div>
        <form onSubmit={e => { e.preventDefault(); saveScoreAndReset(); }}>
          <div>
            <label style={{fontSize:'1.2em',letterSpacing:'.06em',color:THEME.primary}}>Enter Name to Save High Score:</label>
          </div>
          <input
            className="neon-input"
            type="text"
            maxLength={16}
            autoFocus
            value={playerName}
            disabled={sendingScore}
            onChange={e => setPlayerName(e.target.value.replace(/[^a-z0-9_\- ]/ig,''))}
            style={{
              margin: '1em auto', fontSize: '1.02em', padding: '.49em 1em',
              background: '#191925', color: '#39ff14', borderRadius: '10px',
              border: `2px solid ${THEME.primary}`, boxShadow: '0 0 8px #39ff1460'
            }}
          />
          <button type="submit" className="neon-btn" style={{width: 140,marginBottom:'1em'}} disabled={sendingScore}>Save</button>
        </form>
        <div style={{fontSize: '1.11em', minHeight:'2em', color: THEME.accent, fontWeight: 700, marginTop:8}}>
          {highscoreStatus}
        </div>
        <button className="neon-btn neon-btn-accent" onClick={quitGame} style={{marginTop:'1.7em'}}>Quit without saving</button>
      </div>
    );
  }

  // Overlay screens
  function GameOverlay() {
    if (gameState === 'menu') {
      return (
        <div className="game-overlay">
          <h1 className="neon-title" style={{marginBottom:'0.18em'}}>SYNTH ZOMBIE SHOOTER</h1>
          <p className="subtitle neon-text" style={{marginBottom:'2.6em'}}>Fight zombies, birds, & bots! Shoot left/right, rack up your score, and survive the synthwave wasteland.<br/>Can you make the highscores?</p>
          <button className="neon-btn" onClick={startGame} autoFocus>Start Game</button>
        </div>
      );
    }
    if (showNamePrompt) {
      return <NamePrompt />;
    }
    if (gameState === 'gameover') {
      return (
        <div className="game-overlay">
          <div className="game-over-title neon-text">GAME OVER</div>
          <div className="big-score neon-text">Score: {score}</div>
        </div>
      );
    }
    return null;
  }

  // HUD
  function Hud() {
    return (
      <div className="hud-container">
        <div className="hud-left">
          <div className="hud-title">SCORE: {score}</div>
        </div>
        <div className="hud-center"/>
        <div className="hud-right" style={{flexDirection:'column',alignItems:'flex-end'}}>
          <button className="neon-btn neon-btn-accent" onClick={quitGame}>Quit</button>
        </div>
      </div>
    );
  }

  // Onscreen neon controls
  function NeonControls() {
    return (
      <div className={"btn-panel" + (touchUI ? " btn-panel-mobile" : "")}>
        <button
          className="neon-control-btn"
          tabIndex={-1}
          aria-label="Face Left"
          onTouchStart={() => handleTouch('faceleft', true)}
          onMouseDown={() => handleTouch('faceleft', true)}
        >⮜</button>
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
          aria-label="Move Right"
          onTouchStart={() => handleTouch('right', true)}
          onTouchEnd={() => handleTouch('right', false)}
          onMouseDown={() => handleTouch('right', true)}
          onMouseUp={() => handleTouch('right', false)}
        >▶</button>
        <button
          className="neon-control-btn"
          tabIndex={-1}
          aria-label="Face Right"
          onTouchStart={() => handleTouch('faceright', true)}
          onMouseDown={() => handleTouch('faceright', true)}
        >⮞</button>
        <button
          className="neon-control-btn neon-btn-accent"
          tabIndex={-1}
          aria-label="Shoot"
          onTouchStart={() => handleTouch('shoot', true)}
          onClick={() => handleTouch('shoot', true)}
        >💥</button>
      </div>
    );
  }

  // Drawing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, THEME.canvasWidth, THEME.canvasHeight);
    drawBG(ctx);

    // Draw all enemies
    for (let e of enemies) {
      drawEnemy(ctx, e);
    }

    // Draw all bullets
    for (let b of bullets) {
      drawBullet(ctx, b);
    }

    // Draw player
    drawPlayer(ctx, player);

    // Overlay dead effect (fade out when dead)
    if (gameState === 'gameover') {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#161c33af';
      ctx.fillRect(0, 0, THEME.canvasWidth, THEME.canvasHeight);
      ctx.restore();
    }
  }, [player, enemies, bullets, gameState, tick]);

  return (
    <div className="neon-app-root">
      <Hud />
      <div className="game-canvas-container">
        <canvas
          id="game-canvas"
          width={THEME.canvasWidth}
          height={THEME.canvasHeight}
          ref={canvasRef}
          tabIndex={1}
          aria-label="Game Canvas"
        />
        <GameOverlay />
      </div>
      <NeonControls />
      <footer className="footer-note">2024 &copy; Neon Synth Zombie Shooter</footer>
    </div>
  );
}

// --- Entities and core logic ---
function createPlayer() {
  return {
    x: 164,
    y: 380,
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
    dir
  };
}
// Two-way random spawn!
function spawnEnemy(setEnemies) {
  const type = randomEnemyType();
  const fromLeft = Math.random() > 0.5;
  setEnemies(es =>
    [
      ...es,
      {
        ...type,
        x: fromLeft ? -44 : THEME.canvasWidth + 44,
        y: 410 + Math.round(Math.random() * 100) - (type.key === "bird" ? 100 : 0),
        fromLeft,
        dead: false,
        diedTick: 0
      }
    ]);
}
// Simple rect collision
function boxCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.width > b.x && a.y < b.y + b.h && a.y + a.height > b.y;
}

// Visuals
function drawBG(ctx) {
  // synthwave horizon
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const grad = ctx.createLinearGradient(0,0,0, h);
  grad.addColorStop(0, "#392990");
  grad.addColorStop(0.46, "#23243a");
  grad.addColorStop(1, "#111117");
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,w,h);
  ctx.save();
  ctx.globalAlpha = 0.21;
  ctx.beginPath();
  ctx.arc(w/2, 160, 250, 0, Math.PI*2);
  ctx.fillStyle = "#aa2c69";
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 90;
  ctx.fill();
  ctx.restore();
  // synthwave scanlines
  for (let i=0; i<h; i+=16) {
    ctx.save();
    ctx.globalAlpha = 0.08+(i/h)*0.08;
    ctx.fillStyle = "#39ff14";
    ctx.fillRect(0, i, w, 3);
    ctx.restore();
  }
}

function drawPlayer(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  // Body
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-16, 0, 32, 50, 12);
  ctx.fillStyle = "#1e1e22";
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();
  // Head
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -15, 16, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#aa2c69";
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
  // Eyes
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.ellipse(-6, -8, 5, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(+6, -8, 5, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#39ff14";
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
  // Blaster
  ctx.save();
  ctx.rotate(p.dir === 1 ? 0.06 : -0.11);
  ctx.beginPath();
  ctx.rect(p.dir === 1 ? 16 : -41, 18, 26, 8);
  ctx.fillStyle = "#2ecffd";
  ctx.shadowColor = "#2ecffd";
  ctx.shadowBlur = 5;
  ctx.globalAlpha = 0.89;
  ctx.fill();
  ctx.restore();
  // Arm
  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = 7;
  ctx.moveTo(0, 12); ctx.lineTo(p.dir*18, 29);
  ctx.strokeStyle = "#39ff14";
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 5;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.key === 'zombie' || !e.key) {
    // Main zombies: neon green
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-e.w/2, 0, e.w, e.h, 12);
    ctx.fillStyle = e.dead ? "#3ba04e" : e.color;
    ctx.shadowColor = e.dead ? "#37c84666" : e.shadow;
    ctx.shadowBlur = e.dead ? 3 : 14;
    ctx.globalAlpha = e.dead ? 0.49 : 1;
    ctx.fill();
    ctx.restore();
    // Head
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -12, Math.max(10, e.w/2), Math.max(7, e.w/2.8), 0, 0, Math.PI * 2);
    ctx.fillStyle = e.head;
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.restore();
    // Eyes
    ctx.save();
    ctx.globalAlpha = e.dead ? 0.22 : 1;
    ctx.beginPath();
    ctx.arc(-7, -11, 3, 0, Math.PI*2);
    ctx.arc(+7, -11, 3, 0, Math.PI*2);
    ctx.fillStyle = e.eye;
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  } else if (e.key === 'bird') {
    // Birds: blue hovering
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 8, e.w/2, e.h/2, 0, 0, Math.PI*2);
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.shadow;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = e.dead ? 0.42 : 1;
    ctx.fill();
    ctx.restore();
    // Wings (animated)
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = e.dead ? 0.09 : 0.09 + 0.17 * Math.abs(Math.sin(Date.now()/128));
    ctx.beginPath();
    ctx.ellipse(-12, 6, 13, 5, -0.32, 0, Math.PI*2);
    ctx.ellipse(12, 6, 13, 5, 0.32, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    // Eye
    ctx.save();
    ctx.beginPath();
    ctx.arc(+8, 5, 3, 0, Math.PI*2);
    ctx.fillStyle = e.eye;
    ctx.shadowColor = "#2ecffd";
    ctx.shadowBlur = 7;
    ctx.globalAlpha = 0.98;
    ctx.fill();
    ctx.restore();
  } else if (e.key === 'bot') {
    // Robots: pink/neon
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-e.w/2, 5, e.w, e.h, 13);
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.shadow;
    ctx.shadowBlur = e.dead ? 1.2 : 13;
    ctx.globalAlpha = e.dead ? 0.28 : 1;
    ctx.fill();
    ctx.restore();
    // Head
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -10, Math.max(12, e.w/2), 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = e.head;
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    // Neon 'eye'
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -8, 8, 0, Math.PI*2);
    ctx.fillStyle = e.eye;
    ctx.globalAlpha = 0.83;
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

// Add missing modern neon input style (for name prompt)
if (!document.getElementById('synth-neon-input')) {
  const style = document.createElement("style");
  style.id = "synth-neon-input";
  style.innerHTML = ".neon-input:focus { outline: 2px solid #2ecffd; box-shadow: 0 0 18px #2ecffd99; }";
  document.head.appendChild(style);
}

export default App;
