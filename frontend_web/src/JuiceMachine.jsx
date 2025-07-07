import React, { useEffect, useState, useCallback, useRef } from "react";
import "./JuiceMachine.css";

/**
 * PUBLIC_INTERFACE
 * JuiceMachine animates the juicing of collected green zombies and handles reward payout and animation sequencing.
 * Props:
 *   - zombieCount (number): the number of zombies available to juice (must be >= 0)
 *   - coinValue (number): coins per zombie (default: 2)
 *   - initialCoins (number): displayed coin count (passed by parent/HUD, NOT mutated here)
 *   - onAward (function): called as onAward(coinsAwarded) at the coin payout moment, to let parent update state
 *   - onDone (function): called at end of full sequence (after coin float/anim)
 *
 * Now, the juicing sequence starts automatically as a side effect of zombieCount > 0 (and not already juicing).
 * All logic for a manual button or handler has been removed.
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

  // Ensure sequence doesn't double-trigger during zombieCount transitions
  const prevZombieCount = useRef(zombieCount);

  // Sync local coins to HUD
  useEffect(() => {
    setLocalCoins(initialCoins);
  }, [initialCoins]);

  // Reset entire animation state (gets run on every change of zombieCount)
  useEffect(() => {
    setAnimStep("idle");
    setJuicing(false);
    setRevealZombies([]);
    setShowPlunger(false);
    setBottleJuice(0);
    setShowCoinGain(false);
    setCoinGain(0);
    prevZombieCount.current = zombieCount;
  }, [zombieCount]);

  // Animation sequence controller (unchanged from manual, just always triggers auto on eligible conditions)
  const runJuiceSequence = useCallback(() => {
    if (juicing || zombieCount < 1 || !Number.isFinite(zombieCount)) return;
    setJuicing(true);
    setAnimStep("drops");
    let dropStagger = 115;
    let dropTimers = [];
    for (let i = 0; i < zombieCount; ++i) {
      dropTimers.push(
        setTimeout(() => {
          setRevealZombies(revealZ => [...revealZ, i]);
        }, dropStagger * i)
      );
    }
    let dropsDuration = zombieCount * dropStagger + 70;
    let plungerTimer = setTimeout(() => {
      setAnimStep("plunger");
      setShowPlunger(true);
    }, dropsDuration);

    let plungerDuration = 460;
    let fillTimer = setTimeout(() => {
      setAnimStep("fill");
      setBottleJuice(1);
      setShowPlunger(false);
    }, dropsDuration + plungerDuration);

    let fillDuration = 830;
    let payoutTimer = setTimeout(() => {
      setAnimStep("payout");
      setCoinGain(zombieCount * coinValue);
      setShowCoinGain(true);
      setLocalCoins(c => c + zombieCount * coinValue);
      if (onAward) onAward(zombieCount * coinValue);
    }, dropsDuration + plungerDuration + fillDuration);

    let coinFloatDuration = 1300;
    let doneTimer = setTimeout(() => {
      setAnimStep("done");
      setShowCoinGain(false);
      setRevealZombies([]); // hide stack
      setBottleJuice(0); // reset for possible next round
      setJuicing(false);
      if (onDone) onDone();
    }, dropsDuration + plungerDuration + fillDuration + coinFloatDuration);

    // Cleanup (optional): save timers for cleanup in useEffect if zombieCount resets mid-sequence.
    return () => {
      [...dropTimers, plungerTimer, fillTimer, payoutTimer, doneTimer].forEach(clearTimeout);
    };
  }, [juicing, zombieCount, coinValue, onAward, onDone]);

  // Patch keyframes for coin float up if not present
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

  // EFFECT: Whenever zombieCount > 0 and not already juicing, start the juice sequence automatically.
  useEffect(() => {
    // Sequence should start only if not running and there are zombies to juice.
    if (zombieCount > 0 && !juicing) {
      runJuiceSequence();
    }
    // If zombieCount resets, cleanup possible running timers (handled above).
    // eslint-disable-next-line
  }, [zombieCount, juicing, runJuiceSequence]);

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

  // Coin gain float
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
        {/* Coin counter and floating gain */}
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
