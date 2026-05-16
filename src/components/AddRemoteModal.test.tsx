import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AddRemoteModal } from './AddRemoteModal'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(),
}))

import { mockInvoke } from '../mock-tauri'

const mockInvokeFn = vi.mocked(mockInvoke)

describe('AddRemoteModal', () => {
  const onClose = vi.fn()
  const onRemoteConnected = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockResolvedValue({
      status: 'connected',
      message: 'Remote connected. This vault now tracks origin/main.',
    })
  })

  it('renders repository controls when open', async () => {
    render(
      <AddRemoteModal
        open={true}
        vaultPath="/vault"
        remoteStatus={{
          branch: 'main',
          ahead: 0,
          behind: 0,
          hasRemote: true,
          remoteUrl: 'git@github.com:user/current.git',
          gitRoot: '/repo',
        }}
        onClose={onClose}
        onRemoteConnected={onRemoteConnected}
      />
    )

    expect(screen.getByText('Git Repository')).toBeInTheDocument()
    expect(screen.getByTestId('git-vault-path')).toHaveValue('/vault')
    expect(screen.getByTestId('git-repository-root')).toHaveValue('/repo')
    expect(screen.getByTestId('add-remote-url')).toHaveValue('git@github.com:user/current.git')
    const input = screen.getByTestId('add-remote-url')
    await waitFor(() => expect(input).toHaveFocus())
  })

  it('opens the local path picker from the repository dialog', () => {
    const onOpenLocalFolder = vi.fn()
    const onCloneVault = vi.fn()

    render(
      <AddRemoteModal
        open={true}
        vaultPath="/vault"
        onOpenLocalFolder={onOpenLocalFolder}
        onCloneVault={onCloneVault}
        onClose={onClose}
        onRemoteConnected={onRemoteConnected}
      />
    )

    fireEvent.click(screen.getByTestId('git-open-vault-path'))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onOpenLocalFolder).toHaveBeenCalledOnce()
    expect(onCloneVault).not.toHaveBeenCalled()
  })

  it('opens the clone flow from the repository dialog', () => {
    const onOpenLocalFolder = vi.fn()
    const onCloneVault = vi.fn()

    render(
      <AddRemoteModal
        open={true}
        vaultPath="/vault"
        onOpenLocalFolder={onOpenLocalFolder}
        onCloneVault={onCloneVault}
        onClose={onClose}
        onRemoteConnected={onRemoteConnected}
      />
    )

    fireEvent.click(screen.getByTestId('git-clone-repository'))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onCloneVault).toHaveBeenCalledOnce()
    expect(onOpenLocalFolder).not.toHaveBeenCalled()
  })

  it('submits the repository URL to git_add_remote', async () => {
    render(
      <AddRemoteModal
        open={true}
        vaultPath="/vault"
        onClose={onClose}
        onRemoteConnected={onRemoteConnected}
      />
    )

    fireEvent.change(screen.getByTestId('add-remote-url'), {
      target: { value: 'git@github.com:user/my-vault.git' },
    })
    fireEvent.click(screen.getByTestId('add-remote-submit'))

    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('git_add_remote', {
        request: {
          vaultPath: '/vault',
          remoteUrl: 'git@github.com:user/my-vault.git',
        },
      })
    })

    expect(onRemoteConnected).toHaveBeenCalledWith('Remote connected. This vault now tracks origin/main.')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows backend validation errors without closing the modal', async () => {
    mockInvokeFn.mockResolvedValueOnce({
      status: 'incompatible_history',
      message: 'This repository has unrelated history.',
    })

    render(
      <AddRemoteModal
        open={true}
        vaultPath="/vault"
        onClose={onClose}
        onRemoteConnected={onRemoteConnected}
      />
    )

    fireEvent.change(screen.getByTestId('add-remote-url'), {
      target: { value: 'https://example.com/repo.git' },
    })
    fireEvent.click(screen.getByTestId('add-remote-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('add-remote-error')).toHaveTextContent('This repository has unrelated history.')
    })

    expect(onRemoteConnected).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

