'use client'

import { useState, useCallback } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          border: '0.5px solid #E8E7E2',
          padding: 24,
          width: 400,
          maxWidth: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111110' }}>
          {title}
        </div>
        <div style={{ fontSize: 13, fontWeight: 400, color: '#5F5E5A', marginTop: 8, lineHeight: 1.5 }}>
          {body}
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: '#5F5E5A',
              background: 'transparent',
              border: '0.5px solid #E8E7E2',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: '#fff',
              background: destructive ? '#A32D2D' : '#111110',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook for simple confirm dialog state management
export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean
    title: string
    body: string
    confirmLabel?: string
    destructive?: boolean
    onConfirm: () => void
  }>({
    open: false,
    title: '',
    body: '',
    onConfirm: () => {},
  })

  const showConfirm = useCallback((opts: {
    title: string
    body: string
    confirmLabel?: string
    destructive?: boolean
    onConfirm: () => void
  }) => {
    setState({ open: true, ...opts })
  }, [])

  const cancel = useCallback(() => {
    setState(prev => ({ ...prev, open: false }))
  }, [])

  const confirm = useCallback(() => {
    state.onConfirm()
    setState(prev => ({ ...prev, open: false }))
  }, [state])

  return { state, showConfirm, cancel, confirm }
}
