import React, { useRef, useEffect, useState } from "react";
import "./JuiceMachine.css";

/**
 * PUBLIC_INTERFACE
 * JuiceMachine animates the juicing of collected zombies and controls reward flow.
 * Props:
 *   - zombieCount: number of zombies to juice (both for stack visual and reward math)
 *   - onAward: function(coinsEarned) called after animation completes and coins are awarded (used to update coin state externally)
 *   - onDone: function called after reward is done and overlay may advance (optional)
 *   - initialCoins: current coin count to show in HUD-style overlay, always kept in sync by parent
 */
function JuiceMachine({ zombieCount, onAward, initialCoins, onDone }) {
  // DEBUG: log prop at every mount/update
  useEffect(() => {
    // eslint-disable-next-line
    console.debug("[JuiceMachine] zombieCount prop =", zombieCount, "initialCoins =", initialCoins);
  }, [zombieCount, initialCoins]);
  // Extra debug: log on every render of the component
  useEffect(() => {
    // eslint-disable-next-line
    console.debug("[JuiceMachine] Render: zombieCount =", zombieCount, "juicing =", juicing);
  });

  // Animation state for juicing
  const [juicing, setJuicing] = useState(false);

  // Coins animation state for floating "+X"
  const [showCoinGain, setShowCoinGain] = useState(false);
  const [coinGain, setCoinGain] = useState(0);

  // Coin display (always synced to parent prop, but float anim is local)
  const [localCoins, setLocalCoins] = useState(initialCoins || 0);

  // Sync localCoins with any HUD updates
  useEffect(() => {
    setLocalCoins(initialCoins || 0);
  }, [initialCoins]);

  // PUBLIC_INTERFACE
  function handleJuice(e) {
    // Prevent double-juicing or juicing when nothing to juice
    if (juicing || zombieCount === 0) return;
    setJuicing(true);
    // Animation: After 1.6s, award coins, reset zombies, show next step
    setTimeout(() => {
      // Award coins (2 per zombie as per requirements)
      const coinsEarned = zombieCount * 2;
      setShowCoinGain(false); // Reset just in case
      setTimeout(() => {
        setCoinGain(coinsEarned);
        setShowCoinGain(true);
        setTimeout(() => setShowCoinGain(false), 1300);
      }, 90);
      setLocalCoins(c => c + coinsEarned);
      if (onAward) onAward(coinsEarned); // let parent update HUD/global state
      setJuicing(false);
      if (onDone) {
        setTimeout(onDone, 1050); // show "+X coins" anim, then proceed
      }
    }, 1600);
  }

  // Build zombie stack
  const zombieBlocks = [];
  for (let i = zombieCount - 1; i >= 0; --i) {
    zombieBlocks.push(
      <div
        className="jm-zombie"
        key={i}
        style={{
          bottom: 10 + i * 25 + "px",
          zIndex: zombieCount - i,
          left: `calc(50% - 20px)`,
          filter: `brightness(${0.95 + 0.05 * i})`
        }}
      >
        <div className="jm-zombie-head"></div>
        <div className="jm-zombie-eye jm-zombie-eye-l"></div>
        <div className="jm-zombie-eye jm-zombie-eye-r"></div>
        <div className="jm-zombie-mouth"></div>
      </div>
    );
  }

  // Floating coin gain animation
  const CoinGain = () => (
    showCoinGain ? (
      <div key="coingain" style={{
        position: "absolute",
        right: -6,
        top: 12,
        fontSize: "1.25em",
        color: "#ffef50",
        textShadow: "0 0 8px #fff944, 0 0 18px #aa2c695c, 0 1px 2px #181925",
        fontWeight: "bold",
        zIndex: 50,
        pointerEvents: "none",
        animation: "coin-float-up 1.1s cubic-bezier(.55,.12,.48,.98)",
        transition: "opacity 0.22s",
      }}>
        +{coinGain} <span style={{
          display: "inline-block",
          width: "1em",
          height: "1em",
          background: "radial-gradient(ellipse at 60% 35%,#ffef50 90%,#aa2c69 130%)",
          boxShadow: "0 0 8px #f3f14b77",
          borderRadius: "50%",
          border: "1.5px solid #7d6c28",
          marginLeft: 4,
          verticalAlign: "middle"
        }} />
      </div>
    ) : null
  );

  // Keyframes once-only patch (for coin float)
  useEffect(() => {
    if (!document.getElementById("coin-float-up-keyframes")) {
      const style = document.createElement("style");
      style.id = "coin-float-up-keyframes";
      style.innerHTML = `
        @keyframes coin-float-up {
          0% { transform: translateY(0) scale(1); opacity: 0;}
          7% {opacity:1;}
          40% {transform: translateY(-18px) scale(1.16);}
          88% {opacity:1;}
          99% {transform: translateY(-44px) scale(0.96); opacity: 0.97;}
          100% {transform: translateY(-52px) scale(0.73); opacity: 0;}
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // By requirements: Do NOT set pointer-events: none on .jm-btn unless disabled.
  // onClick should always be present; HTML disables event when 'disabled' attribute is set.

  return (
    <div className="juicemachine-root" style={{ position: "relative", pointerEvents: "auto" }}>
      <div
        className={"jm-machine" + (juicing ? " juicing" : "")}
        style={{
          userSelect: "none",
          pointerEvents: "auto"
        }}>
        {/* Plunger */}
        <div className="jm-plunger"></div>
        {/* Zombie stack */}
        <div className="jm-zombie-stack">{zombieBlocks}</div>
        {/* Bottle container */}
        <div className="jm-bottle">
          <div className="jm-bottle-glow"></div>
          <div
            className="jm-juice"
            style={{
              height: zombieCount === 0 ? 0 : Math.min(zombieCount * 17, 86)
            }}
          ></div>
          <div className="jm-bottle-outline"></div>
        </div>
        {/* Make Zombie Juice Button */}
        <button
          className="neon-btn jm-btn"
          // Explicitly only disabled when zombieCount is not a safe natural number, zero, or currently juicing
          disabled={
            typeof zombieCount !== "number" ||
            zombieCount < 1 ||
            !Number.isFinite(zombieCount) ||
            juicing
          }
          onClick={
            typeof zombieCount !== "number" ||
            zombieCount < 1 ||
            !Number.isFinite(zombieCount) ||
            juicing
              ? undefined
              : handleJuice
          }
          aria-busy={juicing ? "true" : undefined}
          tabIndex={
            typeof zombieCount !== "number" ||
            zombieCount < 1 ||
            !Number.isFinite(zombieCount) ||
            juicing
              ? -1
              : 0
          }
          style={{
            // Force pointer because our CSS disables pointer-events only when disabled
            cursor:
              typeof zombieCount !== "number" ||
              zombieCount < 1 ||
              !Number.isFinite(zombieCount) ||
              juicing
                ? "not-allowed"
                : "pointer",
            pointerEvents:
              typeof zombieCount !== "number" ||
              zombieCount < 1 ||
              !Number.isFinite(zombieCount) ||
              juicing
                ? "none"
                : "auto",
            opacity:
              typeof zombieCount !== "number" ||
              zombieCount < 1 ||
              !Number.isFinite(zombieCount) ||
              juicing
                ? 0.66
                : 1,
            filter:
              typeof zombieCount !== "number" ||
              zombieCount < 1 ||
              !Number.isFinite(zombieCount) ||
              juicing
                ? "grayscale(0.45)"
                : "none"
          }}
        >
          {juicing ? "Juicing..." : "Make Zombie Juice"}
        </button>
        {/* Coins and floating gain */}
        <div style={{
          marginTop: 26,
          fontSize: "1.13em",
          color: "#ffef50",
          textShadow: "0 0 7px #fff944, 0 0 10px #aa2c69, 0 1px 2px #181925",
          fontWeight: 700,
          minHeight: 34,
          letterSpacing: ".04em",
          position: "relative",
        }}>
          <span className="coin-icon" style={{
            width: 17, height: 17, display: "inline-block",
            borderRadius: "50%", verticalAlign: "middle", marginRight: 4,
            background: "radial-gradient(ellipse at 60% 35%,#ffef50 90%,#aa2c69 130%)",
            boxShadow: "0 0 8px #f3f14b77", border: "1.5px solid #7d6c28"
          }} />
          {localCoins}
          <CoinGain />
        </div>
      </div>
    </div>
  );
}

export default JuiceMachine;
