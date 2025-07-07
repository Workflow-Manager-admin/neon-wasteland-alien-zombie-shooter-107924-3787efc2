import React, { useEffect, useState, useRef, useCallback } from "react";

/**
 * PUBLIC_INTERFACE
 * 
 * PortalSacrifice handles the portal animation, zombie drop effect,
 * instant coin award, floating '+X Coins', and batch state reset for the 
 * new Portal Sacrifice system.
 * 
 * Props:
 *  - zombieCount: number of zombies to sacrifice
 *  - coinValue: coins per zombie (default: 2)
 *  - coins: current coins held (for display)
 *  - onSacrificeComplete: function (coinsAwarded) called at end of sequence (awards coins)
 */
function PortalSacrifice({ zombieCount = 0, coinValue = 2, coins = 0, onSacrificeComplete }) {
  // [0,1,...n-1]
  const [dropping, setDropping] = useState([]); // indices of zombies in effect
  const [floating, setFloating] = useState(false); // controls '+X Coins'
  const [finished, setFinished] = useState(false);
  const [localCoins, setLocalCoins] = useState(coins);
  const dropTimers = useRef([]);
  const totalCoins = zombieCount * coinValue;

  // Animate zombie drop-in, staggered
  const runSacrifice = useCallback(() => {
    setDropping([]);
    setFinished(false);
    setFloating(false);
    setLocalCoins(coins);
    dropTimers.current.forEach(clearTimeout);
    dropTimers.current = [];
    // Each zombie drops in, 220ms stagger
    for (let i = 0; i < zombieCount; ++i) {
      dropTimers.current.push(
        setTimeout(() => {
          setDropping(curr => [...curr, i]);
          // Each zombie increments coins immediately
          setLocalCoins(c => c + coinValue);
        }, i * 220)
      );
    }
    // After last zombie, show floating '+X Coins'
    dropTimers.current.push(
      setTimeout(() => {
        setFloating(true);
        if (typeof onSacrificeComplete === "function") {
          onSacrificeComplete(totalCoins);
        }
        setFinished(true);
        // After message floats up, reset (parent closes PortalSacrifice)
      }, zombieCount * 220 + 280)
    );
    // Hide floating after 1.3s
    dropTimers.current.push(
      setTimeout(() => {
        setFloating(false);
      }, zombieCount * 220 + 1580)
    );
  // eslint-disable-next-line
  }, [zombieCount, coinValue, coins, onSacrificeComplete]);

  // AUTO: trigger drop-in when zombieCount > 0 and not finished
  useEffect(() => {
    if (zombieCount > 0 && !finished) runSacrifice();
    // Cleanup
    return () => dropTimers.current.forEach(clearTimeout);
  }, [zombieCount, finished, runSacrifice]);

  // Ensure +X Coins animation keyframes are present
  useEffect(() => {
    if (!document.getElementById("portal-coins-float-keyframes")) {
      const style = document.createElement("style");
      style.id = "portal-coins-float-keyframes";
      style.innerHTML = `
        @keyframes portal-float-up {
          0% { opacity: 0; transform: translateY(0) scale(1);}
          14% {opacity:1;}
          38% {transform: translateY(-12px) scale(1.14);}
          82% {opacity:1;}
          94% {transform: translateY(-42px) scale(0.98); opacity:0.99;}
          100% {transform: translateY(-56px) scale(0.67); opacity:0;}
        }
        @keyframes portal-glow-pulse {
          0%,100% { box-shadow: 0 0 66px 46px #ffef5080, 0 0 36px 0 #39ff1420, 0 0 0px #aa2c69cc inset;}
          18% { box-shadow: 0 0 120px 76px #ab62fa66, 0 0 44px 3px #e87a417a, 0 0 12px #39ff1442 inset;}
          36% { box-shadow: 0 0 87px 61px #ffef508c, 0 0 24px 8px #39ff14cc;}
          68% { box-shadow: 0 0 190px 100px #39ff149c, 0 0 24px 8px #ab2c699c;}
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Render n dropping zombies, animated, centered above portal
  const zombies = [];
  let portalCenter = { left: "50%", transform: "translateX(-50%)" };
  for (let i = 0; i < zombieCount; ++i) {
    // Use unique drop effect per revealed zombie
    zombies.push(
      <div
        className={
          "portal-zombie" +
          (dropping.includes(i) ? " dropping" : "") +
          (dropping.includes(i) && finished ? " disappear" : "")
        }
        key={i}
        style={{
          ...portalCenter,
          bottom: 130 + i * 14 + "px",
          zIndex: 20 + zombieCount - i,
          opacity: dropping.includes(i) ? 1 : 0.22,
          filter: `brightness(${1.04 + 0.07 * i})`,
          animationDelay: `${i * 0.19}s`
        }}
      >
        <div className="pz-body"></div>
        <div className="pz-head"></div>
        <div className="pz-eye pz-eye-l"></div>
        <div className="pz-eye pz-eye-r"></div>
        <div className="pz-mouth"></div>
        {/* Spark/glow effect: fire when dropping */}
        <div className={"pz-glow" + (dropping.includes(i) ? " anim" : "")}></div>
      </div>
    );
  }

  // Floating +X Coins, center above portal
  const FloatCoinGain = () =>
    floating ? (
      <div
        className="portal-floating-coins"
        style={{
          position: "absolute",
          left: "50%",
          top: "38%",
          transform: "translate(-50%, 0)",
          fontSize: "2em",
          color: "#ffef50",
          textShadow: "0 0 15px #fff944, 0 0 30px #aa2c695c, 0 1px 2px #181925",
          fontWeight: "bold",
          zIndex: 55,
          pointerEvents: "none",
          animation: "portal-float-up 1.25s cubic-bezier(.62,.09,.51,1.01)",
        }}
      >
        +{totalCoins}{" "}
        <span
          style={{
            display: "inline-block",
            width: "1.2em",
            height: "1.2em",
            background: "radial-gradient(ellipse at 60% 35%,#ffef50 90%,#aa2c69 130%)",
            boxShadow: "0 0 12px #f3f14b99",
            borderRadius: "50%",
            border: "2px solid #7d6c28",
            marginLeft: 5,
            verticalAlign: "middle",
          }}
        />
      </div>
    ) : null;

  // Glowing animated Portal SVG + both spark and neon effects
  return (
    <div
      className="portal-sacrifice-root"
      style={{
        width: "100vw",
        minHeight: 350,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div
        className="portal-sacrifice-anim-area"
        style={{
          width: "100%",
          minHeight: 280,
          height: "33vw",
          maxHeight: 320,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          position: "relative",
        }}
      >
        {/* Zombies drop-in */}
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          bottom: 0,
          zIndex: 30,
          width: "100%",
          height: "80%",
          pointerEvents: "none",
        }}>
          {zombies}
        </div>

        {/* The animated glowing portal */}
        <div
          className="portal-glow-outer"
          style={{
            ...portalCenter,
            position: "absolute",
            bottom: 36,
            zIndex: 14,
            width: 120, height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="120" height="56" viewBox="0 0 120 56">
            <ellipse
              cx="60"
              cy="28"
              rx="55"
              ry="22"
              fill="#39ff1422"
              style={{ filter: "blur(3px)" }}
            />
            <ellipse
              cx="60"
              cy="31"
              rx="50"
              ry="15"
              fill="#39ff14aa"
            />
            <ellipse
              cx="60"
              cy="28"
              rx="41"
              ry="14"
              fill="#aa2c6940"
            />
            <ellipse
              cx="60"
              cy="28"
              rx="29"
              ry="7"
              fill="#fff8196d"
              style={{ filter: "blur(1.5px)" }}
            />
          </svg>
        </div>
        <div
          className="portal-glow-animate"
          style={{
            ...portalCenter,
            position: "absolute",
            bottom: 33,
            width: 101, height: 44,
            zIndex: 13,
            borderRadius: 44,
            boxShadow: "0 0 66px 46px #ffef5080, 0 0 36px 0 #39ff1420",
            animation: "portal-glow-pulse 2.7s infinite cubic-bezier(.95,.08,.47,1.13)",
            pointerEvents: "none"
          }}
        />
        {/* Floating +X Coins */}
        <FloatCoinGain />
      </div>
      {/* Spacer for mobile */}
      <div style={{ minHeight: 40, width: '1px' }} />
    </div>
  );
}

export default PortalSacrifice;

/* --- Styles for PortalSacrifice --- */
const style = document.createElement("style");
style.innerHTML = `
.portal-sacrifice-root {
  width: 100vw;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 316px;
  position: relative;
  font-family: 'Segoe UI', 'Roboto', sans-serif;
}
.portal-sacrifice-anim-area {
  max-width: 99vw;
  width: 370px;
  min-height: 220px;
  padding: 12px 0 0 0;
  position: relative;
  background: none;
}
@media (max-width: 550px) {
  .portal-sacrifice-anim-area { width: 97vw!important; min-width: 0;}
}
.portal-glow-outer {
  left: 50%; transform: translateX(-50%);
  position: absolute;
  will-change: box-shadow, filter;
}
.portal-glow-animate {
  pointer-events:none;
}
.portal-floating-coins {
  font-size: 2.16em;
  margin-top: 18px;
  margin-bottom: 3px;
  width: 100vw;
  min-width: 0; text-align:center;
  padding: 1px 0;
  user-select: none;
  font-family: 'Segoe UI', 'Arial', sans-serif;
  pointer-events: none;
}
.portal-zombie {
  position: absolute;
  left: 50%; transform: translateX(-50%);
  width: 42px; height: 27px;
  border-radius: 10px;
  background: linear-gradient(120deg,#39ff14 57%,#6efd9a 100%);
  box-shadow: 0 0 6px #39ff14a0, 0 2px 8px #31c92744 inset;
  border: 2px solid #23243a;
  opacity: 1;
  transition: filter 0.08s, opacity 0.14s;
  animation: none;
  z-index:32;
}
.portal-zombie.dropping {
  animation: portal-zombie-drop 1.01s cubic-bezier(.36,.72,.56,1) forwards;
}
@keyframes portal-zombie-drop {
  0%   { transform: translateY(0) scale(1); opacity: 1;}
  44%  { transform: translateY(17px) scale(0.87); opacity: 0.98;}
  72%  { transform: translateY(39px) scale(0.74); opacity: 0.87;}
  90%  { transform: translateY(73px) scale(0.35,1.2); opacity: .29; filter: blur(2.6px);}
  100% { transform: translateY(120px) scale(0.1,0.7); opacity: 0; filter: blur(8px);}
}
.portal-zombie .pz-body {
  position: absolute; left: 1px; bottom: 0;
  width: 41px; height: 22px;
  border-radius: 12px;
  background: linear-gradient(90deg,#39ff14 67%,#6efd9a 93%);
  box-shadow: 0 0 6px #39ff14c3 inset;
  z-index:2;
}
.portal-zombie .pz-head {
  position: absolute;
  left: 10px; top: -10px;
  width: 20px; height: 18px;
  background: #161e13;
  border-radius: 7px 7px 12px 13px;
  box-shadow: 0 2px 8px #39ff1454 inset;
  z-index:10;
}
.portal-zombie .pz-eye {
  position:absolute; top:-4.5px;width:5.5px;height:7px;
  background:#fb73fa;
  border-radius: 50% 55% 62% 77%;
  box-shadow: 0 0 5px #aa2c6987 inset, 0 0 3px #aa2c69b8;
}
.portal-zombie .pz-eye-l {left:13px;}
.portal-zombie .pz-eye-r {left:22px;}
.portal-zombie .pz-mouth {
  position: absolute; top: 7.6px; left: 15.5px;
  width: 8px; height: 3px;
  border-bottom: 2.3px solid #aa2c69;
  border-radius: 0 0 9px 8px;
}
.portal-zombie .pz-glow {
  position: absolute;
  left: -5px; right: -5px; bottom: -8px; height: 17px;
  border-radius: 24px; pointer-events:none;
  box-shadow: 0 0 30px 12px #e87a4191, 0 0 8px #39ff14cc;
  z-index: 1; opacity: 0;
  transition: opacity 0.19s;
}
.portal-zombie.dropping .pz-glow {
  opacity: 1;
  animation: portal-zombie-spark 0.54s 0.51s cubic-bezier(.53,.51,.53,.91) 1 forwards;
}
@keyframes portal-zombie-spark {
  0% { opacity:0;}
  33% {opacity:1;}
  85% {opacity:0.85;}
  100% {opacity:0; }
}
@media (max-width: 550px) {
  .portal-sacrifice-root { width:99vw !important;}
  .portal-sacrifice-anim-area { width:97vw!important; min-width:0;}
}
`;
if (!document.getElementById("portal-sacrifice-global-style")) {
  style.id = "portal-sacrifice-global-style";
  document.head.appendChild(style);
}
