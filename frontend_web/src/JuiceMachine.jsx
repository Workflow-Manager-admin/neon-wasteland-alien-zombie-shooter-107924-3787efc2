import React, { useEffect, useState, useCallback } from "react";
import "./JuiceMachine.css";

/**
 * PUBLIC_INTERFACE
 * JuiceMachine animates the juicing of collected green zombies and handles reward payout and animation sequencing.
 * Props:
 *   - zombieCount (number): the number of zombies available to juice (must be >= 0)
 *   - coinValue (number): the number of coins awarded per zombie. (default: 2)
 *   - initialCoins (number): displayed coin count (passed by parent/HUD, NOT mutated here)
 *   - onAward (function): called as onAward(coinsAwarded) at the coin payout moment, to let parent update state
 *   - onDone (function): called at end of full sequence (after coin float/anim)
 *
 * Requirements:
 * - Only green zombies supported (remove any red/etc from visual/logic)
 * - Sequential drop animation for zombies, then plunger presses down, then bottle fills, then coins are awarded.
 * - "+X coins" float anim occurs after bottle fill, before onDone fired.
 * - Visible at all times for zombieCount > 0. Juice button enabled only if zombieCount > 0 and not already juicing.
 */
function JuiceMachine({
  zombieCount = 0,
  coinValue = 2,
  initialCoins = 0,
  onAward,
  onDone,
}) {
  // Animation state
  const [juicing, setJuicing] = useState(false);
  const [animStep, setAnimStep] = useState("idle"); // idle | drops | plunger | fill | payout | done
  const [revealZombies, setRevealZombies] = useState([]); // indices to reveal (for drop stagger)
  const [showPlunger, setShowPlunger] = useState(false);
  const [bottleJuice, setBottleJuice] = useState(0); // 0 to 1
  const [showCoinGain, setShowCoinGain] = useState(false);
  const [coinGain, setCoinGain] = useState(0);
  const [localCoins, setLocalCoins] = useState(initialCoins);

  // Sync local coins to HUD
  useEffect(() => {
    setLocalCoins(initialCoins);
  }, [initialCoins]);

  // Reset internal anim state if zombieCount changes (e.g. on overlay re-show)
  useEffect(() => {
    setAnimStep("idle");
    setJuicing(false);
    setRevealZombies([]);
    setShowPlunger(false);
    setBottleJuice(0);
    setShowCoinGain(false);
    setCoinGain(0);
  }, [zombieCount]);

  // Animation sequence controller
  const runJuiceSequence = useCallback(() => {
    if (juicing) return;
    setJuicing(true);
    // 1. Staggered drops (one per zombie, e.g. 110ms per zombie)
    setAnimStep("drops");
    let stepTimer = 0;
    let dropStagger = 115;
    if (zombieCount === 0) {
      setAnimStep("idle");
      setJuicing(false);
      return;
    }
    // Reveal zombies stack one by one
    for (let i = 0; i < zombieCount; ++i) {
      setTimeout(() => {
        setRevealZombies(revealZ => [...revealZ, i]);
      }, stepTimer + dropStagger * i);
    }
    // After drops, run plunger
    let dropsDuration = zombieCount * dropStagger + 70;
    setTimeout(() => {
      setAnimStep("plunger");
      setShowPlunger(true);
    }, dropsDuration);
    // After plunger presses, run bottle fill
    let plungerDuration = 460;
    setTimeout(() => {
      setAnimStep("fill");
      setBottleJuice(1);
      setShowPlunger(false);
    }, dropsDuration + plungerDuration);

    // After fill, float coins, award (staggered for clarity)
    let fillDuration = 830;
    setTimeout(() => {
      setAnimStep("payout");
      setCoinGain(zombieCount * coinValue);
      setShowCoinGain(true);
      setLocalCoins(c => c + zombieCount * coinValue);
      // Callback: award coins, let parent update HUD
      if (onAward) onAward(zombieCount * coinValue);
    }, dropsDuration + plungerDuration + fillDuration);

    // Delay before onDone, after coin float
    let coinFloatDuration = 1300;
    setTimeout(() => {
      setAnimStep("done");
      setShowCoinGain(false);
      setRevealZombies([]); // hide stack
      setBottleJuice(0); // reset for possible next round
      setJuicing(false);
      if (onDone) onDone();
    }, dropsDuration + plungerDuration + fillDuration + coinFloatDuration);
  }, [juicing, zombieCount, coinValue, onAward, onDone]);

  // Floating coin gain keyframes patch (inserts in head if missing)
  useEffect(() => {
    if (!document.getElementById("coin-float-up-keyframes")) {
      const style = document.createElement("style");
      style.id = "coin-float-up-keyframes";
      style.innerHTML = `
        @keyframes coin-float-up {
          0% { transform: translateY(0) scale(1); opacity: 0;}
          7% {opacity:1;}
          40% {transform: translateY(-18px) scale(1.18);}
          88% {opacity:1;}
          99% {transform: translateY(-44px) scale(0.96); opacity: 0.97;}
          100% {transform: translateY(-52px) scale(0.73); opacity: 0;}
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Button handler
  function handleJuice() {
    if (
      juicing ||
      zombieCount < 1 ||
      !Number.isFinite(zombieCount)
    )
      return;
    runJuiceSequence();
  }

  // Build zombie stack for animation
  const zombieBlocks = [];
  for (let i = 0; i < zombieCount; ++i) {
    zombieBlocks.push(
      <div
        className={
          "jm-zombie" +
          (juicing && animStep === "drops" && revealZombies.includes(i)
            ? " jm-zombie-animating"
            : "")
        }
        key={i}
        style={{
          bottom: 10 + i * 25 + "px",
          zIndex: zombieCount - i,
          left: `calc(50% - 20px)`,
          opacity:
            !juicing || revealZombies.includes(i)
              ? 1
              : 0.1,
          filter: `brightness(${0.95 + 0.05 * i})`,
          animation:
            juicing && revealZombies.includes(i)
              ? "jm-zombie-drop 1.17s cubic-bezier(.36,.72,.56,1) forwards"
              : "none"
        }}
      >
        <div className="jm-zombie-head"></div>
        <div className="jm-zombie-eye jm-zombie-eye-l"></div>
        <div className="jm-zombie-eye jm-zombie-eye-r"></div>
        <div className="jm-zombie-mouth"></div>
      </div>
    );
  }

  // Coin gain float component
  const CoinGain = () =>
    showCoinGain ? (
      <div
        key="coingain"
        style={{
          position: "absolute",
          right: -6,
          top: 12,
          fontSize: "1.25em",
          color: "#ffef50",
          textShadow:
            "0 0 8px #fff944, 0 0 18px #aa2c695c, 0 1px 2px #181925",
          fontWeight: "bold",
          zIndex: 50,
          pointerEvents: "none",
          animation: "coin-float-up 1.1s cubic-bezier(.55,.12,.48,.98)",
          transition: "opacity 0.22s"
        }}
      >
        +{coinGain}{" "}
        <span
          style={{
            display: "inline-block",
            width: "1em",
            height: "1em",
            background:
              "radial-gradient(ellipse at 60% 35%,#ffef50 90%,#aa2c69 130%)",
            boxShadow: "0 0 8px #f3f14b77",
            borderRadius: "50%",
            border: "1.5px solid #7d6c28",
            marginLeft: 4,
            verticalAlign: "middle"
          }}
        />
      </div>
    ) : null;

  // Bottle fill anim
  const juiceHeight =
    bottleJuice === 0 ? 0 : Math.min(zombieCount * 17, 86) * bottleJuice;

  // By requirements: button only enabled if zombieCount > 0 and not juicing
  const btnDisabled =
    !Number.isFinite(zombieCount) ||
    zombieCount < 1 ||
    juicing ||
    animStep !== "idle";

  return (
    <div
      className="juicemachine-root"
      style={{ position: "relative", pointerEvents: "auto" }}
    >
      <div
        className={
          "jm-machine" +
          (juicing ? " juicing" : "") +
          (showPlunger ? " jm-plunger-down" : "")
        }
        style={{
          userSelect: "none",
          pointerEvents: "auto"
        }}
      >
        {/* Plunger */}
        <div className="jm-plunger" style={showPlunger ? { top: "43px", transition: "top 0.37s cubic-bezier(.44,.06,.62,1.09)" } : {}} />
        {/* Zombie stack */}
        <div className="jm-zombie-stack">{zombieBlocks}</div>
        {/* Bottle with fill anim */}
        <div className="jm-bottle">
          <div className="jm-bottle-glow"></div>
          <div
            className="jm-juice"
            style={{
              height: `${juiceHeight}px`,
              transition: `height 0.35s cubic-bezier(.14, .76, .48, 1.07)${
                bottleJuice === 1 ? ", background 0.51s" : ""
              }`
            }}
          />
          <div className="jm-bottle-outline"></div>
        </div>
        {/* Make Zombie Juice Button */}
        <button
          className="neon-btn jm-btn"
          disabled={btnDisabled}
          onClick={handleJuice}
          aria-busy={juicing ? "true" : undefined}
          tabIndex={btnDisabled ? -1 : 0}
          style={{
            cursor: btnDisabled ? "not-allowed" : "pointer",
            pointerEvents: btnDisabled ? "none" : "auto",
            opacity: btnDisabled ? 0.66 : 1,
            filter: btnDisabled ? "grayscale(0.45)" : "none"
          }}
        >
          {juicing ? "Juicing..." : "Make Zombie Juice"}
        </button>
        {/* Coins and floating gain */}
        <div
          style={{
            marginTop: 26,
            fontSize: "1.13em",
            color: "#ffef50",
            textShadow:
              "0 0 7px #fff944, 0 0 10px #aa2c69, 0 1px 2px #181925",
            fontWeight: 700,
            minHeight: 34,
            letterSpacing: ".04em",
            position: "relative"
          }}
        >
          <span
            className="coin-icon"
            style={{
              width: 17,
              height: 17,
              display: "inline-block",
              borderRadius: "50%",
              verticalAlign: "middle",
              marginRight: 4,
              background:
                "radial-gradient(ellipse at 60% 35%,#ffef50 90%,#aa2c69 130%)",
              boxShadow: "0 0 8px #f3f14b77",
              border: "1.5px solid #7d6c28"
            }}
          />{" "}
          {localCoins}
          <CoinGain />
        </div>
      </div>
    </div>
  );
}

export default JuiceMachine;
