import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  QueueListIcon,
  PlayCircleIcon,
  BeakerIcon,
  CubeIcon,
  UsersIcon,
  AdjustmentsHorizontalIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'
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
  { to: '/admin/import', label: 'Import Data', icon: ArrowUpTrayIcon },
]

function SidebarLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof HomeIcon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </NavLink>
  )
}

export function Sidebar() {
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-gray-200 lg:bg-white">
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <h1 className="text-lg font-bold text-indigo-600">ProdFlow</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <SidebarLink key={item.to} {...item} />
        ))}
        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
            </div>
            {adminItems.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-gray-200 p-4">
        <div className="text-sm font-medium text-gray-900">{profile?.name}</div>
        <div className="text-xs text-gray-500 capitalize">{profile?.role}</div>
        <button
          onClick={signOut}
          className="mt-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
