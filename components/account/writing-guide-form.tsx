'use client'

import React, { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { SaveStatus } from '@/components/ui/save-status'
import { X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ==================== TYPES ====================

export interface WritingGuide {
  voice_description: string
  reading_level: string
  sentence_rules: string[]
  words_to_avoid: string[]
  words_to_use: string[]
  structural_rules: string[]
  example_sentences: string
}

export const defaultWritingGuide: WritingGuide = {
  voice_description: '',
  reading_level: 'grade-10-11',
  sentence_rules: [
    'Use active voice always',
    'Keep sentences under 25 words',
    'Lead with the government\'s need, then the solution',
  ],
  words_to_avoid: [
    'robust',
    'leverage',
    'cutting-edge',
    'best-in-class',
    'seamlessly',
    'synergy',
  ],
  words_to_use: [],
  structural_rules: [
    'Open each section by restating the requirement',
    'End each section with a summary of key benefits',
  ],
  example_sentences: '',
}

const READING_LEVELS = [
  { value: 'grade-8-9', label: 'Grade 8-9 (Simple)' },
  { value: 'grade-10-11', label: 'Grade 10-11 (Standard)' },
  { value: 'grade-12+', label: 'Grade 12+ (Technical)' },
]

// ==================== TAG INPUT COMPONENT ====================

export interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function TagInput({ tags, onChange, placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = () => {
    const value = inputValue.trim()
    if (value && !tags.includes(value)) {
      onChange([...tags, value])
      setInputValue('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  const handleBlur = () => {
    addTag()
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove))
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 min-h-[42px] border border-gray-200 rounded-md bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="flex items-center gap-1 px-2 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(tag)
            }}
            className="ml-0.5 hover:text-red-600"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
      />
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

interface WritingGuideFormProps {
  initialGuide?: WritingGuide
  onSave: (guide: WritingGuide) => Promise<void>
}

export function WritingGuideForm({ initialGuide, onSave }: WritingGuideFormProps) {
  const [guide, setGuide] = useState<WritingGuide>(initialGuide || defaultWritingGuide)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true)

  // Update guide when initialGuide prop changes
  useEffect(() => {
    if (initialGuide) {
      setGuide({
        ...defaultWritingGuide,
        ...initialGuide,
      })
    }
  }, [initialGuide])

  // Auto-save when guide changes (debounced)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    setSaveStatus('saving')
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        await onSave(guide)
        setSaveStatus('saved')
      } catch (err) {
        console.error('[WritingGuideForm] Save error:', err)
        setSaveStatus('error')
      }
    }, 1000)

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [guide, onSave])

  const updateField = <K extends keyof WritingGuide>(field: K, value: WritingGuide[K]) => {
    setGuide(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Card className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Proposal Writing Guide</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Defines how AI drafts and coaches your proposal content
          </p>
        </div>
        <SaveStatus status={saveStatus} />
      </div>

      {/* Voice & Tone */}
      <div className="space-y-2">
        <Label htmlFor="voice">Voice & Tone</Label>
        <Textarea
          id="voice"
          value={guide.voice_description}
          onChange={(e) => updateField('voice_description', e.target.value)}
          placeholder="Describe your company's voice. How should the writing sound? Confident, direct, government-savvy..."
          rows={3}
        />
      </div>

      {/* Reading Level */}
      <div className="space-y-2">
        <Label>Reading Level</Label>
        <Select
          value={guide.reading_level}
          onValueChange={(value) => updateField('reading_level', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select reading level" />
          </SelectTrigger>
          <SelectContent>
            {READING_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sentence Rules */}
      <div className="space-y-2">
        <Label>Sentence Rules</Label>
        <TagInput
          tags={guide.sentence_rules}
          onChange={(tags) => updateField('sentence_rules', tags)}
          placeholder="Type a rule and press Enter..."
        />
        <p className="text-xs text-gray-500">
          Press Enter or comma to add a rule. Examples: &quot;Use active voice&quot;, &quot;Keep sentences under 25 words&quot;
        </p>
      </div>

      {/* Words to Avoid */}
      <div className="space-y-2">
        <Label>Words to Avoid</Label>
        <TagInput
          tags={guide.words_to_avoid}
          onChange={(tags) => updateField('words_to_avoid', tags)}
          placeholder="Type a word and press Enter..."
        />
        <p className="text-xs text-gray-500">
          Common buzzwords and jargon to avoid in proposals
        </p>
      </div>

      {/* Words to Use */}
      <div className="space-y-2">
        <Label>Words to Use</Label>
        <TagInput
          tags={guide.words_to_use}
          onChange={(tags) => updateField('words_to_use', tags)}
          placeholder="Add your company's preferred language..."
        />
        <p className="text-xs text-gray-500">
          Preferred terminology and language for your proposals
        </p>
      </div>

      {/* Structural Rules */}
      <div className="space-y-2">
        <Label>Structural Rules</Label>
        <TagInput
          tags={guide.structural_rules}
          onChange={(tags) => updateField('structural_rules', tags)}
          placeholder="Type a rule and press Enter..."
        />
        <p className="text-xs text-gray-500">
          Rules for how sections should be organized
        </p>
      </div>

      {/* Example Sentences */}
      <div className="space-y-2">
        <Label htmlFor="examples">Example Sentences</Label>
        <Textarea
          id="examples"
          value={guide.example_sentences}
          onChange={(e) => updateField('example_sentences', e.target.value)}
          placeholder="Paste 3-4 sentences from past proposals that sound like your company at its best. AI will use these as style references."
          rows={4}
        />
      </div>
    </Card>
  )
}

export default WritingGuideForm
