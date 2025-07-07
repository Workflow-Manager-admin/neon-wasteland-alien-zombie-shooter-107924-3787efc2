import React, { useEffect, useState, useRef, useCallback } from "react";

// PUBLIC_INTERFACE
// PortalSacrifice: Animated portal overlay for zombie/coin payout sequence
// Props: zombieCount, coinValue, coins, onSacrificeDrop, onSacrificeComplete
function PortalSacrifice({
  zombieCount = 0,
  coinValue = 2,
  coins = 0,
  onSacrificeComplete,
  onSacrificeDrop,
}) {
  // Live animation state
  const [dropping, setDropping] = useState([]); // indices of zombies animating
  const [floating, setFloating] = useState(false);
  const [finished, setFinished] = useState(false);
  const [localCoins, setLocalCoins] = useState(coins);
  const dropTimers = useRef([]);
  const totalCoins = zombieCount * coinValue;

  // Staggered animation of zombie drop
  const runSacrifice = useCallback(() => {
    setDropping([]);
    setFinished(false);
    setFloating(false);
    setLocalCoins(coins);
    dropTimers.current.forEach(clearTimeout);
    dropTimers.current = [];
    for (let i = 0; i < zombieCount; ++i) {
      dropTimers.current.push(setTimeout(() => {
        setDropping(curr => [...curr, i]);
        if (typeof onSacrificeDrop === "function") onSacrificeDrop(i + 1);
        setLocalCoins(c => c + coinValue);
      }, i * 200));
    }
    dropTimers.current.push(setTimeout(() => {
      setFloating(true);
      setFinished(true);
      if (typeof onSacrificeComplete === "function") onSacrificeComplete(totalCoins);
    }, zombieCount * 200 + 220));
    // Hide floating after
    dropTimers.current.push(setTimeout(() => { setFloating(false); }, zombieCount * 200 + 1200));
  // eslint-disable-next-line
  }, [zombieCount, coinValue, coins, onSacrificeComplete, onSacrificeDrop]);

  useEffect(() => {
    if (zombieCount > 0 && !finished) runSacrifice();
    return () => dropTimers.current.forEach(clearTimeout);
  }, [zombieCount, finished, runSacrifice]);

  // Keyframes (prevent duplicates)
  useEffect(() => {
    if (!document.getElementById("portal-sacrifice-frames")) {
      const style = document.createElement("style");
      style.id = "portal-sacrifice-frames";
      style.innerHTML = `
        @keyframes portal-float-up {
          0% { opacity: 0; transform: translateY(0) scale(1);}
          15% {opacity:1;}
          38% {transform: translateY(-12px) scale(1.14);}
          90% {transform: translateY(-42px) scale(0.98); opacity: 1;}
          100% {transform: translateY(-56px) scale(0.67); opacity:0;}
        }
        @keyframes portal-glow-pulse {
          0%,100% { box-shadow: 0 0 66px 46px #ffef5080, 0 0 36px 0 #39ff1420, 0 0 0px #aa2c69cc inset;}
          18% { box-shadow: 0 0 120px 76px #ab62fa66, 0 0 44px 3px #e87a417a, 0 0 12px #39ff1442 inset;}
          68% { box-shadow: 0 0 190px 100px #39ff149c, 0 0 24px 8px #ab2c699c;}
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  // Drop-in animated zombies
  const zombies = [];
  for (let i = 0; i < zombieCount; ++i) {
    zombies.push(
      <div
        className={
          "portal-zombie" +
          (dropping.includes(i) ? " dropping" : "") +
          (dropping.includes(i) && finished ? " disappear" : "")
        }
        key={i}
        style={{
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 130 + i * 13 + "px",
          zIndex: 20 + zombieCount - i,
          opacity: dropping.includes(i) ? 1 : 0.23,
          filter: `brightness(${1.04 + 0.07 * i})`,
          animationDelay: `${i * 0.18}s`
        }}
        aria-label="Zombie entering portal"
      >
        <div className="pz-body"></div>
        <div className="pz-head"></div>
        <div className="pz-eye pz-eye-l"></div>
        <div className="pz-eye pz-eye-r"></div>
        <div className="pz-mouth"></div>
        <div className={"pz-glow" + (dropping.includes(i) ? " anim" : "")}></div>
      </div>
    );
  }

  // Floating coins animation
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
          animation: "portal-float-up 1.24s cubic-bezier(.62,.09,.51,1.01)",
        }}
        aria-label={`Gained ${totalCoins} coins`}
      >
        +{totalCoins}
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

  return (
    <div
      className="portal-sacrifice-root"
      style={{
        width: "100vw",
        minHeight: 340,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
      aria-label="Portal Sacrifice Animation Overlay"
    >
      <div
        className="portal-sacrifice-anim-area"
        style={{
          width: "100%",
          minHeight: 220,
          height: "33vw",
          maxHeight: 320,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          position: "relative",
        }}
      >
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
        <div
          className="portal-glow-outer"
          style={{
            left: "50%",
            transform: "translateX(-50%)",
            position: "absolute",
            bottom: 36,
            zIndex: 14,
            width: 120, height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            willChange: "box-shadow, filter"
          }}
        >
          <svg width="120" height="56" viewBox="0 0 120 56" aria-hidden="true">
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
            left: "50%",
            transform: "translateX(-50%)",
            position: "absolute",
            bottom: 33,
            width: 101, height: 44,
            zIndex: 13,
            borderRadius: 44,
            boxShadow: "0 0 66px 46px #ffef5080, 0 0 36px 0 #39ff1420",
            animation: "portal-glow-pulse 2.7s infinite cubic-bezier(.95,.08,.47,1.13)",
            pointerEvents: "none"
          }}
          aria-hidden="true"
        />
        {/* Floating coins */}
        <FloatCoinGain />
      </div>
      {/* Spacer for mobile */}
      <div style={{ minHeight: 40, width: "1px" }} />
    </div>
  );
}

export default PortalSacrifice;
