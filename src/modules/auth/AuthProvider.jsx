import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = ainda carregando; null = sem sessão
  const [sessao, setSessao] = useState(supabase ? undefined : null)
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => setSessao(data.session))

    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = sessao?.user?.id

  useEffect(() => {
    if (!userId) return
    let cancelado = false
    supabase
      .from('perfis')
      .select('id, nome')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => !cancelado && setPerfil(data))
    return () => {
      cancelado = true
    }
  }, [userId])

  const valor = useMemo(
    () => ({
      sessao,
      usuario: sessao?.user ?? null,
      perfil: userId ? perfil : null,
      carregando: sessao === undefined,
      sair: () => supabase.auth.signOut(),
      atualizarPerfil: setPerfil,
    }),
    [sessao, perfil, userId],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
