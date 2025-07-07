# Supabase Integration – Neon Synth Zombie Shooter

## Project Table

- **Table:** highscores
- **Fields:**
  - player: text (short username, up to 24 chars, required)
  - score: integer (required)

### NOTE on Backend Status

- As of this configuration, programmatic creation or modification of tables (including "highscores") is currently blocked by a Supabase configuration/permissions issue (`public.run_sql` not available).
- If the table does NOT exist yet, it must be created manually in the Supabase dashboard with the above schema.
- The game client expects this exact schema and will attempt to write with anon access at game over.

## Usage

- At game over, POST a row to `highscores` with the entered username and their score.
- Uses anon key with row insert permission for the table only.
- No authentication; username is prompted at game-over.
- If you encounter errors saving scores, ensure the "highscores" table exists and is writable via anon key in Supabase.

## Environment

- Supabase URL: https://tohyglycuoelcxayfdpa.supabase.co
- Supabase Anon Key: (see code)
- If you change project keys/tables, update `frontend_web/src/supabaseClient.js` accordingly.

## Client

- See /src/supabaseClient.js for primary connection logic.
- Only the `insert` method into highscores is used.

## UI
- Name prompt appears when the game is over for a user to enter their name and save the score.
