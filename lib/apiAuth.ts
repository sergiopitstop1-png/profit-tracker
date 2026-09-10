// Salva questo file come: lib/apiAuth.ts
//
// Autorizza una richiesta API in due modi:
// 1) Chiave segreta nell'header 'x-automation-key' — per gli script che
//    girano sul PC (read_balance.js, poller.js, genera_clients.js), che
//    non hanno una sessione browser.
// 2) Sessione utente con ruolo vip/admin — per quando la pagina del
//    Profit Tracker chiama l'API dal browser, gia' loggata (stesso
//    controllo che middleware.ts fa per le pagine).

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function isRequestAuthorized(request: Request): Promise<boolean> {
  // 1) chiave segreta per gli script di automazione
  const automationKey = request.headers.get('x-automation-key')
  if (automationKey && process.env.AUTOMATION_SECRET && automationKey === process.env.AUTOMATION_SECRET) {
    return true
  }

  // 2) sessione utente vip/admin (stesso controllo del middleware)
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const role = profile?.role || 'user'
  return role === 'vip' || role === 'admin'
}
