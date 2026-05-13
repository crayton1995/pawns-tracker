import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://vvlyxhnmigrpgwnigyke.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2bHl4aG5taWdycGd3bmlneWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NTIzMTMsImV4cCI6MjA5NDEyODMxM30.Wxn8Yfdvu83h5HWcaScSfq_3ClTXsAEfrqvcy9r8wDs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
