import React, { useEffect, useState } from "react";

function PortalSacrifice({ zombieCount, onSacrificeComplete }) {
  const [activeZombies, setActiveZombies] = useState([]);
  const [sacrificing, setSacrificing] = useState(false);
  const [containerZombies, setContainerZombies] = useState([]);

  useEffect(() => {
    if (zombieCount > 0) {
      setActiveZombies(Array.from({ length: zombieCount }, (_, i) => i));
      setSacrificing(true);
    }
  }, [zombieCount]);

  useEffect(() => {
    if (sacrificing && activeZombies.length > 0) {
      const interval = setInterval(() => {
        setActiveZombies((prev) => {
          const next = [...prev];
          const removed = next.shift(); // remove one zombie
          if (removed !== undefined) {
            setContainerZombies((z) => [...z, removed]);
          }
          if (next.length === 0) {
            clearInterval(interval);
            // Wait a bit before triggering completion
            setTimeout(() => {
              const coinsEarned = zombieCount * 2;
              onSacrificeComplete(coinsEarned, zombieCount);
              setContainerZombies([]);
              setSacrificing(false);
            }, 1000);
          }
          return next;
        });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [sacrificing, activeZombies, onSacrificeComplete, zombieCount]);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        alignItems: "flex-end",
        justifyContent: "center",
        position: "relative",
        background: "#0a0a15",
        overflow: "hidden",
        borderRadius: "16px",
      }}
    >
      {/* Glowing Container */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          width: "180px",
          height: "120px",
          borderRadius: "16px",
          background: "rgba(57, 255, 20, 0.12)",
          border: "3px solid #39ff14",
          boxShadow: "0 0 40px #39ff1470, inset 0 0 30px #39ff1420",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          padding: "10px",
          zIndex: 2,
        }}
      >
        {containerZombies.map((z, idx) => (
          <div
            key={z}
            style={{
              width: "24px",
              height: "48px",
              margin: "0 4px",
              borderRadius: "8px",
              background: "#39ff14",
              boxShadow: "0 0 10px #39ff1499",
              transition: "transform 0.2s",
            }}
          />
        ))}
      </div>

      {/* Falling Zombies */}
      {activeZombies.map((z, idx) => (
        <div
          key={z}
          style={{
            position: "absolute",
            top: 0,
            left: `${45 + (idx % 5) * 30}px`,
            width: "24px",
            height: "48px",
            background: "#39ff14",
            borderRadius: "8px",
            boxShadow: "0 0 12px #39ff14cc",
            animation: "fall 0.6s ease-in forwards",
            zIndex: 3,
          }}
        />
      ))}

      {/* CSS Animation */}
      <style>{`
        @keyframes fall {
          from { transform: translateY(-100px); opacity: 0; }
          to { transform: translateY(120px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default PortalSacrifice;
