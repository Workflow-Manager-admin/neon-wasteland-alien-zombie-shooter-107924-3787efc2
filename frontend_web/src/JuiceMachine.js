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
  // Animation state for juicing
  const [juicing, setJuicing] = useState(false);

  // Coins animation state for floating "+X"
  const [showCoinGain, setShowCoinGain] = useState(false);
  const [coinGain, setCoinGain] = useState(0);

  // Coin display (always synced to parent prop, but float anim is local)
  const [localCoins, setLocalCoins] = useState(initialCoins || 0);

  // If parent coin value changes, sync display accordingly
  useEffect(() => {
    setLocalCoins(initialCoins || 0);
  }, [initialCoins]);

  // Button click triggers juicing animation and coin gain
  const handleJuice = () => {
    if (juicing || zombieCount === 0) return;
    setJuicing(true);
    // Animation: After 1.6s, award coins, reset zombies, show next step
    setTimeout(() => {
      // Award coins (2 per zombie as per requirements)
      const coinsEarned = zombieCount * 2;
      setShowCoinGain(false); // Reset in case
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
  };

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

  // Add CSS for floating coins animation
  useEffect(() => {
    // Only add once
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

  return (
    <div className="juicemachine-root" style={{ position: "relative" }}>
      <div className={"jm-machine" + (juicing ? " juicing" : "")} style={{ userSelect: "none" }}>
        {/* Plunger */}
        <div className="jm-plunger"></div>
        {/* Zombies stack */}
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
          onClick={handleJuice}
          disabled={zombieCount === 0 || juicing}
          aria-busy={juicing}
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
          {/* Floating "+X coins" */}
          <CoinGain />
        </div>
      </div>
    </div>
  );
}

export default JuiceMachine;
