
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lgleqeweumeobsejpzlb.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbGVxZXdldW1lb2JzZWpwemxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNTQ0NzIsImV4cCI6MjA3NzczMDQ3Mn0.r3P2ifr9Qz-kozXEM81dPbALleKFJ_edE6IwVCQeLrQ'

export function publicUrl(filePath: string) {
  return `${supabaseUrl}/storage/v1/object/public/avatars/${filePath}`
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,           // 👈 必填（RN/Expo）
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,       // 👈 RN 必须关，否则会等不到 URL
  },
})
