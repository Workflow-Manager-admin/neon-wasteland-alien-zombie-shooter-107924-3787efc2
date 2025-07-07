import React, { useEffect, useState } from "react";
import { fetchTopScores } from "../supabaseClient";

/**
 * PUBLIC_INTERFACE
 * Leaderboard overlay component for top 5 highscores.
 * Fetches from Supabase on mount or when "visible" toggles true.
 */
function Leaderboard({ visible = false, onClose }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchTopScores(5)
      .then(setScores)
      .finally(() => setLoading(false));
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="game-overlay" style={{zIndex: 200}}>
      <div className="neon-title" style={{marginBottom: '0.6em'}}>🏆 Leaderboard</div>
      <div style={{
        background: "#161925cc",
        borderRadius: '14px',
        padding: "2em 2.5em 1.6em 2.5em",
        boxShadow: "0 0 24px #39ff1488",
        minWidth: 250,
        minHeight: 180,
        color: "#39ff14",
        fontSize: "1.16em"
      }}>
        {loading ? <div>Loading...</div> : (
          <ol style={{padding:0, margin:0, listStyle: "decimal", fontFamily:"monospace", fontWeight: 600}}>
            {scores.length === 0 ? <li style={{color:"#fff"}}>No scores yet!</li> :
              scores.map((row, idx) => (
                <li key={idx} style={{
                  color: idx === 0 ? "#fff" : "#39ff14",
                  textShadow: idx === 0 ? "0 0 14px #fff" : "0 0 6px #39ff14"
                }}>
                  <span style={{
                    color: idx === 0 ? "#ffd700" : "#eaaffd",
                    marginRight: 9,
                    fontWeight: idx === 0 ? 900 : 600,
                    letterSpacing: 1
                  }}>
                    {row.player || "Anon"}
                  </span>
                  <span style={{float:"right",color: "#fff", fontWeight:500, fontSize: "1.1em"}}>
                    {row.score}
                  </span>
                </li>
              ))
            }
          </ol>
        )}
      </div>
      <button className="neon-btn neon-btn-accent" style={{marginTop:"2em"}} onClick={onClose}>Close</button>
    </div>
  );
}

export default Leaderboard;
