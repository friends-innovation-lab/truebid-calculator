// @ts-nocheck
'use client'

import React, { useState, useMemo } from 'react'
import { useApp } from '@/contexts/app-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ListTree,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  Copy,
  Wand2,
  RefreshCw,
  GripVertical
} from 'lucide-react'

// ==================== TYPES ====================

interface DecomposedTask {
  id: string
  name: string
  description?: string
  suggestedRole?: string
  suggestedHoursMin?: number
  suggestedHoursMax?: number
  complexity: 'simple' | 'moderate' | 'complex'
  dependencies?: string[]
  isSelected: boolean
  aiGenerated: boolean
  confidence?: 'high' | 'medium' | 'low'
}

interface Epic {
  id: string
  title: string
  description: string
  pwsReferences: string[]
  technicalDetails?: {
    stack?: string[]
    constraints?: string[]
    integrations?: string[]
    compliance?: string[]
  }
  acceptanceCriteria?: string[]
}

// ==================== TASK TEMPLATES ====================

const TASK_TEMPLATES: Record<string, DecomposedTask[]> = {
  authentication: [
    { id: 't1', name: 'Authentication Architecture Design', description: 'Design auth flow, token management, session handling', suggestedRole: 'Technical Lead', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't2', name: 'SSO Integration Implementation', description: 'Implement OKTA/Cognito integration with token refresh', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 40, suggestedHoursMax: 80, complexity: 'complex', isSelected: true, aiGenerated: false },
    { id: 't3', name: 'RBAC Implementation', description: 'Role-based access control with permission checks', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't4', name: 'Session Management', description: 'Timeout handling, concurrent session limits', suggestedRole: 'Software Engineer', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't5', name: 'Security Testing', description: 'Penetration testing, role escalation testing', suggestedRole: 'QA Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't6', name: 'Auth Documentation', description: 'Security architecture docs, integration guides', suggestedRole: 'Technical Lead', suggestedHoursMin: 8, suggestedHoursMax: 16, complexity: 'simple', isSelected: true, aiGenerated: false },
  ],
  'user-interface': [
    { id: 't1', name: 'UI/UX Design', description: 'Wireframes, mockups, design system application', suggestedRole: 'Design Lead', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't2', name: 'Component Development', description: 'Build reusable UI components', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 40, suggestedHoursMax: 80, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't3', name: 'Form Implementation', description: 'Form validation, error handling, submission', suggestedRole: 'Software Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't4', name: 'Responsive Design', description: 'Mobile/tablet layouts, breakpoint testing', suggestedRole: 'Software Engineer', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'simple', isSelected: true, aiGenerated: false },
    { id: 't5', name: 'Accessibility Implementation', description: 'WCAG 2.2 compliance, screen reader testing', suggestedRole: 'Design Lead', suggestedHoursMin: 16, suggestedHoursMax: 32, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't6', name: 'UI Testing', description: 'Visual regression, cross-browser testing', suggestedRole: 'QA Engineer', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'simple', isSelected: true, aiGenerated: false },
  ],
  'api-integration': [
    { id: 't1', name: 'API Analysis & Design', description: 'Review API docs, design integration approach', suggestedRole: 'Technical Lead', suggestedHoursMin: 8, suggestedHoursMax: 16, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't2', name: 'API Client Implementation', description: 'Build API client with error handling, retries', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't3', name: 'Data Mapping & Transformation', description: 'Map external data to internal models', suggestedRole: 'Software Engineer', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't4', name: 'Error Handling & Fallbacks', description: 'Graceful degradation, circuit breakers', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't5', name: 'Integration Testing', description: 'End-to-end testing, mock services', suggestedRole: 'QA Engineer', suggestedHoursMin: 16, suggestedHoursMax: 32, complexity: 'moderate', isSelected: true, aiGenerated: false },
  ],
  'data-migration': [
    { id: 't1', name: 'Data Analysis & Mapping', description: 'Analyze source data, create mapping docs', suggestedRole: 'Technical Lead', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't2', name: 'Migration Script Development', description: 'ETL scripts, transformation logic', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 40, suggestedHoursMax: 80, complexity: 'complex', isSelected: true, aiGenerated: false },
    { id: 't3', name: 'Data Validation Rules', description: 'Validation logic, quality checks', suggestedRole: 'Software Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't4', name: 'Dry Run & Testing', description: 'Test migrations, verify data integrity', suggestedRole: 'QA Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't5', name: 'Rollback Procedures', description: 'Design and test rollback capability', suggestedRole: 'DevOps Engineer', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't6', name: 'Production Migration Execution', description: 'Execute migration, monitor, verify', suggestedRole: 'Technical Lead', suggestedHoursMin: 16, suggestedHoursMax: 32, complexity: 'moderate', isSelected: true, aiGenerated: false },
  ],
  'reporting': [
    { id: 't1', name: 'Requirements & Metrics Definition', description: 'Define KPIs, data sources, calculations', suggestedRole: 'Product Manager', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't2', name: 'Dashboard Design', description: 'UI design for charts, filters, drill-downs', suggestedRole: 'Design Lead', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't3', name: 'Data Warehouse/ETL', description: 'Data pipeline for reporting', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 40, suggestedHoursMax: 80, complexity: 'complex', isSelected: true, aiGenerated: false },
    { id: 't4', name: 'Chart Components', description: 'Build visualization components', suggestedRole: 'Software Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't5', name: 'Export Functionality', description: 'PDF/Excel export capability', suggestedRole: 'Software Engineer', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'simple', isSelected: true, aiGenerated: false },
    { id: 't6', name: 'Performance Optimization', description: 'Caching, query optimization', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 16, suggestedHoursMax: 32, complexity: 'moderate', isSelected: true, aiGenerated: false },
  ],
  'transition': [
    { id: 't1', name: 'Knowledge Transfer Sessions', description: 'Meetings with incumbent, documentation review', suggestedRole: 'Technical Lead', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't2', name: 'Codebase Review & Analysis', description: 'Understand architecture, identify gaps', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 40, suggestedHoursMax: 80, complexity: 'complex', isSelected: true, aiGenerated: false },
    { id: 't3', name: 'Environment Setup', description: 'Dev/test environment configuration', suggestedRole: 'DevOps Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't4', name: 'CI/CD Pipeline Verification', description: 'Verify and update build/deploy pipelines', suggestedRole: 'DevOps Engineer', suggestedHoursMin: 16, suggestedHoursMax: 32, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't5', name: 'Documentation Gap Analysis', description: 'Identify missing docs, create backlog', suggestedRole: 'Technical Lead', suggestedHoursMin: 8, suggestedHoursMax: 16, complexity: 'simple', isSelected: true, aiGenerated: false },
    { id: 't6', name: 'System Validation', description: 'Verify system functionality post-transfer', suggestedRole: 'QA Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
  ],
  'compliance': [
    { id: 't1', name: 'Compliance Requirements Analysis', description: 'Review regulations, identify requirements', suggestedRole: 'Technical Lead', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't2', name: 'Gap Assessment', description: 'Compare current state to requirements', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't3', name: 'Remediation Implementation', description: 'Fix identified gaps', suggestedRole: 'Senior Software Engineer', suggestedHoursMin: 40, suggestedHoursMax: 80, complexity: 'complex', isSelected: true, aiGenerated: false },
    { id: 't4', name: 'Documentation & Evidence', description: 'Create compliance documentation', suggestedRole: 'Technical Lead', suggestedHoursMin: 16, suggestedHoursMax: 32, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't5', name: 'Compliance Testing', description: 'Verify compliance requirements met', suggestedRole: 'QA Engineer', suggestedHoursMin: 24, suggestedHoursMax: 40, complexity: 'moderate', isSelected: true, aiGenerated: false },
    { id: 't6', name: 'Audit Preparation', description: 'Prepare for external audit/review', suggestedRole: 'Product Manager', suggestedHoursMin: 16, suggestedHoursMax: 24, complexity: 'moderate', isSelected: true, aiGenerated: false },
  ],
}

// ==================== HELPER FUNCTIONS ====================

const getComplexityColor = (complexity: string) => {
  switch (complexity) {
    case 'simple': return 'bg-green-50 text-green-700 border-green-200'
    case 'moderate': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    case 'complex': return 'bg-red-50 text-red-700 border-red-200'
    default: return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

const detectEpicType = (epic: Epic): string => {
  const titleLower = epic.title.toLowerCase()
  const descLower = epic.description.toLowerCase()
  
  if (titleLower.includes('auth') || descLower.includes('sso') || descLower.includes('login')) {
    return 'authentication'
  }
  if (titleLower.includes('transition') || descLower.includes('knowledge transfer') || descLower.includes('incumbent')) {
    return 'transition'
  }
  if (titleLower.includes('migration') || descLower.includes('data migration') || descLower.includes('legacy')) {
    return 'data-migration'
  }
  if (titleLower.includes('dashboard') || titleLower.includes('report') || descLower.includes('metrics')) {
    return 'reporting'
  }
  if (titleLower.includes('integration') || descLower.includes('api') || descLower.includes('integrate')) {
    return 'api-integration'
  }
  if (titleLower.includes('508') || titleLower.includes('compliance') || descLower.includes('fedramp') || descLower.includes('wcag')) {
    return 'compliance'
  }
  if (titleLower.includes('scheduling') || titleLower.includes('portal') || titleLower.includes('ui') || descLower.includes('interface')) {
    return 'user-interface'
  }
  
  return 'user-interface' // default
}

// ==================== MAIN COMPONENT ====================

interface TaskDecompositionProps {
  epic: Epic
  onClose: () => void
  onApplyTasks: (tasks: { name: string; roleId: string; roleName: string; hours: number; rationale: string; confidence: string }[]) => void
}

export default function TaskDecomposition({ epic, onClose, onApplyTasks }: TaskDecompositionProps) {
  const { teamRoles } = useApp()
  
  // Detect epic type and get initial tasks
  const epicType = detectEpicType(epic)
  const initialTasks = TASK_TEMPLATES[epicType] || TASK_TEMPLATES['user-interface']
  
  // State
  const [tasks, setTasks] = useState<DecomposedTask[]>(
    initialTasks.map(t => ({ ...t, id: `task-${Math.random().toString(36).substr(2, 9)}` }))
  )
  const [selectedTemplate, setSelectedTemplate] = useState(epicType)
  const [isAddingCustom, setIsAddingCustom] = useState(false)
  const [customTask, setCustomTask] = useState({
    name: '',
    description: '',
    suggestedRole: '',
    hours: '',
    complexity: 'moderate' as const
  })
  
  // Calculate totals
  const totals = useMemo(() => {
    const selected = tasks.filter(t => t.isSelected)
    const minHours = selected.reduce((sum, t) => sum + (t.suggestedHoursMin || 0), 0)
    const maxHours = selected.reduce((sum, t) => sum + (t.suggestedHoursMax || 0), 0)
    return { selected: selected.length, total: tasks.length, minHours, maxHours }
  }, [tasks])
  
  // Handlers
  const handleTemplateChange = (template: string) => {
    setSelectedTemplate(template)
    const newTasks = TASK_TEMPLATES[template] || []
    setTasks(newTasks.map(t => ({ ...t, id: `task-${Math.random().toString(36).substr(2, 9)}` })))
  }
  
  const toggleTaskSelection = (taskId: string) => {
    setTasks(tasks.map(t => 
      t.id === taskId ? { ...t, isSelected: !t.isSelected } : t
    ))
  }
  
  const removeTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId))
  }
  
  const addCustomTask = () => {
    if (!customTask.name) return
    
    const hours = parseInt(customTask.hours) || 24
    const newTask: DecomposedTask = {
      id: `task-${Math.random().toString(36).substr(2, 9)}`,
      name: customTask.name,
      description: customTask.description,
      suggestedRole: customTask.suggestedRole,
      suggestedHoursMin: Math.round(hours * 0.75),
      suggestedHoursMax: Math.round(hours * 1.25),
      complexity: customTask.complexity,
      isSelected: true,
      aiGenerated: false
    }
    
    setTasks([...tasks, newTask])
    setCustomTask({ name: '', description: '', suggestedRole: '', hours: '', complexity: 'moderate' })
    setIsAddingCustom(false)
  }
  
  const handleApply = () => {
    const selectedTasks = tasks.filter(t => t.isSelected)
    
    const formattedTasks = selectedTasks.map(task => {
      // Find role by name
      const role = teamRoles.find(r => 
        r.title.toLowerCase().includes(task.suggestedRole?.toLowerCase() || '') ||
        task.suggestedRole?.toLowerCase().includes(r.title.toLowerCase())
      )
      
      // Use midpoint of range as default
      const hours = task.suggestedHoursMin && task.suggestedHoursMax 
        ? Math.round((task.suggestedHoursMin + task.suggestedHoursMax) / 2)
        : 24
      
      return {
        name: task.name,
        roleId: role?.id || '',
        roleName: role?.title || task.suggestedRole || 'TBD',
        hours,
        rationale: task.description || '',
        confidence: task.complexity === 'simple' ? 'high' : task.complexity === 'complex' ? 'low' : 'medium'
      }
    })
    
    onApplyTasks(formattedTasks)
    onClose()
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ListTree className="w-5 h-5 text-purple-600" />
                Task Decomposition
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Break &quot;{epic.title}&quot; into estimable tasks
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>
        
        {/* Template Selection */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Label className="text-sm text-gray-600">Start from template:</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger className="w-[200px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="authentication">Authentication</SelectItem>
                <SelectItem value="user-interface">User Interface</SelectItem>
                <SelectItem value="api-integration">API Integration</SelectItem>
                <SelectItem value="data-migration">Data Migration</SelectItem>
                <SelectItem value="reporting">Reporting/Dashboard</SelectItem>
                <SelectItem value="transition">Transition/Onboarding</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              Detected: {epicType}
            </Badge>
          </div>
        </div>
        
        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {tasks.map((task, index) => (
              <div
                key={task.id}
                className={`group border rounded-lg p-3 transition-all ${
                  task.isSelected 
                    ? 'border-blue-300 bg-blue-50/50' 
                    : 'border-gray-200 bg-white opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={task.isSelected}
                    onCheckedChange={() => toggleTaskSelection(task.id)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900">{task.name}</span>
                      <Badge variant="outline" className={`${getComplexityColor(task.complexity)} text-[10px]`}>
                        {task.complexity}
                      </Badge>
                      {task.aiGenerated && (
                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                          <Sparkles className="w-2.5 h-2.5 mr-1" />
                          AI
                        </Badge>
                      )}
                    </div>
                    
                    {task.description && (
                      <p className="text-xs text-gray-600 mb-2">{task.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {task.suggestedRole && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {task.suggestedRole}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {task.suggestedHoursMin}-{task.suggestedHoursMax} hours
                      </span>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                    onClick={() => removeTask(task.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Add Custom Task */}
            {isAddingCustom ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Task Name</Label>
                      <Input
                        value={customTask.name}
                        onChange={(e) => setCustomTask({ ...customTask, name: e.target.value })}
                        placeholder="e.g. API Error Handling"
                        className="h-8 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Suggested Role</Label>
                      <Input
                        value={customTask.suggestedRole}
                        onChange={(e) => setCustomTask({ ...customTask, suggestedRole: e.target.value })}
                        placeholder="e.g. Senior Software Engineer"
                        className="h-8 mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Estimated Hours</Label>
                      <Input
                        type="number"
                        value={customTask.hours}
                        onChange={(e) => setCustomTask({ ...customTask, hours: e.target.value })}
                        placeholder="e.g. 24"
                        className="h-8 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Complexity</Label>
                      <Select 
                        value={customTask.complexity} 
                        onValueChange={(v: 'simple' | 'moderate' | 'complex') => setCustomTask({ ...customTask, complexity: v })}
                      >
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simple">Simple</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="complex">Complex</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Description (optional)</Label>
                    <Input
                      value={customTask.description}
                      onChange={(e) => setCustomTask({ ...customTask, description: e.target.value })}
                      placeholder="Brief description of the task"
                      className="h-8 mt-1"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={addCustomTask}>
                      Add Task
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsAddingCustom(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingCustom(true)}
                className="w-full border border-dashed border-gray-300 rounded-lg p-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Custom Task
              </button>
            )}
          </div>
        </div>
        
        {/* Info Box */}
        <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-800">
              <strong>Hour ranges are suggestions only.</strong> After applying, you&apos;ll refine each task&apos;s
              hours based on your team&apos;s experience and add rationale for audit defense.
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{totals.selected}</span> of {totals.total} tasks selected
              <span className="mx-2">·</span>
              <span className="font-medium">{totals.minHours}-{totals.maxHours}</span> estimated hours
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={totals.selected === 0}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Apply {totals.selected} Tasks
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== TRIGGER BUTTON COMPONENT ====================

interface DecomposeButtonProps {
  epic: Epic
  onApplyTasks: (tasks: { name: string; roleId: string; roleName: string; hours: number; rationale: string; confidence: string }[]) => void
}

export function DecomposeButton({ epic, onApplyTasks }: DecomposeButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(true)}
              className="h-8"
            >
              <Wand2 className="w-4 h-4 mr-1.5" />
              Decompose
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">Break this epic into estimable tasks</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {isOpen && (
        <TaskDecomposition
          epic={epic}
          onClose={() => setIsOpen(false)}
          onApplyTasks={onApplyTasks}
        />
      )}
    </>
  )
}