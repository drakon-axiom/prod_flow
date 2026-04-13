import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { cn } from '../../utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/30 transition-opacity data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className={cn(
            'w-full rounded-xl bg-white p-6 shadow-xl transition-all',
            'data-closed:scale-95 data-closed:opacity-0',
            sizeClasses[size],
          )}
        >
          {title && (
            <div className="flex items-center justify-between mb-4">
              <DialogTitle className="text-lg font-semibold text-gray-900">{title}</DialogTitle>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
