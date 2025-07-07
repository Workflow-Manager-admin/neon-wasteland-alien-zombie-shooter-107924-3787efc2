import { createClient } from '@supabase/supabase-js';

/**
 * PUBLIC_INTERFACE
 * Supabase client for Neon Zombie Shooter highscores.
 */
const supabaseUrl = 'https://tohyglycuoelcxayfdpa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaHlnbHljdW9lbGN4YXlmZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMTA0OTksImV4cCI6MjA2NDY4NjQ5Mn0.Aw6tHQ74yMarduOP7Kdk7OOV9GljbceWGk4OEAVw6LA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
