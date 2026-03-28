// @ts-nocheck
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAppContext } from '@/contexts/app-context'
import { requirementsApi, proposalsApi } from '@/lib/api'
import { 
  Upload, 
  FileText, 
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2,
  Shield,
  MapPin,
  Pencil,
  RefreshCw,
} from 'lucide-react'
import { ErrorAlert } from '@/components/ui/error-alert'
import { contractTypeLabels, setAsideLabels } from '@/lib/solicitation-type'

// ==================== TYPES ====================
interface UploadTabProps {
  onContinue?: () => void
}

interface ExtractedMetadata {
  title: string
  solicitationNumber: string
  clientAgency: string
  contractType: 'ffp' | 'tm' | 'cpff' | 'idiq' | 'unknown'
  naicsCode: string
  responseDeadline: string
  periodOfPerformance: {
    base: number
    options: number
  }
  placeOfPerformance: string
  setAside: string
}

interface ExtractedRequirement {
  id: string
  text: string
  type: 'delivery' | 'reporting' | 'staffing' | 'compliance' | 'governance' | 'transition' | 'other'
  sourceSection: string
}

interface SuggestedRole {
  title: string
  quantity: number
  rationale: string
}

interface ExtractionResponse {
  success: boolean
  metadata: ExtractedMetadata
  requirements: ExtractedRequirement[]
  suggestedRoles: SuggestedRole[]
  rawTextLength: number
  solicitationRawText?: string
  error?: string
}

// ==================== HELPERS ====================

// Map API contract type to context format
const mapContractType = (type: string): 'FFP' | 'T&M' | 'CPFF' | 'IDIQ' => {
  const mapping: Record<string, 'FFP' | 'T&M' | 'CPFF' | 'IDIQ'> = {
    'ffp': 'FFP',
    'tm': 'T&M',
    'cpff': 'CPFF',
    'idiq': 'IDIQ',
    'unknown': 'T&M', // Default to T&M if unknown
  }
  return mapping[type.toLowerCase()] || 'T&M'
}

// Map set-aside to context format
const mapSetAside = (setAside: string): string => {
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

// ==================== COMPONENT ====================
export function UploadTab({ onContinue }: UploadTabProps) {
  const {
    updateSolicitation,
    setRecommendedRoles,
    solicitation,
    openSolicitationEditor,
    resetSolicitation,
    setExtractedRequirements,
  } = useAppContext()

  // Get proposal ID from URL for API calls
  const params = useParams()
  const proposalId = params?.id

  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'analyzing' | 'complete' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Expanded details view
  const [showDetails, setShowDetails] = useState(false)

  // ==================== RESTORE STATE FROM CONTEXT ON MOUNT ====================
  useEffect(() => {
    console.log('[Upload] useEffect running, proposalId:', proposalId)
    async function loadRequirements() {
      if (!proposalId) return
      console.log('[Upload] Loading requirements for', proposalId)
      try {
        const response = await requirementsApi.list(proposalId as string)
        if (response.requirements && response.requirements.length > 0) {
          console.log('[Upload] Requirements data:', response.requirements[0])
          setExtractedRequirements(response.requirements)
        }
      } catch (error) {
        console.warn('[UploadTab] Failed to load requirements:', error)
      }
    }
    loadRequirements()

    // If solicitation has data (was previously analyzed), restore the complete state
    if (solicitation.analyzedFromDocument && solicitation.solicitationNumber) {
      setUploadedFileName(solicitation.analyzedFromDocument)
      setState('complete')
      setShowDetails(true)
    }
  }, [proposalId])

  // Drag handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0 && files[0].type === 'application/pdf') {
      handleFileUpload(files[0])
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [])

  // File upload and analysis - NOW CALLS REAL API
  const handleFileUpload = async (file: File) => {
    setUploadedFileName(file.name)
    setState('analyzing')
    setProgress(0)
    setErrorMessage(null)

    // Progress animation interval
    let progressInterval: NodeJS.Timeout | null = null

    try {
      // Stage 1: Uploading
      setProgress(10)
      setProgressText('Uploading document...')
      
      const formData = new FormData()
      formData.append('file', file)

      // Stage 2: Processing - start animated progress
      setProgress(15)
      setProgressText('Extracting text from PDF...')
      
      // Animate progress from 15% to 85% over ~60 seconds
      let currentProgress = 15
      progressInterval = setInterval(() => {
        currentProgress += 0.5
        if (currentProgress >= 85) {
          currentProgress = 85
        }
        setProgress(Math.round(currentProgress))
        
        // Update text at milestones
        if (currentProgress >= 25 && currentProgress < 50) {
          setProgressText('AI analyzing requirements...')
        } else if (currentProgress >= 50 && currentProgress < 75) {
          setProgressText('Extracting metadata and roles...')
        } else if (currentProgress >= 75) {
          setProgressText('Finalizing extraction...')
        }
      }, 500) // Update every 500ms

      const response = await fetch('/api/extract-rfp', {
        method: 'POST',
        body: formData,
      })

      // Clear the interval once we get a response
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }

      // Stage 3: Processing response
      setProgress(90)
      setProgressText('Processing results...')

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Upload failed: ${response.status}`)
      }

      const data: ExtractionResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Extraction failed')
      }

      // Stage 4: Finalizing
      setProgress(95)
      setProgressText('Updating workspace...')

      // Map API response to context format
      const { metadata, requirements, suggestedRoles } = data

      // Update solicitation in context
      updateSolicitation({
        solicitationNumber: metadata.solicitationNumber !== 'N/A' ? metadata.solicitationNumber : '',
        title: metadata.title,
        clientAgency: metadata.clientAgency !== 'N/A' ? metadata.clientAgency : '',
        contractType: mapContractType(metadata.contractType),
        naicsCode: metadata.naicsCode !== 'N/A' ? metadata.naicsCode : '',
        proposalDueDate: metadata.responseDeadline !== 'N/A' ? metadata.responseDeadline : '',
        periodOfPerformance: {
          baseYear: true,
          optionYears: metadata.periodOfPerformance.options,
        },
        setAside: mapSetAside(metadata.setAside),
        placeOfPerformance: {
          type: metadata.placeOfPerformance?.toLowerCase().includes('remote') 
            ? 'remote' as const
            : metadata.placeOfPerformance?.toLowerCase().includes('hybrid')
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

      // Store extracted requirements for Estimate tab
      if (setExtractedRequirements && requirements.length > 0) {
        setExtractedRequirements(requirements)

        // Also save to API if we have a proposal ID
        if (proposalId) {
          try {
            await requirementsApi.create(proposalId as string, requirements)
            console.log('[Upload] Saved requirements to API')
          } catch (error) {
            console.warn('[Upload] Failed to save requirements to API:', error)
            // Continue anyway - localStorage backup will handle this
          }
        }
      }

      // Update proposal in Supabase with extracted metadata
      if (proposalId) {
        try {
          await proposalsApi.update(proposalId as string, {
            title: metadata.title,
            agency: metadata.clientAgency !== 'N/A' ? metadata.clientAgency : null,
            solicitation: metadata.solicitationNumber !== 'N/A' ? metadata.solicitationNumber : null,
            contractType: mapContractType(metadata.contractType).toLowerCase(),
            dueDate: metadata.responseDeadline !== 'N/A' ? metadata.responseDeadline : null,
            periodOfPerformance: `1 Base + ${metadata.periodOfPerformance.options} Options`,
          })
          console.log('[Upload] Updated proposal with extracted metadata')

          // Save raw text to working_data for compliance matrix Section L extraction
          // This is done separately to merge with existing working_data
          if (data.solicitationRawText) {
            try {
              const existingProposal = await proposalsApi.get(proposalId as string) as {
                proposal: { workingData?: Record<string, unknown> }
              }
              const existingWorkingData = existingProposal.proposal?.workingData || {}
              await proposalsApi.update(proposalId as string, {
                working_data: {
                  ...existingWorkingData,
                  solicitationRawText: data.solicitationRawText,
                },
              })
              console.log('[Upload] Saved raw text for Section L extraction')
            } catch (rawTextError) {
              console.warn('[Upload] Failed to save raw text:', rawTextError)
            }
          }
        } catch (error) {
          console.warn('[Upload] Failed to update proposal:', error)
        }
      }

      // Map suggested roles to recommended roles format
      if (suggestedRoles.length > 0) {
        const mappedRoles = suggestedRoles.map((role, index) => ({
          id: `rec-${index + 1}`,
          name: role.title,
          description: role.rationale,
          icLevel: 'IC4' as const, // Default to IC4, user can adjust
          baseSalary: 120000, // Default salary, will be overridden by Account Center
          quantity: role.quantity,
          fte: 1,
          storyPoints: 0,
          years: { 
            base: true, 
            option1: metadata.periodOfPerformance.options >= 1,
            option2: metadata.periodOfPerformance.options >= 2,
            option3: metadata.periodOfPerformance.options >= 3,
            option4: metadata.periodOfPerformance.options >= 4,
          },
          confidence: 'medium' as const,
        }))
        setRecommendedRoles(mappedRoles)
      }

      // Complete
      setProgress(100)
      setProgressText('Complete!')
      
      await new Promise(resolve => setTimeout(resolve, 500)) // Brief pause to show completion
      
      setState('complete')
      setShowDetails(true)

    } catch (error) {
      // Clear progress interval if still running
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      console.error('Upload/extraction error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to analyze document')
      setState('error')
    }
  }

  const handleReset = () => {
    // Reset local state
    setUploadedFileName(null)
    setState('idle')
    setProgress(0)
    setProgressText('')
    setShowDetails(false)
    setErrorMessage(null)
    
    // Reset context
    resetSolicitation()
  }

  const handleRetry = () => {
    setState('idle')
    setErrorMessage(null)
  }

  const handleContinue = () => {
    if (onContinue) {
      onContinue()
    }
  }

  // ==================== RENDER ====================
  return (
    <div className="max-w-xl mx-auto py-12">
      {/* ==================== IDLE STATE ==================== */}
      {state === 'idle' && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Upload RFP</h1>
            <p className="text-sm text-gray-600">
              Upload your solicitation document to extract details automatically
            </p>
          </div>

          {/* Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer
              ${isDragging 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            
            <div className="space-y-3">
              <div className={`
                w-12 h-12 rounded-lg mx-auto flex items-center justify-center transition-colors
                ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}
              `}>
                <Upload className={`w-6 h-6 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Drop your RFP here
                </p>
                <p className="text-xs text-gray-500">
                  or click to browse • PDF up to 10MB
                </p>
              </div>
            </div>
          </div>

          {/* Previous file indicator */}
          {uploadedFileName && (
            <p className="text-xs text-gray-500 text-center">
              Previously uploaded: {uploadedFileName}
            </p>
          )}
        </div>
      )}

      {/* ==================== ANALYZING STATE ==================== */}
      {state === 'analyzing' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-lg bg-blue-50 mx-auto flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-blue-600 animate-pulse" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Analyzing RFP</h1>
            <p className="text-sm text-gray-600">{progressText}</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center">{progress}%</p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <FileText className="w-3.5 h-3.5" />
            <span>{uploadedFileName}</span>
          </div>

          <p className="text-xs text-gray-400 text-center">
            This may take 10-30 seconds depending on document size
          </p>
        </div>
      )}

      {/* ==================== ERROR STATE ==================== */}
      {state === 'error' && (
        <div className="space-y-6">
          <ErrorAlert
            variant="page"
            title="Analysis Failed"
            message={errorMessage || 'An unexpected error occurred'}
            onRetry={handleRetry}
          />

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <FileText className="w-3.5 h-3.5" />
            <span>{uploadedFileName}</span>
          </div>

          <div className="flex items-center justify-center">
            <Button variant="outline" onClick={handleReset}>
              Upload Different File
            </Button>
          </div>
        </div>
      )}

      {/* ==================== COMPLETE STATE ==================== */}
      {state === 'complete' && (
        <div className="space-y-6">
          {/* Extracted Summary - Collapsible */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Collapsed Header */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {solicitation.solicitationNumber || 'No solicitation number'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {solicitation.clientAgency || 'Unknown agency'} • 1 Base + {solicitation.periodOfPerformance?.optionYears ?? 0} Options
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {showDetails ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            {/* Expanded Details */}
            {showDetails && (
              <div className="px-4 py-4 border-t border-gray-200 space-y-4">
                {/* Title */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Title</p>
                  <p className="text-sm text-gray-900">{solicitation.title || 'Untitled'}</p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Agency</p>
                      <p className="text-sm text-gray-900">{solicitation.clientAgency || 'Not specified'}</p>
                      {solicitation.subAgency && (
                        <p className="text-xs text-gray-500">{solicitation.subAgency}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Proposal Due</p>
                      <p className="text-sm text-gray-900">
                        {solicitation.proposalDueDate 
                          ? new Date(solicitation.proposalDueDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })
                          : 'Not specified'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Contract Type</p>
                      <p className="text-sm text-gray-900">
                        {solicitation.contractType || 'Not specified'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Location</p>
                      <p className="text-sm text-gray-900 capitalize">
                        {solicitation.placeOfPerformance?.type || 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {solicitation.naicsCode && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-gray-200 text-gray-700">
                      NAICS: {solicitation.naicsCode}
                    </span>
                  )}
                  {solicitation.setAside && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                      {setAsideLabels[solicitation.setAside] || solicitation.setAside}
                    </span>
                  )}
                </div>

                {/* Edit Button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); openSolicitationEditor(); }}
                  className="w-full"
                >
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Edit Details
                </Button>
              </div>
            )}
          </div>

{/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Start over
            </button>

            <Button onClick={handleContinue}>
              Continue to Estimate
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UploadTab