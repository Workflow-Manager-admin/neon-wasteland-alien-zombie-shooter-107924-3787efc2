import React, { useRef, useEffect, useState } from 'react';
import './App.css';
import JuiceMachine from './JuiceMachine.jsx';

// Neon theme variables
const THEME = {
  accent: '#aa2c69',
  primary: '#39ff14',
  secondary: '#1a1a1a',
  white: '#fff',
  canvasWidth: 800,
  canvasHeight: 600,
};

/**
 * The only zombie type: green zombie.
 * All gameplay, UI, and coin logic is now tied to this type.
 */
const zombieTypes = [
  {
    name: "green",
    color: "#6efd9a",
    shadow: "#39ff1475",
    head: "#161e13",
    eyes: "#fb73fa",
    speed: 1.2,
    w: 44,
    h: 62,
    coins: 2,
    labelColor: "#39ff14",
    label: "+2",
  }
];

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
    score: 0, coins: 0, juice: 0, level: 1, zombies: 0,
  });
  // For control state and canvas focus
  const [control, setControl] = useState({ left: false, right: false, shoot: false, jump: false });
  const [mobile, setMobile] = useState(false);

  // Overlay/juicer states. These are at top-level per React hook order rules.
  // Only used during gameState === 'complete'
  const [pendingJuicing, setPendingJuicing] = useState(false);
  const [payout, setPayout] = useState(0);

  useEffect(() => {
    if (gameState === 'complete') {
      setPendingJuicing(true);
      setPayout(0);
    }
    if (gameState !== 'complete') {
      setPendingJuicing(false);
      setPayout(0);
    }
  }, [gameState]);

  // Internal refs for main game objects
  const canvasRef = useRef();
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
      if (world.current && typeof world.current.getHUD === "function") {
        const s = world.current.getHUD();
        setHud(s);
      }
    }, () => {
      // On game over
      setGameState('over');
    }, () => {
      // On level complete
      setGameState('complete');
    });
    setGameState('running');
    setControl({ left: false, right: false, shoot: false, jump: false });
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
      if (["ArrowUp"].includes(e.key) && !e.repeat) setControl(s => ({ ...s, jump: true }));
      if ([" ", "w", "W"].includes(e.key)) setControl(s => ({ ...s, shoot: true }));
    };
    const keyup = (e) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) setControl(s => ({ ...s, left: false }));
      if (["ArrowRight", "d", "D"].includes(e.key)) setControl(s => ({ ...s, right: false }));
      if (["ArrowUp"].includes(e.key)) setControl(s => ({ ...s, jump: false }));
      if ([" ", "w", "W"].includes(e.key)) setControl(s => ({ ...s, shoot: false }));
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
    if (type === 'jump') setControl(s => ({ ...s, jump: enable }));
  };

  // Button click (shoot or jump for mobile)
  const handleButtonClick = (type) => {
    if (type === 'shoot') {
      setControl(s => ({ ...s, shoot: true }));
      setTimeout(() => setControl(s => ({ ...s, shoot: false })), 80);
    }
    if (type === 'jump') {
      setControl(s => ({ ...s, jump: true }));
      setTimeout(() => setControl(s => ({ ...s, jump: false })), 120);
    }
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
            <p>Jump: <kbd>↑</kbd> (Up Arrow)</p>
            <p>Or use the neon buttons below (mobile friendly!)</p>
          </div>
        </div>
      );
    }

    // Track all changes to hud.zombies and log, to trace out-of-sync bugs.
    // Moved hook to root of App to ensure hooks order.
    // eslint-disable-next-line
    useEffect(() => {
      console.debug("[App DEBUG] hud.zombies changed:", hud.zombies);
    }, [hud.zombies]);

    if (gameState === 'complete' && pendingJuicing) {
      // DEBUG: Log Overlay state at every render for diagnosis
      // eslint-disable-next-line
      console.debug("[Overlay/JuiceMachine] state: hud.zombies =", hud.zombies, "hud.coins =", hud.coins, "payout =", payout, "hud object:", hud, "pendingJuicing =", pendingJuicing);


      const handleJuiceAward = (coinsAwarded) => {
        // If zombie count is already zero, skip mutation for safety
        setPayout(coinsAwarded);
        setHud(hudPrev => {
          if (hudPrev.zombies === 0) {
            // eslint-disable-next-line
            console.debug("[handleJuiceAward] Avoid double-zeroing, current zombies=0");
            return { ...hudPrev, coins: hudPrev.coins + coinsAwarded };
          }
          // Explicitly set zombies count to zero so prop is correct for JuiceMachine and Overlay immediately
          return {
            ...hudPrev,
            coins: hudPrev.coins + coinsAwarded,
            zombies: 0,
          }
        });
      };
      const handleJuicingDone = () => {
        // Only clear zombies if not already cleared, to prevent race condition
        setHud(hudPrev => {
          if (hudPrev.zombies === 0) {
            // eslint-disable-next-line
            console.debug("[handleJuicingDone] zombies already zero, skip re-zero");
            return hudPrev;
          }
          return { ...hudPrev, zombies: 0 };
        });
        setTimeout(() => {
          setPendingJuicing(false);
          setPayout(0);
          startGame();
        }, 1600); // 1.6s matches animation after payout
      };

      return (
        <div className="game-overlay">
          <div className="juice-ready">JUICE READY!</div>
          <JuiceMachine
            zombieCount={hud.zombies}
            onAward={handleJuiceAward}
            initialCoins={hud.coins}
            onDone={handleJuicingDone}
          />
          <div className="big-score neon-text">Zombies Juiced: {hud.zombies}</div>
          <div className="coins neon-glow">Coins: <span>{hud.coins + payout}</span></div>
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
      </div>
    </div>
  );

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
          aria-label="Jump"
          onTouchStart={() => handleButtonClick('jump')}
          onClick={() => handleButtonClick('jump')}
        >▲</button>
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
class GameWorld {
  /**
   * GameWorld manages the main gameplay, player and enemy logic.
   * Now includes jump state: playerY, velocityY, gravity, isJumping.
   */
  constructor(theme, onHUD, onGameOver, onLevelComplete) {
    this.theme = theme;
    this.onHUD = onHUD;
    this.onGameOver = onGameOver;
    this.onLevelComplete = onLevelComplete;
    this.width = theme.canvasWidth;
    this.height = theme.canvasHeight;
    this.groundY = this.height - 120;

    this.playerGroundY = this.groundY-48;
    this.playerGravity = 1.6;
    this.playerJumpStrength = 22.5;
    this.playerVelocityY = 0;
    this.playerIsJumping = false;

    this.state = 'running';
    this.level = 1;
    this.reset();
  }

  reset() {
    this.scrollX = 0;
    this.score = 0;
    this.coins = 0;
    this.zombies = [];
    this.bullets = [];
    this.effects = [];
    this.spawnCooldown = 0;
    this.zombiesJuiced = 0;
    this.zombiesToJuice = 6 + this.level * 2;

    this.player = {
      x: 100,
      y: this.playerGroundY,
      width: 32,
      height: 56,
      speed: 6,
      dir: 1,
      alive: true,
      action: 'idle',
      shootCooldown: 0,
      velocityY: 0,
      isJumping: false,
    };
    this.playerVelocityY = 0;
    this.playerIsJumping = false;

    // spawn initial zombies (all green zombies)
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
    if (this.gameOver || this.levelComplete) return;

    // Player LEFT/RIGHT
    let dx = 0;
    if (control.left) dx -= this.player.speed;
    if (control.right) dx += this.player.speed;
    this.player.x += dx;
    this.player.dir = dx > 0 ? 1 : dx < 0 ? -1 : this.player.dir;
    if (this.player.x < 20) this.player.x = 20;
    if (this.player.x - this.scrollX > this.width * 0.4)
      this.scrollX = this.player.x - this.width * 0.4;
    if (this.scrollX < 0) this.scrollX = 0;

    // Jumping mechanics
    let onGround = (Math.abs(this.player.y - this.playerGroundY) < 1);
    if (control.jump && onGround && !this.player.isJumping) {
      this.player.velocityY = -this.playerJumpStrength;
      this.player.isJumping = true;
    }
    if (!onGround || this.player.velocityY !== 0) {
      this.player.velocityY += this.playerGravity;
      this.player.y += this.player.velocityY;
      if (this.player.y > this.playerGroundY) {
        this.player.y = this.playerGroundY;
        this.player.velocityY = 0;
        this.player.isJumping = false;
      }
    } else {
      this.player.velocityY = 0;
      this.player.isJumping = false;
      this.player.y = this.playerGroundY;
    }

    // Shooting
    if (control.shoot && this.player.shootCooldown <= 0) {
      this._shoot();
      this.player.shootCooldown = 16;
      this.effects.push({type:'muzzle', x:this.player.x+this.player.dir*30, y:this.player.y+32, t:0});
    }
    if (this.player.shootCooldown > 0) this.player.shootCooldown -= 1;

    // Bullets logic (awards coins and shows floating label, only green zombie effect now)
    this.bullets.forEach((b,i,arr) => {
      b.x += b.vx;
      // Collide with zombies
      for (let z of this.zombies) {
        if (!z.dead && z.x < b.x && b.x < z.x+z.w && z.y < b.y && b.y < z.y+z.h) {
          z.dead = true;
          z._diedAt = Date.now();
          z._killedBy = 'bullet';
          this.zombiesJuiced += 1;
          this.coins += z.coins; // always +2
          this.score += 100;
          arr[i]._hit = true;
          // Floating coin/score label (always "+2" in neon green)
          this.effects.push({
            type: 'label',
            x: z.x + z.w/2,
            y: z.y - 13,
            t: 0,
            text: "+2",
            fill: "#39ff14",
            outline: "#1a1a1a",
          });
          // Juicing visual effect
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
    this.zombies = this.zombies.filter(z => !z._falling || z.y < this.groundY+90);

    // Enemy zombies: AI walk left
    for (let z of this.zombies) {
      if (!z.dead) {
        z.x -= z.speed;
        // Respawn if out of view to right
        if (z.x < this.scrollX-140) {
          Object.assign(z, this._spawnZombie(this.scrollX + this.width + 120 + Math.random()*80));
        }
        // Collide with player
        if (!z.dead && this._collide(this.player, z)) {
          this.gameOver = true;
          this.onGameOver && this.onGameOver();
        }
      }
    }

    // Particle and effect updates: include 'label' for floating reward
    for (let e of this.effects) {
      e.t += 1;
    }
    this.effects = this.effects.filter(e =>
      (e.type==="muzzle" && e.t<12) ||
      (e.type==="juice" && e.t<30) ||
      (e.type==="ammo" && e.t<500) ||
      (e.type==="label" && e.t<33)
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
    this.onHUD && this.onHUD(this.getHUD());
  }

  // PUBLIC_INTERFACE
  draw(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // BG
    this._drawBG(ctx);

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

    // Particle/effects, including labels for coin/score (above zombie position)
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
      if (e.type === 'label') {
        ctx.save();
        ctx.font = 'bold 22px Segoe UI, Arial, sans-serif';
        let alpha = Math.max(0, 1 - e.t/32 - 0.21);
        ctx.globalAlpha = alpha;
        // Animate upward float
        let yFloat = e.y - e.t*1.5 - 26*Math.max(0.3,alpha);
        // Shadow
        ctx.lineWidth = 4;
        ctx.strokeStyle = e.outline||'#181718';
        ctx.strokeText(e.text, e.x-13, yFloat);
        // Neon-like
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "#fff3";
        ctx.strokeText(e.text, e.x-13, yFloat-1);
        // Fill
        ctx.fillStyle = e.fill;
        ctx.fillText(e.text, e.x-13, yFloat);
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

  // API: get HUD state (juice:zombies juiced; coins, etc)
  getHUD() {
    return {
      level: this.level,
      score: this.score,
      coins: this.coins,
      juice: this.zombiesJuiced,
      zombies: this.zombiesJuiced,
    };
  }

  // Player shooting
  _shoot() {
    this.bullets.push({
      x: this.player.x + this.player.dir * 32,
      y: this.player.y + 22,
      vx: this.player.dir * 20,
      vy: 0,
    });
  }

  // Spawn zombie helper: only green zombies now
  _spawnZombie(x) {
    // Only green zombies exist
    const type = zombieTypes[0];
    return {
      x,
      y: this.groundY - type.h + 8,
      w: type.w,
      h: type.h,
      speed: type.speed + Math.random() * 0.45,
      dead: false,
      _falling: false,
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

  // -- Visual helpers
  _drawBG(ctx) {
    const grd = ctx.createLinearGradient(0,0,0,this.height);
    grd.addColorStop(0, "#292940");
    grd.addColorStop(0.4, "#1a1a1a");
    grd.addColorStop(1, "#252536");
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,this.width,this.height);
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

  // PUBLIC_INTERFACE
  _drawZombie(ctx, z) {
    ctx.save();
    ctx.translate(z.x, z.y);
    // Body
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-z.w/2, 0, z.w, z.h, Math.max(8,Math.min(16,Math.round(z.w/4))));
    ctx.fillStyle = z.dead ? "#3ba04e" : z.color;
    ctx.shadowColor = z.dead ? "#37c84666" : z.shadow;
    ctx.shadowBlur = z.dead ? 3 : 17;
    ctx.globalAlpha = z.dead ? 0.65 : 1;
    ctx.fill();
    ctx.restore();

    // Head
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -10, Math.max(10, z.w/2), Math.max(7,z.w/2.7), 0, 0, Math.PI * 2);
    ctx.fillStyle = z.head;
    ctx.shadowColor = "#39ff14";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();

    // Eyes
    ctx.save();
    ctx.globalAlpha = z.dead ? 0.33 : 1;
    ctx.beginPath();
    ctx.arc(-7, -12, 3, 0, Math.PI*2);
    ctx.arc(+7, -12, 3, 0, Math.PI*2);
    ctx.fillStyle = z.eyes;
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
