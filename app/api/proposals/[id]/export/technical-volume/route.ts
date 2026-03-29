import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak,
  AlignmentType,
  convertInchesToTwip,
} from 'docx'

// ==================== TYPES ====================

interface TipTapNode {
  type: string
  content?: TipTapNode[]
  text?: string
  attrs?: Record<string, unknown>
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

interface Section {
  id: string
  parent_id: string | null
  sort_order: number
  section_number: string | null
  title: string
  content: TipTapNode | null
  content_text: string | null
  status: string
}

// InDesign paragraph style names - must match exactly
const STYLES = {
  P: 'P',
  H1: 'H1',
  H2: 'H2',
  H3: 'H3',
  BULLETS: 'Bullets',
  NUMBERS: 'Numbers',
  PAGE_HEADER: 'Page Header',
  TABLE_TEXT: 'Table Text',
}

// ==================== TIPTAP TO DOCX CONVERSION ====================

function convertTipTapToDocx(
  node: TipTapNode,
  paragraphs: Paragraph[],
  listContext?: { type: 'bullet' | 'ordered'; index: number }
): void {
  if (!node) return

  switch (node.type) {
    case 'doc':
      // Process all children
      if (node.content) {
        for (const child of node.content) {
          convertTipTapToDocx(child, paragraphs)
        }
      }
      break

    case 'paragraph':
      const textRuns = extractTextRuns(node)
      if (textRuns.length > 0 || !listContext) {
        paragraphs.push(
          new Paragraph({
            children: textRuns,
            style: listContext
              ? listContext.type === 'bullet'
                ? STYLES.BULLETS
                : STYLES.NUMBERS
              : STYLES.P,
          })
        )
      }
      break

    case 'heading':
      const level = (node.attrs?.level as number) || 2
      const headingRuns = extractTextRuns(node)
      paragraphs.push(
        new Paragraph({
          children: headingRuns,
          style: level === 2 ? STYLES.H2 : STYLES.H3,
          heading: level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
        })
      )
      break

    case 'bulletList':
      if (node.content) {
        for (const listItem of node.content) {
          if (listItem.type === 'listItem' && listItem.content) {
            for (const child of listItem.content) {
              convertTipTapToDocx(child, paragraphs, { type: 'bullet', index: 0 })
            }
          }
        }
      }
      break

    case 'orderedList':
      if (node.content) {
        let index = 1
        for (const listItem of node.content) {
          if (listItem.type === 'listItem' && listItem.content) {
            for (const child of listItem.content) {
              convertTipTapToDocx(child, paragraphs, { type: 'ordered', index })
            }
            index++
          }
        }
      }
      break

    case 'text':
      // Text nodes are handled in extractTextRuns
      break

    default:
      // For unknown node types, try to process children
      if (node.content) {
        for (const child of node.content) {
          convertTipTapToDocx(child, paragraphs, listContext)
        }
      }
      break
  }
}

function extractTextRuns(node: TipTapNode): TextRun[] {
  const runs: TextRun[] = []

  if (node.content) {
    for (const child of node.content) {
      if (child.type === 'text' && child.text) {
        const options: {
          text: string
          bold?: boolean
          italics?: boolean
        } = { text: child.text }

        // Apply marks (bold, italic, etc.)
        if (child.marks) {
          for (const mark of child.marks) {
            if (mark.type === 'bold') options.bold = true
            if (mark.type === 'italic') options.italics = true
          }
        }

        runs.push(new TextRun(options))
      } else if (child.content) {
        // Recursively extract text from nested nodes
        runs.push(...extractTextRuns(child))
      }
    }
  }

  return runs
}

// ==================== DOCUMENT BUILDER ====================

function buildDocument(
  sections: Section[],
  proposalTitle: string
): Document {
  const paragraphs: Paragraph[] = []

  // Build section tree
  const rootSections = sections
    .filter(s => !s.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)

  const getChildren = (parentId: string) =>
    sections
      .filter(s => s.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)

  let isFirstSection = true

  for (const section of rootSections) {
    // Page break before each top-level section (except first)
    if (!isFirstSection) {
      paragraphs.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      )
    }
    isFirstSection = false

    // Section title as H1
    const sectionTitle = section.section_number
      ? `${section.section_number} ${section.title}`
      : section.title

    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: sectionTitle, bold: true })],
        style: STYLES.H1,
        heading: HeadingLevel.HEADING_1,
      })
    )

    // Section content
    if (section.content) {
      convertTipTapToDocx(section.content as TipTapNode, paragraphs)
    }

    // Process subsections
    const subsections = getChildren(section.id)
    for (const subsection of subsections) {
      // Subsection title as H2
      const subsectionTitle = subsection.section_number
        ? `${subsection.section_number} ${subsection.title}`
        : subsection.title

      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: subsectionTitle, bold: true })],
          style: STYLES.H2,
          heading: HeadingLevel.HEADING_2,
        })
      )

      // Subsection content
      if (subsection.content) {
        convertTipTapToDocx(subsection.content as TipTapNode, paragraphs)
      }

      // Process sub-subsections
      const subsubsections = getChildren(subsection.id)
      for (const subsubsection of subsubsections) {
        const subsubTitle = subsubsection.section_number
          ? `${subsubsection.section_number} ${subsubsection.title}`
          : subsubsection.title

        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: subsubTitle, bold: true })],
            style: STYLES.H3,
            heading: HeadingLevel.HEADING_3,
          })
        )

        if (subsubsection.content) {
          convertTipTapToDocx(subsubsection.content as TipTapNode, paragraphs)
        }
      }
    }
  }

  // Create the document
  return new Document({
    styles: {
      paragraphStyles: [
        {
          id: STYLES.P,
          name: STYLES.P,
          basedOn: 'Normal',
          next: STYLES.P,
          run: {},
          paragraph: {},
        },
        {
          id: STYLES.H1,
          name: STYLES.H1,
          basedOn: 'Heading1',
          next: STYLES.P,
          run: { bold: true },
          paragraph: {},
        },
        {
          id: STYLES.H2,
          name: STYLES.H2,
          basedOn: 'Heading2',
          next: STYLES.P,
          run: { bold: true },
          paragraph: {},
        },
        {
          id: STYLES.H3,
          name: STYLES.H3,
          basedOn: 'Heading3',
          next: STYLES.P,
          run: { bold: true },
          paragraph: {},
        },
        {
          id: STYLES.BULLETS,
          name: STYLES.BULLETS,
          basedOn: 'Normal',
          next: STYLES.BULLETS,
          run: {},
          paragraph: {
            indent: { left: convertInchesToTwip(0.5) },
          },
        },
        {
          id: STYLES.NUMBERS,
          name: STYLES.NUMBERS,
          basedOn: 'Normal',
          next: STYLES.NUMBERS,
          run: {},
          paragraph: {
            indent: { left: convertInchesToTwip(0.5) },
          },
        },
        {
          id: STYLES.PAGE_HEADER,
          name: STYLES.PAGE_HEADER,
          basedOn: 'Normal',
          run: {},
          paragraph: {
            alignment: AlignmentType.CENTER,
          },
        },
        {
          id: STYLES.TABLE_TEXT,
          name: STYLES.TABLE_TEXT,
          basedOn: 'Normal',
          run: {},
          paragraph: {},
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: paragraphs,
      },
    ],
  })
}

// ==================== API ROUTE ====================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  // Fetch proposal for title
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('title')
    .eq('id', proposalId)
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  // Fetch all sections ordered by sort_order
  const { data: sections, error: sectionsError } = await supabase
    .from('proposal_sections')
    .select('id, parent_id, sort_order, section_number, title, content, content_text, status')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true })

  if (sectionsError) {
    console.error('[Export] Failed to fetch sections:', sectionsError)
    return NextResponse.json({ error: sectionsError.message }, { status: 500 })
  }

  if (!sections || sections.length === 0) {
    return NextResponse.json(
      { error: 'No sections to export. Create an outline first.' },
      { status: 400 }
    )
  }

  try {
    // Build the Word document
    const doc = buildDocument(sections as Section[], proposal.title || 'Technical Volume')

    // Generate the buffer
    const buffer = await Packer.toBuffer(doc)

    // Generate filename
    const sanitizedTitle = (proposal.title || 'Technical-Volume')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50)
    const filename = `${sanitizedTitle}-Technical-Volume.docx`

    // Return as downloadable file
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[Export] Failed to generate document:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate document' },
      { status: 500 }
    )
  }
}

// GET - Return section status for UI warnings
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: proposalId } = await params

  // Fetch section status counts
  const { data: sections, error } = await supabase
    .from('proposal_sections')
    .select('status')
    .eq('proposal_id', proposalId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const total = sections?.length || 0
  const locked = sections?.filter(s => s.status === 'locked').length || 0
  const notLocked = total - locked

  return NextResponse.json({
    total,
    locked,
    notLocked,
    allLocked: total > 0 && locked === total,
  })
}
