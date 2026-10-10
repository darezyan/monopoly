import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** Null when no keys are configured; the game then runs offline. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
