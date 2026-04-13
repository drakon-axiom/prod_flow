import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react'
import { XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline'
import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  QueueListIcon,
  PlayCircleIcon,
  BeakerIcon,
  CubeIcon,
  UsersIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'
import { cn } from '../../utils/cn'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { to: '/queue', label: 'Queue', icon: QueueListIcon },
  { to: '/runs', label: 'Runs', icon: PlayCircleIcon },
]

const adminItems = [
  { to: '/admin/ingredients', label: 'Ingredients', icon: CubeIcon },
  { to: '/admin/formulas', label: 'Formulas', icon: BeakerIcon },
  { to: '/admin/users', label: 'Users', icon: UsersIcon },
  { to: '/admin/field-templates', label: 'Field Templates', icon: AdjustmentsHorizontalIcon },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'

  return (
    <>
      <div className="lg:hidden flex items-center justify-between h-16 px-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-indigo-600">ProdFlow</h1>
        <button onClick={() => setOpen(true)} className="p-2 text-gray-500">
          <Bars3Icon className="h-6 w-6" />
        </button>
      </div>

      <Dialog open={open} onClose={setOpen} className="relative z-50 lg:hidden">
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <DialogPanel className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl">
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <h1 className="text-lg font-bold text-indigo-600">ProdFlow</h1>
            <button onClick={() => setOpen(false)} className="text-gray-400">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="px-3 py-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100',
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-3 text-xs font-semibold text-gray-400 uppercase">Admin</p>
                </div>
                {adminItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                        isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100',
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 border-t p-4">
            <div className="text-sm font-medium text-gray-900">{profile?.name}</div>
            <button onClick={signOut} className="mt-1 text-sm text-gray-500 hover:text-gray-700">
              Sign out
            </button>
          </div>
        </DialogPanel>
      </Dialog>
    </>
  )
}
