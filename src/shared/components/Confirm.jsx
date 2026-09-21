import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

const ConfirmContext = createContext(null)

// Uso: const confirmar = useConfirm(); if (await confirmar({ titulo, mensagem })) { ... }
export function ConfirmProvider({ children }) {
  const [opcoes, setOpcoes] = useState(null)
  const resolver = useRef(null)

  const confirmar = useCallback((opts) => {
    setOpcoes(opts)
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const responder = (valor) => {
    resolver.current?.(valor)
    resolver.current = null
    setOpcoes(null)
  }

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Modal
        aberto={Boolean(opcoes)}
        onFechar={() => responder(false)}
        titulo={opcoes?.titulo ?? 'Confirmar'}
        largura="max-w-md"
        rodape={
          <>
            <Button variant="secondary" onClick={() => responder(false)}>
              Cancelar
            </Button>
            <Button variant={opcoes?.perigo ? 'danger' : 'primary'} onClick={() => responder(true)}>
              {opcoes?.textoConfirmar ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{opcoes?.mensagem}</p>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext)
}
