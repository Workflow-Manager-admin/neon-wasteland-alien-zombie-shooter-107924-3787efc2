# Supabase Integration – Neon Synth Zombie Shooter

## Project Table

- **Table:** highscores
- **Fields:**
  - player: text (short username, up to 24 chars)
  - score: integer

## Usage

- At game over, POST a row to `highscores` with the entered username and their score.
- Uses anon key with row insert permission for the table only.
- No authentication; username is prompted at game-over.

## Environment

- Supabase URL: https://tohyglycuoelcxayfdpa.supabase.co
- Supabase Anon Key: (see code)

## Client

- See /src/supabaseClient.js for primary connection logic.
- Only the `insert` method into highscores is used.

## UI
- Name prompt appears when the game is over for a user to enter their name and save the score.
