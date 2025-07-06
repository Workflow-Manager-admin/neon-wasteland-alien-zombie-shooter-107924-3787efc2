import React, { useRef, useEffect } from "react";
import "./JuiceMachine.css";

/**
 * PUBLIC_INTERFACE
 * JuiceMachine animates the juicing of collected zombies. 
 * Props:
 *   - zombieCount: number of zombies to juice (stacked visually)
 *   - onDone: function called after animation completes (1.6s)
 */
function JuiceMachine({ zombieCount, onDone }) {
  const wrapperRef = useRef(null);

  // Run animation and call onDone after 1.6s when button pressed
  const handleJuice = () => {
    if (!wrapperRef.current.classList.contains("juicing")) {
      wrapperRef.current.classList.add("juicing");
      setTimeout(() => {
        wrapperRef.current.classList.remove("juicing");
        onDone && onDone();
      }, 1600);
    }
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

  return (
    <div className="juicemachine-root">
      <div ref={wrapperRef} className="jm-machine">
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
        {/* Button */}
        <button
          className="neon-btn jm-btn"
          onClick={handleJuice}
          disabled={zombieCount === 0}
        >
          Make Zombie Juice
        </button>
      </div>
    </div>
  );
}

export default JuiceMachine;
