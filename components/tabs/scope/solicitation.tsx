'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAppContext } from '@/contexts/app-context'
import { proposalsApi, requirementsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Upload,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from 'lucide-react'
import * as pdfjs from 'pdfjs-dist'

// Configure PDF.js worker - use local file for reliability
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

// ============================================================================
// TYPES
// ============================================================================

interface AISummary {
  whatTheyWant: string
  whyItMatters: string
  keyChallenges: string[]
  evaluationEmphasis: string[]
  fftcRelevance: string | null
  keyDates: {
    label: string
    value: string
    urgent?: boolean
  }[]
  generatedAt: string
}

interface PDFState {
  file: File | null
  url: string | null
  numPages: number
  currentPage: number
  scale: number
  fileName: string | null
  uploadDate: string | null
}

type SummaryStatus = 'waiting' | 'generating' | 'complete' | 'error'

// ============================================================================
// UTILITIES
// ============================================================================

const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============================================================================
// PDF VIEWER COMPONENT
// ============================================================================

function PDFViewer({
  pdfState,
  onFileUpload,
  onReplace,
  onDownload,
}: {
  pdfState: PDFState
  onFileUpload: (file: File) => void
  onReplace: () => void
  onDownload: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [scale, setScale] = useState(1.0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Render PDF page
  const renderPage = useCallback(async (num: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return

    const page = await pdfDocRef.current.getPage(num)
    const viewport = page.getViewport({ scale })
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    canvas.height = viewport.height
    canvas.width = viewport.width

    // @ts-expect-error - pdfjs-dist v5 types expect canvas but canvasContext works
    await page.render({
      canvasContext: context,
      viewport,
    }).promise
  }, [scale])

  // Load PDF when URL changes
  useEffect(() => {
    if (!pdfState.url) {
      pdfDocRef.current = null
      return
    }

    const loadPdf = async () => {
      try {
        const pdf = await pdfjs.getDocument(pdfState.url!).promise
        pdfDocRef.current = pdf
        setPageNum(1)
        renderPage(1)
      } catch (error) {
        console.error('Failed to load PDF:', error)
      }
    }

    loadPdf()
  }, [pdfState.url, renderPage])

  // Re-render when page or scale changes
  useEffect(() => {
    if (pdfDocRef.current) {
      renderPage(pageNum)
    }
  }, [pageNum, scale, renderPage])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0 && files[0].type === 'application/pdf') {
      onFileUpload(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0 && files[0].type === 'application/pdf') {
      onFileUpload(files[0])
    }
  }

  const goToPrevPage = () => {
    if (pageNum > 1) setPageNum(pageNum - 1)
  }

  const goToNextPage = () => {
    if (pageNum < pdfState.numPages) setPageNum(pageNum + 1)
  }

  const zoomOut = () => {
    if (scale > 0.5) setScale(scale - 0.25)
  }

  const zoomIn = () => {
    if (scale < 3) setScale(scale + 0.25)
  }

  // Empty state
  if (!pdfState.url) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div
          className="h-11 flex items-center justify-between px-4 shrink-0"
          style={{
            backgroundColor: '#FFFFFF',
            borderBottom: '0.5px solid #E8E7E2',
          }}
        >
          <span className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
            Source Document
          </span>
        </div>

        {/* Drop zone */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="w-full max-w-[320px] cursor-pointer"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div
              className="rounded-xl p-10 text-center transition-all"
              style={{
                border: isDragging ? '1.5px dashed var(--ink)' : '1.5px dashed #D4D3CE',
                backgroundColor: isDragging ? '#FAFAF8' : 'transparent',
              }}
            >
              <Upload
                className="w-7 h-7 mx-auto mb-4"
                style={{ color: '#C4C3BE' }}
              />
              <p
                className="text-[14px] font-bold mb-2"
                style={{ color: 'var(--ink)' }}
              >
                Drop your RFP here
              </p>
              <p
                className="text-[12px] mb-5 leading-[1.5]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                PDF up to 50MB. The AI summary generates automatically on upload.
              </p>
              <button
                className="px-4 py-[7px] text-[12px] font-semibold rounded-md transition-fast"
                style={{
                  backgroundColor: '#F4F3EF',
                  color: 'var(--ink)',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
              >
                Browse files
              </button>
              <p
                className="text-[10px] mt-3"
                style={{ color: '#C4C3BE' }}
              >
                or drag and drop
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>
    )
  }

  // Loaded state
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        className="h-11 flex items-center justify-between px-4 shrink-0"
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '0.5px solid #E8E7E2',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
            {pdfState.fileName}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {pdfState.numPages} pages · {pdfState.uploadDate && getRelativeTime(pdfState.uploadDate)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onReplace} className="h-7 text-[11px]">
            Replace
          </Button>
          <Button variant="ghost" size="sm" onClick={onDownload} className="h-7 text-[11px]">
            Download
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ backgroundColor: '#3A3A3A' }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="w-6 h-6 flex items-center justify-center rounded"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <Minus className="w-3.5 h-3.5 text-white/70" />
          </button>
          <button
            onClick={zoomIn}
            className="w-6 h-6 flex items-center justify-center rounded"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <Plus className="w-3.5 h-3.5 text-white/70" />
          </button>
        </div>

        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Page {pageNum} of {pdfState.numPages}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevPage}
            disabled={pageNum <= 1}
            className="w-6 h-6 flex items-center justify-center rounded disabled:opacity-30"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <ChevronLeft className="w-3.5 h-3.5 text-white/70" />
          </button>
          <button
            onClick={goToNextPage}
            disabled={pageNum >= pdfState.numPages}
            className="w-6 h-6 flex items-center justify-center rounded disabled:opacity-30"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <ChevronRight className="w-3.5 h-3.5 text-white/70" />
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div
        className="flex-1 overflow-auto p-4"
        style={{ backgroundColor: '#6B6B6B' }}
      >
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="shadow-xl"
            style={{
              maxWidth: '520px',
              width: '100%',
              height: 'auto',
              backgroundColor: '#FFFFFF',
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// AI SUMMARY PANEL
// ============================================================================

function AISummaryPanel({
  summary,
  status,
  error,
  onRegenerate,
  onRetry,
  hasCompanyProfile,
}: {
  summary: AISummary | null
  status: SummaryStatus
  error: string | null
  onRegenerate: () => void
  onRetry: () => void
  hasCompanyProfile: boolean
}) {
  // Get the primary due date
  const primaryDueDate = summary?.keyDates?.find(d =>
    d.label.toLowerCase().includes('proposal') ||
    d.label.toLowerCase().includes('due')
  ) || summary?.keyDates?.[0]

  // Get other dates (not the primary one)
  const otherDates = summary?.keyDates?.filter(d => d !== primaryDueDate) || []
  // Status indicator
  const renderStatusIndicator = () => {
    switch (status) {
      case 'waiting':
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#C4C3BE' }} />
            <span className="text-[11px]" style={{ color: '#C4C3BE' }}>
              Upload RFP to generate
            </span>
          </div>
        )
      case 'generating':
        return (
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--signal)' }}
            />
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              Generating...
            </span>
          </div>
        )
      case 'complete':
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#639922' }} />
            <span className="text-[11px]" style={{ color: '#639922' }}>
              Generated {summary?.generatedAt && getRelativeTime(summary.generatedAt)}
            </span>
          </div>
        )
      case 'error':
        return (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#A32D2D' }} />
            <span className="text-[11px]" style={{ color: '#A32D2D' }}>
              Generation failed
            </span>
            <button
              onClick={onRetry}
              className="text-[11px] font-semibold underline"
              style={{ color: '#A32D2D' }}
            >
              Retry
            </button>
          </div>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        className="h-11 flex items-center justify-between px-4 shrink-0"
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '0.5px solid #E8E7E2',
        }}
      >
        <span className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
          AI Summary
        </span>
        <div className="flex items-center gap-3">
          {renderStatusIndicator()}
          {status === 'complete' && (
            <Button variant="ghost" size="sm" onClick={onRegenerate} className="h-7 text-[11px]">
              <RefreshCw className="w-3 h-3 mr-1" />
              Regenerate
            </Button>
          )}
        </div>
      </div>

      {/* Due Date Row - always visible when complete */}
      {status === 'complete' && primaryDueDate && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#FAFAF8',
            borderBottom: '0.5px solid #E8E7E2',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#9B9A95',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            {primaryDueDate.label}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: primaryDueDate.urgent ? '#A32D2D' : '#111110',
              letterSpacing: '-0.3px',
            }}
          >
            {primaryDueDate.value}
          </span>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {status === 'waiting' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-[200px]">
              <Sparkles
                className="w-7 h-7 mx-auto mb-3"
                style={{ color: '#C4C3BE' }}
              />
              <p
                className="text-[13px] font-semibold mb-2"
                style={{ color: 'var(--ink)' }}
              >
                Summary appears here
              </p>
              <p
                className="text-[12px] leading-[1.5]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Upload your RFP on the left to generate a plain-language summary.
              </p>
            </div>
          </div>
        )}

        {status === 'generating' && (
          <div className="p-5 space-y-4">
            {[100, 85, 90, 75, 80, 70].map((width, i) => (
              <div key={i} className="space-y-2">
                <div
                  className="h-2 w-20 rounded animate-pulse"
                  style={{ backgroundColor: '#F4F3EF' }}
                />
                <div
                  className="h-4 rounded animate-pulse"
                  style={{
                    backgroundColor: '#F4F3EF',
                    width: `${width}%`,
                  }}
                />
                {i < 3 && (
                  <div
                    className="h-4 rounded animate-pulse"
                    style={{
                      backgroundColor: '#F4F3EF',
                      width: `${width - 20}%`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {status === 'complete' && summary && (
          <div className="p-5">
            {/* What they want */}
            <SummarySection label="What they want">
              <p style={{ fontSize: 13, fontWeight: 400, color: '#111110', lineHeight: 1.6 }}>
                {summary.whatTheyWant}
              </p>
            </SummarySection>

            {/* Why it matters */}
            <SummarySection label="Why it matters">
              <p style={{ fontSize: 13, fontWeight: 400, color: '#111110', lineHeight: 1.6 }}>
                {summary.whyItMatters}
              </p>
            </SummarySection>

            {/* Key challenges */}
            <SummarySection label="Key challenges">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(summary.keyChallenges || []).map((challenge, index) => {
                  // Cycle through semantic colors: red, amber, blue
                  const colorSchemes = [
                    { bg: '#FCEBEB', text: '#501313', border: '#F09595' },
                    { bg: '#FAEEDA', text: '#412402', border: '#EF9F27' },
                    { bg: '#E6F1FB', text: '#042C53', border: '#85B7EB' },
                  ]
                  const colors = colorSchemes[index % colorSchemes.length]
                  return (
                    <span
                      key={index}
                      style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: colors.bg,
                        color: colors.text,
                        border: `0.5px solid ${colors.border}`,
                        display: 'inline-block',
                      }}
                    >
                      {challenge}
                    </span>
                  )
                })}
              </div>
            </SummarySection>

            {/* Evaluation emphasis */}
            <SummarySection label="Evaluation emphasis">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(summary.evaluationEmphasis || []).map((factor, index) => (
                  <span
                    key={index}
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: '20px',
                      background: '#E6F1FB',
                      color: '#042C53',
                      border: '0.5px solid #85B7EB',
                      display: 'inline-block',
                    }}
                  >
                    {factor}
                  </span>
                ))}
              </div>
            </SummarySection>

            {/* FFTC relevance */}
            <SummarySection label="FFTC relevance" noDivider={otherDates.length === 0}>
              {hasCompanyProfile && summary.fftcRelevance ? (
                <p style={{ fontSize: 13, fontWeight: 400, color: '#111110', lineHeight: 1.6 }}>
                  {summary.fftcRelevance}
                </p>
              ) : (
                <div
                  style={{
                    backgroundColor: '#FAEEDA',
                    borderLeft: '2px solid #BA7517',
                    borderRadius: '0 6px 6px 0',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#412402', marginBottom: 3 }}>
                    Company profile not configured
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: '#633806', lineHeight: 1.5, marginBottom: 8 }}>
                    Add your capabilities and past performance in Account → Company Settings to generate a relevance assessment.
                  </div>
                  <Link
                    href="/account"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#412402',
                      textDecoration: 'none',
                    }}
                  >
                    Configure now →
                  </Link>
                </div>
              )}
            </SummarySection>

            {/* Other dates - only if there are additional dates beyond the primary */}
            {otherDates.length > 0 && (
              <SummarySection label="Other dates" noDivider>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {otherDates.map((date, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '0.5px solid #E8E7E2',
                      borderRadius: 6,
                      padding: '8px 10px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 500,
                        color: '#9B9A95',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: 2,
                      }}
                    >
                      {date.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: date.urgent ? '#A32D2D' : '#111110',
                      }}
                    >
                      {date.value}
                    </div>
                  </div>
                ))}
                </div>
              </SummarySection>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-[240px]">
              <p
                className="text-[13px] font-semibold mb-2"
                style={{ color: '#A32D2D' }}
              >
                Generation failed
              </p>
              <p
                className="text-[12px] mb-4 leading-[1.5]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {error || 'An error occurred while generating the summary.'}
              </p>
              <Button size="sm" onClick={onRetry}>
                Try again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SummarySection({
  label,
  children,
  noDivider = false,
}: {
  label: string
  children: React.ReactNode
  noDivider?: boolean
}) {
  return (
    <div>
      <p
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: '#C4C3BE',
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      {children}
      {!noDivider && (
        <div
          style={{
            height: '0.5px',
            backgroundColor: '#E8E7E2',
            margin: '16px 0',
          }}
        />
      )}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Solicitation() {
  const params = useParams()
  const proposalId = params?.id as string

  const {
    solicitation,
    updateSolicitation,
    setExtractedRequirements,
    setRecommendedRoles,
  } = useAppContext()

  // PDF state
  const [pdfState, setPdfState] = useState<PDFState>({
    file: null,
    url: null,
    numPages: 0,
    currentPage: 1,
    scale: 1,
    fileName: null,
    uploadDate: null,
  })

  // Summary state
  const [summary, setSummary] = useState<AISummary | null>(null)
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>('waiting')
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // Dialogs
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)

  // File input ref for replace
  const replaceInputRef = useRef<HTMLInputElement>(null)

  // Load existing data on mount
  useEffect(() => {
    if (!proposalId) return

    const loadExistingData = async () => {
      try {
        const response = await proposalsApi.get(proposalId) as {
          proposal?: {
            workingData?: {
              solicitationSummary?: AISummary
              pdfUrl?: string
              pdfFileName?: string
              pdfUploadDate?: string
            }
            aiSummary?: {
              what_they_want?: string
              why_it_matters?: string
              key_challenges?: string[]
              evaluation_emphasis?: string
              fftc_relevance?: string | null
              generated_at?: string
            }
          }
        }

        const proposal = response?.proposal
        const workingData = proposal?.workingData

        // Load PDF if exists
        if (workingData?.pdfUrl) {
          setPdfState(prev => ({
            ...prev,
            url: workingData.pdfUrl || null,
            fileName: workingData.pdfFileName || null,
            uploadDate: workingData.pdfUploadDate || null,
            numPages: 1, // Will be updated when PDF loads
          }))
        }

        // Load summary from working_data or aiSummary
        if (workingData?.solicitationSummary) {
          setSummary(workingData.solicitationSummary)
          setSummaryStatus('complete')
        } else if (proposal?.aiSummary) {
          // Convert old format to new format
          const oldSummary = proposal.aiSummary
          setSummary({
            whatTheyWant: oldSummary.what_they_want || '',
            whyItMatters: oldSummary.why_it_matters || '',
            keyChallenges: oldSummary.key_challenges || [],
            evaluationEmphasis: typeof oldSummary.evaluation_emphasis === 'string'
              ? [oldSummary.evaluation_emphasis]
              : [],
            fftcRelevance: oldSummary.fftc_relevance || null,
            keyDates: [],
            generatedAt: oldSummary.generated_at || new Date().toISOString(),
          })
          setSummaryStatus('complete')
        }

        // Check if we have analyzed document
        if (solicitation.analyzedFromDocument) {
          setPdfState(prev => ({
            ...prev,
            fileName: solicitation.analyzedFromDocument || prev.fileName,
          }))
        }
      } catch (error) {
        console.warn('[Solicitation] Failed to load existing data:', error)
      }
    }

    loadExistingData()
  }, [proposalId, solicitation.analyzedFromDocument])

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    // Create temporary blob URL for immediate display
    const tempUrl = URL.createObjectURL(file)

    // Get page count
    let numPages = 1
    try {
      const pdf = await pdfjs.getDocument(tempUrl).promise
      numPages = pdf.numPages
    } catch (error) {
      console.error('Failed to get page count:', error)
    }

    // Set state with temp URL for immediate display
    setPdfState({
      file,
      url: tempUrl,
      numPages,
      currentPage: 1,
      scale: 1,
      fileName: file.name,
      uploadDate: new Date().toISOString(),
    })

    // Upload to storage in parallel with extraction
    if (proposalId) {
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      fetch(`/api/proposals/${proposalId}/upload-pdf`, {
        method: 'POST',
        body: uploadFormData,
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            // Update state with persistent URL
            setPdfState(prev => ({
              ...prev,
              url: data.pdfUrl,
            }))
            // Clean up blob URL
            URL.revokeObjectURL(tempUrl)
          }
        })
        .catch((err) => {
          console.warn('[Solicitation] Failed to persist PDF:', err)
        })
    }

    // Start AI extraction
    await extractRFP(file)
  }

  // Extract RFP and generate summary
  const extractRFP = async (file: File) => {
    setSummaryStatus('generating')
    setSummaryError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/extract-rfp', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Extraction failed: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Extraction failed')
      }

      const { metadata, requirements, suggestedRoles } = data

      // Update solicitation
      updateSolicitation({
        solicitationNumber: metadata.solicitationNumber !== 'N/A' ? metadata.solicitationNumber : '',
        title: metadata.title,
        clientAgency: metadata.clientAgency !== 'N/A' ? metadata.clientAgency : '',
        contractType: mapContractType(metadata.contractType),
        naicsCode: metadata.naicsCode !== 'N/A' ? metadata.naicsCode : '',
        proposalDueDate: metadata.responseDeadline !== 'N/A' ? metadata.responseDeadline : '',
        periodOfPerformance: {
          baseYear: true,
          optionYears: metadata.periodOfPerformance?.options || 0,
        },
        setAside: mapSetAside(metadata.setAside) as '' | 'small-business' | '8a' | 'hubzone' | 'sdvosb' | 'wosb' | 'edwosb' | 'full-open',
        placeOfPerformance: {
          type: metadata.placeOfPerformance?.toLowerCase()?.includes('remote')
            ? 'remote' as const
            : metadata.placeOfPerformance?.toLowerCase()?.includes('hybrid')
              ? 'hybrid' as const
              : 'on-site' as const,
          locations: metadata.placeOfPerformance !== 'N/A' ? [metadata.placeOfPerformance] : [],
          travelRequired: false,
          travelPercent: 0,
        },
        analyzedFromDocument: file.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Store requirements
      if (requirements && requirements.length > 0) {
        setExtractedRequirements(requirements)
        if (proposalId) {
          try {
            await requirementsApi.create(proposalId, requirements)
          } catch (error) {
            console.warn('[Solicitation] Failed to save requirements:', error)
          }
        }
      }

      // Store roles
      if (suggestedRoles && suggestedRoles.length > 0) {
        const mappedRoles = suggestedRoles.map((role: { title: string; rationale: string; quantity: number }, index: number) => ({
          id: `rec-${index + 1}`,
          name: role.title,
          description: role.rationale,
          icLevel: 'IC4' as const,
          baseSalary: 120000,
          quantity: role.quantity,
          fte: 1,
          storyPoints: 0,
          years: {
            base: true,
            option1: (metadata.periodOfPerformance?.options || 0) >= 1,
            option2: (metadata.periodOfPerformance?.options || 0) >= 2,
            option3: (metadata.periodOfPerformance?.options || 0) >= 3,
            option4: (metadata.periodOfPerformance?.options || 0) >= 4,
          },
          confidence: 'medium' as const,
        }))
        setRecommendedRoles(mappedRoles)
      }

      // Now generate the summary
      await generateSummary()

    } catch (error) {
      console.error('RFP extraction error:', error)
      setSummaryStatus('error')
      setSummaryError(error instanceof Error ? error.message : 'Failed to analyze document')
    }
  }

  // Generate AI summary
  const generateSummary = async () => {
    if (!proposalId) return

    setSummaryStatus('generating')
    setSummaryError(null)

    try {
      const response = await fetch(`/api/proposals/${proposalId}/generate-summary`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate summary')
      }

      // Convert API response to our format
      const newSummary: AISummary = {
        whatTheyWant: data.summary?.what_they_want || '',
        whyItMatters: data.summary?.why_it_matters || '',
        keyChallenges: data.summary?.key_challenges || [],
        evaluationEmphasis: typeof data.summary?.evaluation_emphasis === 'string'
          ? [data.summary.evaluation_emphasis]
          : data.summary?.evaluation_emphasis || [],
        fftcRelevance: data.summary?.fftc_relevance || null,
        keyDates: solicitation.proposalDueDate
          ? [{
              label: 'Proposal Due',
              value: new Date(solicitation.proposalDueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
              urgent: getDaysUntilDue(solicitation.proposalDueDate) !== null &&
                      getDaysUntilDue(solicitation.proposalDueDate)! < 14,
            }]
          : [],
        generatedAt: data.summary?.generated_at || new Date().toISOString(),
      }

      setSummary(newSummary)
      setSummaryStatus('complete')

      // Save to working_data
      if (proposalId) {
        try {
          const existingProposal = await proposalsApi.get(proposalId) as {
            proposal: { workingData?: Record<string, unknown> }
          }
          const existingWorkingData = existingProposal.proposal?.workingData || {}
          await proposalsApi.update(proposalId, {
            working_data: {
              ...existingWorkingData,
              solicitationSummary: newSummary,
            },
          })
        } catch (error) {
          console.warn('[Solicitation] Failed to save summary:', error)
        }
      }

    } catch (error) {
      console.error('Summary generation error:', error)
      setSummaryStatus('error')
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate summary')
    }
  }

  const handleReplace = () => {
    replaceInputRef.current?.click()
  }

  const handleReplaceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0 && files[0].type === 'application/pdf') {
      handleFileUpload(files[0])
    }
  }

  const handleDownload = () => {
    if (pdfState.url && pdfState.fileName) {
      const link = document.createElement('a')
      link.href = pdfState.url
      link.download = pdfState.fileName
      link.click()
    }
  }

  const handleRegenerate = () => {
    if (summary) {
      setShowRegenerateConfirm(true)
    } else {
      generateSummary()
    }
  }

  const handleConfirmRegenerate = () => {
    setShowRegenerateConfirm(false)
    generateSummary()
  }

  const handleRetry = () => {
    if (pdfState.file) {
      extractRFP(pdfState.file)
    } else {
      generateSummary()
    }
  }

  return (
    <>
      {/* Split screen container - fills parent via flex */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Left Panel - PDF Viewer */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
          <PDFViewer
            pdfState={pdfState}
            onFileUpload={handleFileUpload}
            onReplace={handleReplace}
            onDownload={handleDownload}
          />
        </div>

        {/* Divider */}
        <div
          className="w-full h-px lg:w-px lg:h-auto shrink-0"
          style={{ backgroundColor: '#E8E7E2' }}
        />

        {/* Right Panel - AI Summary */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ backgroundColor: '#FAFAF9' }}>
          <AISummaryPanel
            summary={summary}
            status={summaryStatus}
            error={summaryError}
            onRegenerate={handleRegenerate}
            onRetry={handleRetry}
            hasCompanyProfile={false}
          />
        </div>
      </div>

      {/* Hidden replace input */}
      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleReplaceSelect}
      />

      {/* Regenerate confirmation dialog */}
      <Dialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate summary?</DialogTitle>
            <DialogDescription>
              This will replace the existing summary. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRegenerate}>
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================================
// HELPERS
// ============================================================================

function mapContractType(type: string): 'FFP' | 'T&M' | 'CPFF' | 'IDIQ' {
  const mapping: Record<string, 'FFP' | 'T&M' | 'CPFF' | 'IDIQ'> = {
    'ffp': 'FFP',
    'tm': 'T&M',
    'cpff': 'CPFF',
    'idiq': 'IDIQ',
    'unknown': 'T&M',
  }
  return mapping[type?.toLowerCase()] || 'T&M'
}

function mapSetAside(setAside: string): string {
  const mapping: Record<string, string> = {
    'Small Business': 'small-business',
    'small-business': 'small-business',
    '8(a)': '8a',
    '8a': '8a',
    'HUBZone': 'hubzone',
    'hubzone': 'hubzone',
    'SDVOSB': 'sdvosb',
    'sdvosb': 'sdvosb',
    'WOSB': 'wosb',
    'wosb': 'wosb',
    'EDWOSB': 'edwosb',
    'edwosb': 'edwosb',
    'Full & Open': 'full-open',
    'full-open': 'full-open',
  }
  return mapping[setAside] || 'full-open'
}

function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const now = new Date()
  const diffTime = due.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export default Solicitation
