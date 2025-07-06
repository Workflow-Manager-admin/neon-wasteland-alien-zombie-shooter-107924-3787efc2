import React, { useRef, useEffect, useState } from 'react';
import './App.css';

// Neon theme variables
const THEME = {
  accent: '#aa2c69',
  primary: '#39ff14',
  secondary: '#1a1a1a',
  white: '#fff',
  canvasWidth: 800,
  canvasHeight: 600,
};

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
  // Game state hooks
  const [gameState, setGameState] = useState('menu'); // menu | running | paused | over | complete
  const [hud, setHud] = useState({
    score: 0, coins: 0, juice: 0, ammo: 6, level: 1, zombies: 0,
  });
  // For control state and canvas focus
  const [control, setControl] = useState({ left: false, right: false, shoot: false });
  const [mobile, setMobile] = useState(false);

  // Internal refs for main game objects
  const canvasRef = useRef();
  const requestRef = useRef();
  const world = useRef(null);

  // Detect mobile
  useEffect(() => {
    setMobile(window.innerWidth < 900);
    const onResize = () => setMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Start or reset the game
  const startGame = () => {
    world.current = new GameWorld(THEME, () => {
      // On HUD update: called from world
      const s = world.current.getHUD();
      setHud(s);
    }, () => {
      // On game over
      setGameState('over');
    }, () => {
      // On level complete
      setGameState('complete');
    });
    setGameState('running');
    setControl({ left: false, right: false, shoot: false });
  };

  // Game loop
  useAnimationFrame((ts) => {
    if (gameState === 'running' && canvasRef.current && world.current) {
      world.current.update(control);
      world.current.draw(canvasRef.current);
    }
  }, gameState === 'running');

  // Controls: keyboard
  useEffect(() => {
    const keydown = (e) => {
      if (gameState !== 'running') return;
      if (["ArrowLeft", "a", "A"].includes(e.key)) setControl(s => ({ ...s, left: true }));
      if (["ArrowRight", "d", "D"].includes(e.key)) setControl(s => ({ ...s, right: true }));
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) setControl(s => ({ ...s, shoot: true }));
    };
    const keyup = (e) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) setControl(s => ({ ...s, left: false }));
      if (["ArrowRight", "d", "D"].includes(e.key)) setControl(s => ({ ...s, right: false }));
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) setControl(s => ({ ...s, shoot: false }));
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
    };
  }, [gameState]);

  // Mobile: onscreen control handler
  const handleTouch = (type, enable) => {
    if (type === 'left') setControl(s => ({ ...s, left: enable }));
    if (type === 'right') setControl(s => ({ ...s, right: enable }));
    if (type === 'shoot') setControl(s => ({ ...s, shoot: enable }));
  };

  // Button click (shoot single tap for mobile)
  const handleButtonClick = (type) => {
    if (type === 'shoot') setControl(s => ({ ...s, shoot: true }));
    setTimeout(() => setControl(s => ({ ...s, shoot: false })), 80);
  };

  // Render overlay screens
  const Overlay = () => {
    if (gameState === 'menu') {
      return (
        <div className="game-overlay">
          <h1 className="neon-title">NEON WASTELAND <span className="accent-text">ZOMBIE SHOOTER</span></h1>
          <p className="subtitle neon-text">Side-scroll, juice, and survive the apocalypse!</p>
          <button className="neon-btn" onClick={startGame} autoFocus>Start Game</button>
          <div className="howto-container">
            <p>Move: <kbd>←</kbd> / <kbd>→</kbd> or <kbd>A</kbd>/<kbd>D</kbd></p>
            <p>Shoot: <kbd>Space</kbd> or <kbd>W</kbd>/<kbd>↑</kbd></p>
            <p>Or use the neon buttons below (mobile friendly!)</p>
          </div>
        </div>
      );
    }
    if (gameState === 'complete') {
      return (
        <div className="game-overlay">
          <div className="juice-ready">JUICE READY!</div>
          <div className="big-score neon-text">Zombies Juiced: {hud.zombies}</div>
          <div className="coins neon-glow">Coins: <span>{hud.coins}</span></div>
          <button className="neon-btn" onClick={startGame}>Next Level</button>
        </div>
      );
    }
    if (gameState === 'over') {
      return (
        <div className="game-overlay">
          <div className="game-over-title neon-text">GAME OVER</div>
          <div className="big-score neon-text">Score: {hud.score}</div>
          <div className="coins neon-glow">Coins: <span>{hud.coins}</span></div>
          <button className="neon-btn" onClick={startGame}>Restart</button>
        </div>
      );
    }
    return null;
  };

  // HUD component
  const HUD = () => (
    <div className="hud-container">
      <div className="hud-left">
        <div className="hud-label"><span className="zombie-icon"/> x {hud.zombies} / {world.current?.zombiesToJuice ?? 6} </div>
        <JuiceMeter juice={hud.juice} max={world.current?.zombiesToJuice ?? 6} accent={THEME.primary} />
      </div>
      <div className="hud-center">
        <div className="hud-title">LEVEL {hud.level}</div>
      </div>
      <div className="hud-right">
        <div className="hud-label coins"><span className="coin-icon"/> {hud.coins}</div>
        <div className="hud-label ammo"><span className="ammo-icon"/> {hud.ammo}</div>
      </div>
    </div>
  );

  // Neon Juice Meter
  function JuiceMeter({juice, max, accent}) {
    const pct = Math.min(juice / Math.max(max, 1), 1);
    return (
      <div className="juice-meter-bg">
        <div className="juice-meter-fill" style={{
          width: `${Math.round(pct * 100)}%`,
          boxShadow: `0 0 10px 2px ${accent}, 0 0 32px 8px ${accent}55`
        }}/>
        <div className="juice-meter-frame"/>
      </div>
    );
  }

  // Neon control buttons (mobile or always visible at bottom)
  function NeonControls() {
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
      <footer className="footer-note">2024 &copy; Neon Wasteland Alien Zombie Shooter</footer>
    </div>
  );
}

// -- GAME CODE BELOW (pure JS/HTML/CSS shapes)
// World, player, zombies, projectiles, and logic
class GameWorld {
  constructor(theme, onHUD, onGameOver, onLevelComplete) {
    this.theme = theme;
    this.onHUD = onHUD;
    this.onGameOver = onGameOver;
    this.onLevelComplete = onLevelComplete;
    // --- Game parameters
    this.width = theme.canvasWidth;
    this.height = theme.canvasHeight;
    this.groundY = this.height - 120;
    this.state = 'running';
    this.level = 1;
    this.reset();
  }

  reset() {
    this.scrollX = 0;
    this.score = 0;
    this.coins = 0;
    this.ammo = 6;
    this.zombies = [];
    this.bullets = [];
    this.effects = [];
    this.spawnCooldown = 0;
    this.zombiesJuiced = 0;
    this.zombiesToJuice = 6 + this.level * 2;
    this.player = {
      x: 100,
      y: this.groundY-48, vy: 0,
      dir: 1,
      width: 32,
      height: 56,
      speed: 6,
      alive: true,
      action: 'idle',
      shootCooldown: 0
    };
    // place some zombies to start
    for (let i = 0; i < this.zombiesToJuice; ++i) {
      this.zombies.push(this._spawnZombie(400+i*90+Math.random()*90));
    }
    this.gameOver = false;
    this.levelComplete = false;
    this.uiJuiceFlash = false;
    this.onHUD && this.onHUD(this.getHUD());
  }

  // PUBLIC_INTERFACE
  update(control) {
    // Only run when playing
    if (this.gameOver || this.levelComplete) return;

    // Player LEFT/RIGHT
    let dx = 0;
    if (control.left) dx -= this.player.speed;
    if (control.right) dx += this.player.speed;
    this.player.x += dx;
    this.player.dir = dx > 0 ? 1 : dx < 0 ? -1 : this.player.dir;
    // Clamp world: infinite right-scroll but not left
    if (this.player.x < 20) this.player.x = 20;
    // Scroll view if player goes >40% from left
    if (this.player.x - this.scrollX > this.width * 0.4)
      this.scrollX = this.player.x - this.width * 0.4;
    if (this.scrollX < 0) this.scrollX = 0;

    // Shooting
    if (control.shoot && this.player.shootCooldown <= 0 && this.ammo > 0) {
      this._shoot();
      this.ammo -= 1;
      this.player.shootCooldown = 16; // frames delay
      this.effects.push({type:'muzzle', x:this.player.x+this.player.dir*30, y:this.player.y+32, t:0});
    }
    if (this.player.shootCooldown > 0) this.player.shootCooldown -= 1;

    // Bullets flying
    this.bullets.forEach((b,i,arr) => {
      b.x += b.vx;
      // Collide with zombies
      for (let z of this.zombies) {
        if (!z.dead && z.x < b.x && b.x < z.x+z.w && z.y < b.y && b.y < z.y+z.h) {
          z.dead = true;  // Mark as dead
          this.zombiesJuiced += 1;
          this.coins += Math.floor(2+Math.random()*4);
          this.score += 100;
          arr[i]._hit = true;
          this.effects.push({type:'juice', x:z.x+z.w/2, y:z.y+z.h/2, t:0});
        }
      }
    });
    this.bullets = this.bullets.filter(b => b.x>this.scrollX-60 && b.x<this.scrollX+this.width+60 && !b._hit);

    // Remove dead zombies, staggered fall
    for (let z of this.zombies) {
      if (z.dead && !z._falling) {
        z._falling = true;
        z._vy = 2+Math.random()*3;
      }
      if (z._falling) {
        z.y += z._vy;
        z._vy += 0.5;
      }
    }
    // Remove offscreen/fully fallen zombies
    this.zombies = this.zombies.filter(z => !z._falling || z.y < this.groundY+90);

    // Enemy zombies: AI walk left
    for (let z of this.zombies) {
      if (!z.dead) {
        z.x -= z.speed;
        // Respawn if out of view to right
        if (z.x < this.scrollX-120) {
          Object.assign(z, this._spawnZombie(this.scrollX + this.width + 120 + Math.random()*80));
        }
        // Collide with player
        if (!z.dead && this._collide(this.player, z)) {
          this.gameOver = true;
          this.onGameOver && this.onGameOver();
        }
      }
    }

    // Ammo pickup
    if (this.ammo <= 0 && this.effects.find(e => e.type==='ammo') == null) {
      this.effects.push({type:'ammo',x:this.player.x+80, y:this.groundY-64, t:0});
    }

    // Collect ammo
    for (let i=this.effects.length-1; i>=0; --i) {
      let e = this.effects[i];
      if (e.type === 'ammo') {
        if (Math.abs(this.player.x - e.x) < 32 && Math.abs(this.player.y - e.y) < 48) {
          this.ammo = 6;
          this.effects.splice(i,1);
        }
        e.t += 1;
        if (e.t > 500) this.effects.splice(i,1); // despawn
      }
    }

    // Particle effects update
    for (let e of this.effects) {
      e.t += 1;
    }
    this.effects = this.effects.filter(e =>
      (e.type==="muzzle" && e.t<12) ||
      (e.type==="juice" && e.t<30) ||
      (e.type==="ammo" && e.t<500)
    );

    // Level complete state
    if (this.zombiesJuiced >= this.zombiesToJuice) {
      this.levelComplete = true;
      setTimeout(() => {
        this.level += 1;
        this.reset();
        this.onLevelComplete && this.onLevelComplete();
      }, 2200);
    }
    // HUD update
    this.onHUD && this.onHUD(this.getHUD());
  }

  // PUBLIC_INTERFACE
  draw(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // BG
    this._drawBG(ctx);

    // Scroll transform
    ctx.save();
    ctx.translate(-this.scrollX,0);

    // Ground
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this.groundY, 5000, 120);
    var grd = ctx.createLinearGradient(0, this.groundY, 0, this.groundY+120);
    grd.addColorStop(0, "#202026");
    grd.addColorStop(0.5, "#1a1a1a");
    grd.addColorStop(1, "#1e2323");
    ctx.fillStyle = grd;
    ctx.shadowColor = "#39ff148c";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();

    // Neon toxic glow layers, animated
    let toxicNoise = Math.sin(Date.now()/470)*9;
    for (let s=1; s<=2; ++s) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.scrollX+this.width/1.9, this.groundY+70+toxicNoise*s, 400+70*s, Math.PI, Math.PI*2, false);
      ctx.lineWidth = 2+s;
      ctx.strokeStyle = s%2===0? "#39ff142d":"#39ff1477";
      ctx.shadowColor = "#39ff14aa";
      ctx.shadowBlur = 24+s*4;
      ctx.stroke();
      ctx.restore();
    }

    // --- Draw zombies
    for (let z of this.zombies) {
      this._drawZombie(ctx, z);
    }

    // Draw player (on top of zombies)
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

    // Particle/effects
    for (let e of this.effects) {
      if (e.type === 'muzzle') {
        ctx.save();
        ctx.globalAlpha = 1-e.t/16;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 16-e.t, 0, Math.PI*2);
        ctx.fillStyle = "#fff2";
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      }
      if (e.type === 'juice') {
        ctx.save();
        ctx.globalAlpha = 1-e.t/28;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 22+e.t*2, 0, Math.PI*2);
        ctx.fillStyle = this.theme.primary;
        ctx.shadowColor = "#39ff14cc";
        ctx.shadowBlur = 35;
        ctx.fill();
        ctx.restore();
      }
      if (e.type === 'ammo') {
        ctx.save();
        ctx.globalAlpha = Math.abs(Math.sin(e.t/10));
        ctx.beginPath();
        ctx.rect(e.x-12, e.y-18, 24, 36);
        ctx.fillStyle = "#FFF";
        ctx.shadowColor = "#aa2c69";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
        // Shell highlight
        ctx.save();
        ctx.beginPath();
        ctx.rect(e.x-7, e.y-12, 14, 24);
        ctx.fillStyle = this.theme.accent;
        ctx.globalAlpha = 0.7;
        ctx.shadowColor = this.theme.primary;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // API: get HUD state
  getHUD() {
    return {
      level: this.level,
      score: this.score,
      coins: this.coins,
      juice: this.zombiesJuiced,
      ammo: this.ammo,
      zombies: this.zombiesJuiced,
    };
  }

  // -- Internal game logic
  _shoot() {
    // Player shoots
    this.bullets.push({
      x: this.player.x + this.player.dir * 32,
      y: this.player.y + 22,
      vx: this.player.dir * 20,
      vy: 0,
    });
  }

  _spawnZombie(x) {
    return {
      x,
      y: this.groundY-44,
      w: 38 + Math.random()*12,
      h: 56,
      speed: 1.7 + Math.random()*1.2,
      dead: false,
      _falling: false
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

  // -- Visual helpers
  _drawBG(ctx) {
    // Neon gradient bg
    const grd = ctx.createLinearGradient(0,0,0,this.height);
    grd.addColorStop(0, "#292940");
    grd.addColorStop(0.4, "#1a1a1a");
    grd.addColorStop(1, "#252536");
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,this.width,this.height);
    // Neon light haze
    ctx.save();
    ctx.globalAlpha = 0.59;
    ctx.beginPath();
    ctx.arc(this.width/2, 200+Math.sin(Date.now()/1000)*18, 340, 0, Math.PI*2);
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
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-16, 0, 32, 50, 12);
    ctx.fillStyle = "#1e1e22";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.restore();
    // Alien head
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -15, 16, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1e1f2f";
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    // Alien eyes
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
    // Blaster (gun)
    ctx.save();
    ctx.rotate(p.dir === 1 ? 0.08 : -0.12);
    ctx.beginPath();
    ctx.rect(p.dir === 1 ? 15 : -41,13, 26, 8);
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
    ctx.moveTo(0,12); ctx.lineTo(p.dir*16,28);
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
    // Body
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-z.w/2, 0, z.w, z.h, 10);
    ctx.fillStyle = z.dead ? "#3ba04e" : "#6efd9a";
    ctx.shadowColor = z.dead ? "#37c84666" : "#39ff1475";
    ctx.shadowBlur = z.dead ? 2 : 16;
    ctx.globalAlpha = z.dead ? 0.65 : 1;
    ctx.fill();
    ctx.restore();
    // Head
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -10, 17, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#161e13";
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.restore();
    // Eyes
    ctx.save();
    ctx.globalAlpha = z.dead ? 0.4 : 1;
    ctx.beginPath();
    ctx.arc(-7, -12, 3, 0, Math.PI*2);
    ctx.arc(+7, -12, 3, 0, Math.PI*2);
    ctx.fillStyle = "#fb73fa";
    ctx.shadowColor = "#aa2c69";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    // Mouth
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
