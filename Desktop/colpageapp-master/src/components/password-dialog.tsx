import * as React from 'react'

interface PasswordDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSave: (password: string) => void
  title: string
  description: string
}

export function PasswordDialog({ isOpen, onOpenChange, onSave, title, description }: PasswordDialogProps) {
  const [password, setPassword] = React.useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(password)
    setPassword('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-gray-900 p-6 rounded-lg max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-gray-300 mb-4">{description}</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 mb-4"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
