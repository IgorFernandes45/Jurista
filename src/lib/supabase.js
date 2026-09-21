import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigurado = Boolean(url && key)

if (!supabaseConfigurado) {
  console.warn('Supabase não configurado: preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.local')
}

export const supabase = supabaseConfigurado ? createClient(url, key) : null
