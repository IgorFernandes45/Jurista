import { useCallback, useEffect, useState } from 'react'

// Roda uma consulta ao Supabase e devolve { dados, carregando, erro, recarregar }.
// A função passada recebe nada e deve devolver a promise do supabase ({ data, error }).
export function useConsulta(consulta, dependencias = []) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null })

  const executar = useCallback(async () => {
    setEstado((e) => ({ ...e, carregando: true }))
    const { data, error } = await consulta()
    setEstado({ dados: data ?? null, carregando: false, erro: error ?? null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias)

  useEffect(() => {
    executar()
  }, [executar])

  return { ...estado, recarregar: executar }
}
