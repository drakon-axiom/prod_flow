import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useUsers, useUpdateUser, useSetPassword } from '../../../api/users'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Card } from '../../../components/ui/Card'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'

export default function UserEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: users, isLoading } = useUsers()
  const updateUser = useUpdateUser()
  const setPasswordMutation = useSetPassword()

  const user = users?.find((u) => u.id === id)

  const [form, setForm] = useState({ name: '', role: 'operator' })
  const [newPassword, setNewPassword] = useState('')
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (user && !initialized) {
      setForm({ name: user.name, role: user.role })
      setInitialized(true)
    }
  }, [user, initialized])

  if (isLoading) return <LoadingSpinner text="Loading user..." />
  if (!user) return <p className="text-gray-500">User not found</p>

  function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    updateUser.mutate(
      { user_id: id!, name: form.name, role: form.role },
      {
        onSuccess: () => toast('success', 'Profile updated'),
        onError: (err) => toast('error', err.message),
      },
    )
  }

  function handleSetPassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) return
    setPasswordMutation.mutate(
      { user_id: id!, password: newPassword },
      {
        onSuccess: () => {
          toast('success', 'Password updated')
          setNewPassword('')
        },
        onError: (err) => toast('error', err.message),
      },
    )
  }


  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit User — {user.name}</h1>

      {/* Profile Section */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            options={[
              { value: 'operator', label: 'Operator' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <Button type="submit" loading={updateUser.isPending}>Save Profile</Button>
        </form>
      </Card>

      {/* Password Section */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Password</h2>
        <form onSubmit={handleSetPassword} className="space-y-4">
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            minLength={8}
          />
          <Button type="submit" loading={setPasswordMutation.isPending} disabled={newPassword.length < 8}>
            Set New Password
          </Button>
        </form>
      </Card>

      <Button variant="secondary" onClick={() => navigate('/admin/users')}>Back to Users</Button>
    </div>
  )
}
