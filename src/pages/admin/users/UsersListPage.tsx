import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUsers, useUpdateUser, useSetPassword, useDeleteUser } from '../../../api/users'
import { useAuth } from '../../../hooks/useAuth'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DataTable } from '../../../components/ui/DataTable'
import { Badge } from '../../../components/ui/Badge'
import { Modal } from '../../../components/ui/Modal'
import { Input } from '../../../components/ui/Input'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import { PlusIcon } from '@heroicons/react/24/outline'

export default function UsersListPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const { data: users, isLoading } = useUsers()
  const updateUser = useUpdateUser()
  const setPassword = useSetPassword()
  const deleteUser = useDeleteUser()

  const [passwordModal, setPasswordModal] = useState<{ id: string; name: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

  function handleSetPassword() {
    if (!passwordModal || newPassword.length < 8) return
    setPassword.mutate(
      { user_id: passwordModal.id, password: newPassword },
      {
        onSuccess: () => {
          toast('success', `Password updated for ${passwordModal.name}`)
          setPasswordModal(null)
          setNewPassword('')
        },
        onError: (err) => toast('error', err.message),
      },
    )
  }

  function handleDelete() {
    if (!confirmDelete) return
    deleteUser.mutate(
      { user_id: confirmDelete.id },
      {
        onSuccess: () => {
          toast('success', `User ${confirmDelete.name} deleted`)
          setConfirmDelete(null)
        },
        onError: (err) => toast('error', err.message),
      },
    )
  }

  if (isLoading) return <LoadingSpinner text="Loading users..." />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Button onClick={() => navigate('/admin/users/new')}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card padding={false}>
        <DataTable
          keyExtractor={(r) => r.id}
          emptyMessage="No users"
          data={users ?? []}
          columns={[
            { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
            {
              key: 'role',
              header: 'Role',
              render: (r) => (
                <Badge className={r.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                  {r.role}
                </Badge>
              ),
            },
            {
              key: 'is_active',
              header: 'Status',
              render: (r) => (
                <Badge className={r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                  {r.is_active ? 'Active' : 'Inactive'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => {
                const isSelf = r.id === currentUser?.id
                return (
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/users/${r.id}`) }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setPasswordModal({ id: r.id, name: r.name }) }}
                    >
                      Set Password
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        updateUser.mutate(
                          { user_id: r.id, is_active: !r.is_active },
                          { onSuccess: () => toast('success', r.is_active ? 'Deactivated' : 'Reactivated') },
                        )
                      }}
                    >
                      {r.is_active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: r.id, name: r.name }) }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                )
              },
            },
          ]}
        />
      </Card>

      {/* Set Password Modal */}
      <Modal open={!!passwordModal} onClose={() => { setPasswordModal(null); setNewPassword('') }} title={`Set Password — ${passwordModal?.name}`}>
        <div className="space-y-4">
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            minLength={8}
          />
          <div className="flex gap-3">
            <Button onClick={handleSetPassword} loading={setPassword.isPending} disabled={newPassword.length < 8}>
              Set Password
            </Button>
            <Button variant="secondary" onClick={() => { setPasswordModal(null); setNewPassword('') }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete User">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to permanently delete <strong>{confirmDelete?.name}</strong>? This will remove their auth account and profile. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="danger" onClick={handleDelete} loading={deleteUser.isPending}>
            Delete User
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
        </div>
      </Modal>
    </div>
  )
}
