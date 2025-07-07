import { createClient } from '@supabase/supabase-js';

/**
 * PUBLIC_INTERFACE
 * Supabase client for Neon Zombie Shooter highscores - helper for leaderboard.
 * - Save score: await saveHighscore(username, score)
 * - Fetch top scores: await fetchTopScores()
 */
const supabaseUrl = 'https://tohyglycuoelcxayfdpa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaHlnbHljdW9lbGN4YXlmZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMTA0OTksImV4cCI6MjA2NDY4NjQ5Mn0.Aw6tHQ74yMarduOP7Kdk7OOV9GljbceWGk4OEAVw6LA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// PUBLIC_INTERFACE
export async function saveHighscore(player, score) {
  /**
   * Saves a highscore to Supabase highscores table.
   * @param {String} player - Username
   * @param {Number} score - Game score
   * @returns {Promise<Object>} - result
   */
  if (!player) player = 'Anon';
  return await supabase.from('highscores').insert([{ player, score }]);
}

// PUBLIC_INTERFACE
export async function fetchTopScores(limit = 5) {
  /**
   * Gets top highscores from Supabase.
   * @param {Number} limit
   * @returns {Promise<{player,score}[]>}
   */
  const { data, error } = await supabase
    .from('highscores')
    .select('player,score')
    .order('score', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export default supabase;
