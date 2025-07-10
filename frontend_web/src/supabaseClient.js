// File: supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tohyglycuoelcxayfdpa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaHlnbHljdW9lbGN4YXlmZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMTA0OTIsImV4cCI6MjA2NDY4NjQ5Mn0.Aw6tHQ74yMarduOP7Kdk7OOV9GljbceWGk4OEAVw6LA';

export const supabase = createClient(supabaseUrl, supabaseKey);
