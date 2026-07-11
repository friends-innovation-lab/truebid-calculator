import { NextRequest, NextResponse } from 'next/server'
import { extractText } from 'unpdf'

// PDF text extraction only — AI processing moved to dedicated parallel routes:
//   /api/proposals/[id]/extract-requirements
//   /api/proposals/[id]/extract-compliance
//   /api/proposals/[id]/generate-summary

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { success: false, error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = new Uint8Array(bytes)

    let pdfText: string
    let pdfPageCount: number
    try {
      const { text, totalPages } = await extractText(buffer, { mergePages: true })
      pdfText = text
      pdfPageCount = totalPages
      console.log(`[extract-rfp] PDF has ${pdfPageCount} pages, ${pdfText.length} chars`)
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError)
      return NextResponse.json(
        { success: false, error: 'Failed to parse PDF. The file may be corrupted or password-protected.' },
        { status: 400 }
      )
    }

    if (pdfText.length < 100) {
      return NextResponse.json(
        { success: false, error: 'Could not extract sufficient text from PDF. It may be a scanned image.' },
        { status: 400 }
      )
    }

    // Truncate if too long
    const MAX_CHARS = 150000
    const text = pdfText.length > MAX_CHARS
      ? pdfText.substring(0, MAX_CHARS) + '\n\n[Document truncated due to length...]'
      : pdfText

    return NextResponse.json({
      success: true,
      text,
      pageCount: pdfPageCount,
      rawTextLength: pdfText.length,
    })

  } catch (error) {
    console.error('PDF extraction error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to extract text from PDF' },
      { status: 500 }
    )
  }
}
