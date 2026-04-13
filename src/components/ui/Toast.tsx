import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((type: ToastType, message: string) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-sm min-w-72',
              t.type === 'success' && 'bg-green-50 text-green-800 border border-green-200',
              t.type === 'error' && 'bg-red-50 text-red-800 border border-red-200',
              t.type === 'info' && 'bg-blue-50 text-blue-800 border border-blue-200',
            )}
          >
            {t.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-500 shrink-0" />}
            {t.type === 'error' && <ExclamationTriangleIcon className="h-5 w-5 text-red-500 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="shrink-0">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
