import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDashboardStats } from '../api/dashboard'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { RUN_STATUS_COLORS, type RunStatus } from '../types/constants'
import {
  PlayCircleIcon,
  QueueListIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: stats, isLoading } = useDashboardStats()

  if (isLoading) return <LoadingSpinner text="Loading dashboard..." />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Welcome back, {profile?.name}</p>

      {/* Stat Cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => navigate('/runs')}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <PlayCircleIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Runs</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.activeRuns ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card className="cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => navigate('/queue')}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <QueueListIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Queued Items</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.queuedItems ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed Today</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.completedToday ?? 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => navigate('/queue')}>View Queue</Button>
        <Button variant="secondary" onClick={() => navigate('/runs')}>View Runs</Button>
      </div>

      {/* Recent Runs */}
      <Card className="mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Runs</h2>
        {stats?.recentRuns.length === 0 ? (
          <p className="text-sm text-gray-500">No runs yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {stats?.recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
                onClick={() => navigate(`/runs/${run.id}`)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{run.formula_name}</p>
                  <p className="text-xs text-gray-500">{run.product_name} — {run.batch_size} {run.base_batch_unit}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={RUN_STATUS_COLORS[run.status as RunStatus]}>
                    {run.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {new Date(run.started_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
