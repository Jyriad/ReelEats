// --- Shared Supabase Client ---
// This file creates and exports a single Supabase client instance for use across the application

import { createClient } from 'https://unpkg.com/@supabase/supabase-js@2';
import { CONFIG } from './config.js';

// Create a single Supabase client instance
export const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Export a function to test the connection
export async function testSupabaseConnection() {
    try {
        const { data, error } = await supabaseClient
            .from('cities')
            .select('id')
            .limit(1);
        
        if (error) throw error;
        return { testData: data, testError: null };
    } catch (error) {
        return { testData: null, testError: error };
    }
}
