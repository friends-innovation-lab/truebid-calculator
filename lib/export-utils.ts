// ============================================================================
// EXPORT UTILITIES - TrueBid Cost Proposal Document Generation
// Google-Quality Modern Design
// ============================================================================

import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  Header, 
  Footer, 
  AlignmentType, 
  HeadingLevel, 
  BorderStyle, 
  WidthType,
  PageNumber,
  LevelFormat,
  ShadingType,
  PageBreak,
  convertInchesToTwip
} from 'docx'

import type { TDocumentDefinitions, Content, ContentTable, TableCell as PdfTableCell } from 'pdfmake/interfaces'
import type { TCreatedPdf } from 'pdfmake/build/pdfmake'

// pdfmake is loaded dynamically to avoid SSR issues
interface PdfMakeInstance {
  vfs: { [file: string]: string }
  createPdf(docDefinition: TDocumentDefinitions): TCreatedPdf
}

let pdfMake: PdfMakeInstance | null = null

async function loadPdfMake(): Promise<PdfMakeInstance> {
  if (pdfMake) return pdfMake

  const pdfMakeModule = await import('pdfmake/build/pdfmake')
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts')

  const instance = (pdfMakeModule.default || pdfMakeModule) as unknown as PdfMakeInstance
  const pdfFonts = pdfFontsModule.default || pdfFontsModule

  // Handle different module structures for font VFS
  const fontsRecord = pdfFonts as Record<string, unknown>
  const nestedVfs = (fontsRecord.pdfMake as Record<string, unknown> | undefined)?.vfs as { [file: string]: string } | undefined
  if (nestedVfs) {
    instance.vfs = nestedVfs
  } else if (pdfFonts.vfs) {
    instance.vfs = pdfFonts.vfs
  }

  pdfMake = instance
  return instance
}

// ============================================================================
// TYPES
// ============================================================================

export interface ExportRole {
  id: string
  title: string
  name?: string
  icLevel?: string
  baseSalary: number
  quantity: number
  description?: string
  blsCode?: string
  yearsExperience?: string
  education?: string
  allocatedHours?: number
  wbsCount?: number
}

export interface WBSElement {
  id: string
  wbsNumber: string
  title: string
  description: string
  hours: number
  laborBreakdown: {
    roleId: string
    roleName: string
    hours: number
    rationale?: string
  }[]
  estimateMethod: 'historical' | 'expert' | 'parametric' | 'analogous' | 'engineering'
  confidenceLevel: 'high' | 'medium' | 'low'
  assumptions?: string[]
  sooReference?: string
}

export interface ExportData {
  solicitation: string
  client: string
  proposalTitle: string
  preparedBy: string
  preparedDate: string
  companyName: string
  samUei?: string
  gsaContract?: string
  
  indirectRates: {
    fringe: number
    overhead: number
    ga: number
    source: string
    fiscalYear: string
  }
  profitMargin: number
  escalationRate: number
  productiveHours: number
  
  roles: ExportRole[]
  wbsElements?: WBSElement[]
  
  rateCardType: 'tm' | 'ffp' | 'hybrid'
  yearsToInclude: number
  includeEscalation: boolean
  
  calculateRate: (salary: number, includeProfit: boolean) => number
  calculateEscalatedRate: (rate: number, year: number) => number
}

export interface ExportOptions {
  includeRateCard: boolean
  includeBOE: boolean
  includeLCATs: boolean
  includeAuditPackage: boolean
}

// ============================================================================
// DESIGN SYSTEM - Google-Quality Modern
// ============================================================================

const FONT = {
  primary: 'Arial',
  mono: 'Consolas'
}

const COLOR = {
  black: '1a1a1a',
  text: '202124',        // Google's primary text
  secondary: '5f6368',   // Google's secondary text
  tertiary: '80868b',    // Light gray
  border: 'dadce0',      // Google's border color
  headerBg: 'f8f9fa',    // Google's light background
  accent: '1a73e8',      // Google blue
  accentLight: 'e8f0fe', // Light blue background
  success: '1e8e3e',     // Google green
  white: 'ffffff',
}

// Font sizes in half-points (multiply pt by 2)
const SIZE = {
  title: 56,        // 28pt - Hero title
  subtitle: 28,     // 14pt
  h1: 36,           // 18pt
  h2: 28,           // 14pt
  h3: 24,           // 12pt
  body: 22,         // 11pt
  small: 20,        // 10pt
  caption: 18,      // 9pt
  tiny: 16,         // 8pt
}

// Spacing in twips (1440 = 1 inch, 72 = 1/20 inch)
const SPACING = {
  section: 600,     // Space before sections
  paragraph: 240,   // Space after paragraphs
  tight: 120,       // Tight spacing
  loose: 360,       // Loose spacing
}

const STYLES = {
  default: {
    document: {
      run: { font: FONT.primary, size: SIZE.body, color: COLOR.text },
      paragraph: { spacing: { line: 276 } } // 1.15 line height
    }
  },
  paragraphStyles: [
    {
      id: 'Title',
      name: 'Title',
      basedOn: 'Normal',
      run: { size: SIZE.title, color: COLOR.black, font: FONT.primary, bold: true },
      paragraph: { spacing: { after: 80 } }
    },
    {
      id: 'Subtitle',
      name: 'Subtitle',
      basedOn: 'Normal',
      run: { size: SIZE.subtitle, color: COLOR.secondary, font: FONT.primary },
      paragraph: { spacing: { after: SPACING.section } }
    },
    {
      id: 'Heading1',
      name: 'Heading 1',
      basedOn: 'Normal',
      next: 'Normal',
      run: { size: SIZE.h1, bold: true, color: COLOR.black, font: FONT.primary },
      paragraph: { spacing: { before: SPACING.section, after: SPACING.paragraph }, outlineLevel: 0 }
    },
    {
      id: 'Heading2',
      name: 'Heading 2',
      basedOn: 'Normal',
      next: 'Normal',
      run: { size: SIZE.h2, bold: true, color: COLOR.text, font: FONT.primary },
      paragraph: { spacing: { before: SPACING.loose, after: SPACING.tight }, outlineLevel: 1 }
    },
    {
      id: 'Heading3',
      name: 'Heading 3',
      basedOn: 'Normal',
      next: 'Normal',
      run: { size: SIZE.h3, bold: true, color: COLOR.text, font: FONT.primary },
      paragraph: { spacing: { before: SPACING.paragraph, after: SPACING.tight }, outlineLevel: 2 }
    },
    {
      id: 'BodyText',
      name: 'Body Text',
      basedOn: 'Normal',
      run: { size: SIZE.body, font: FONT.primary, color: COLOR.text },
      paragraph: { spacing: { after: SPACING.paragraph, line: 300 } } // 1.25 line height
    },
    {
      id: 'Caption',
      name: 'Caption',
      basedOn: 'Normal',
      run: { size: SIZE.caption, font: FONT.primary, color: COLOR.secondary },
      paragraph: { spacing: { after: SPACING.tight } }
    },
  ]
}

const NUMBERING_CONFIG = [
  {
    reference: 'bullet-list',
    levels: [{
      level: 0,
      format: LevelFormat.BULLET,
      text: '•',
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } }
    }]
  },
  {
    reference: 'number-list',
    levels: [{
      level: 0,
      format: LevelFormat.DECIMAL,
      text: '%1.',
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } }
    }]
  }
]

// ============================================================================
// TABLE HELPERS - Clean Modern Design
// ============================================================================

const noBorder = { style: BorderStyle.NONE, size: 0, color: COLOR.border }
const subtleBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR.border }

function tableHeaderCell(
  text: string, 
  width: number, 
  align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: noBorder, left: noBorder, right: noBorder, bottom: subtleBorder },
    shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
    margins: { top: 140, bottom: 140, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ 
        text: text.toUpperCase(), 
        size: SIZE.tiny, 
        bold: true, 
        color: COLOR.secondary, 
        font: FONT.primary 
      })]
    })]
  })
}

function tableDataCell(
  text: string, 
  width: number, 
  align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT, 
  options: { bold?: boolean; mono?: boolean; color?: string } = {}
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: noBorder, left: noBorder, right: noBorder, bottom: subtleBorder },
    margins: { top: 140, bottom: 140, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ 
        text, 
        size: SIZE.small, 
        bold: options.bold || false, 
        color: options.color || COLOR.text, 
        font: options.mono ? FONT.mono : FONT.primary 
      })]
    })]
  })
}

function tableTotalCell(
  text: string, 
  width: number, 
  align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: subtleBorder, left: noBorder, right: noBorder, bottom: noBorder },
    shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
    margins: { top: 140, bottom: 140, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ 
        text, 
        size: SIZE.small, 
        bold: true, 
        color: COLOR.black, 
        font: FONT.primary 
      })]
    })]
  })
}

// ============================================================================
// FORMATTERS
// ============================================================================

const currency = (n: number): string => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)

const currencyWhole = (n: number): string => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

const num = (n: number): string => 
  new Intl.NumberFormat('en-US').format(n)

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`

const yearLabel = (y: number): string => y === 1 ? 'Base Year' : `Option Year ${y - 1}`

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return dateStr
  }
}

// ============================================================================
// DOCUMENT SECTIONS
// ============================================================================

function coverPage(data: ExportData): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = []
  
  // Add vertical spacing at top
  items.push(new Paragraph({ spacing: { before: 2000 }, children: [] }))
  
  // Company name - subtle header
  items.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [new TextRun({ 
      text: data.companyName.toUpperCase(), 
      size: SIZE.caption, 
      color: COLOR.secondary,
      font: FONT.primary,
      characterSpacing: 60
    })]
  }))
  
  // Main title
  items.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ 
      text: 'Cost Proposal', 
      size: SIZE.title, 
      bold: true, 
      color: COLOR.black, 
      font: FONT.primary 
    })]
  }))
  
  // Proposal title
  if (data.proposalTitle) {
    items.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
      children: [new TextRun({ 
        text: data.proposalTitle, 
        size: SIZE.h2, 
        color: COLOR.secondary, 
        font: FONT.primary 
      })]
    }))
  }
  
  // Divider line
  items.push(new Paragraph({ spacing: { before: 400, after: 400 }, children: [] }))
  items.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ 
      text: '―――――――――――――', 
      size: SIZE.h1, 
      color: COLOR.border, 
      font: FONT.primary 
    })]
  }))
  items.push(new Paragraph({ spacing: { before: 400 }, children: [] }))
  
  // Metadata
  const metadata = [
    { label: 'Solicitation', value: data.solicitation || 'N/A' },
    { label: 'Client', value: data.client || 'N/A' },
    { label: 'Prepared By', value: data.preparedBy },
    { label: 'Date', value: formatDate(data.preparedDate) },
  ]
  
  metadata.forEach(item => {
    items.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `${item.label}: `, size: SIZE.small, color: COLOR.tertiary, font: FONT.primary }),
        new TextRun({ text: item.value, size: SIZE.small, color: COLOR.text, font: FONT.primary, bold: true })
      ]
    }))
  })
  
  // Company identifiers
  items.push(new Paragraph({ spacing: { before: 600 }, children: [] }))
  
  const identifiers: string[] = []
  if (data.samUei) identifiers.push(`SAM UEI: ${data.samUei}`)
  if (data.gsaContract) identifiers.push(`GSA: ${data.gsaContract}`)
  
  if (identifiers.length > 0) {
    items.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ 
        text: identifiers.join('   •   '), 
        size: SIZE.caption, 
        color: COLOR.tertiary, 
        font: FONT.primary 
      })]
    }))
  }
  
  // Page break
  items.push(new Paragraph({ children: [new PageBreak()] }))
  
  return items
}

function executiveSummary(data: ExportData): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = []
  
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_1, 
    children: [new TextRun('Executive Summary')] 
  }))
  
  // Calculate totals
  const totalHours = data.wbsElements?.reduce((sum, el) => sum + el.hours, 0) || 0
  let totalCost = 0
  
  data.roles.forEach(role => {
    const rate = data.calculateRate(role.baseSalary, data.rateCardType !== 'ffp')
    const hours = data.productiveHours * role.quantity * data.yearsToInclude
    totalCost += rate * hours
  })
  
  items.push(new Paragraph({
    style: 'BodyText',
    children: [new TextRun(
      `This proposal presents ${data.companyName}'s cost approach for ${data.proposalTitle || 'the referenced solicitation'}. ` +
      `Our team of ${data.roles.length} labor categories will deliver ${num(totalHours)} hours of effort ` +
      `across ${data.yearsToInclude === 1 ? 'the base year' : `${data.yearsToInclude} performance periods`}.`
    )]
  }))
  
  // Key metrics in a clean grid
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_2, 
    children: [new TextRun('Proposal Overview')] 
  }))
  
  const metricsTable = new Table({
    columnWidths: [2400, 2400, 2400, 2400],
    rows: [
      new TableRow({
        children: [
          createMetricCell('Total Value', currencyWhole(totalCost)),
          createMetricCell('Duration', `${data.yearsToInclude} Year${data.yearsToInclude > 1 ? 's' : ''}`),
          createMetricCell('Team Size', `${data.roles.length} Roles`),
          createMetricCell('Total Hours', num(totalHours)),
        ]
      })
    ]
  })
  
  items.push(new Paragraph({ spacing: { before: 200 }, children: [] }))
  items.push(metricsTable)
  items.push(new Paragraph({ spacing: { after: 200 }, children: [] }))
  
  // Contract type info
  const contractTypeLabel = data.rateCardType === 'tm' ? 'Time & Materials' : 
                            data.rateCardType === 'ffp' ? 'Firm Fixed Price' : 'Hybrid'
  
  items.push(new Paragraph({
    style: 'BodyText',
    children: [
      new TextRun({ text: 'Contract Type: ', bold: true }),
      new TextRun(contractTypeLabel),
      new TextRun('  •  '),
      new TextRun({ text: 'Indirect Rates: ', bold: true }),
      new TextRun(`FY${data.indirectRates.fiscalYear} ${data.indirectRates.source}`),
    ]
  }))
  
  return items
}

function createMetricCell(label: string, value: string): TableCell {
  return new TableCell({
    width: { size: 2400, type: WidthType.DXA },
    borders: { top: noBorder, left: noBorder, right: noBorder, bottom: noBorder },
    shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
    margins: { top: 200, bottom: 200, left: 160, right: 160 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: value, size: SIZE.h2, bold: true, color: COLOR.accent, font: FONT.primary })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60 },
        children: [new TextRun({ text: label.toUpperCase(), size: SIZE.tiny, color: COLOR.secondary, font: FONT.primary })]
      })
    ]
  })
}

function rateCard(data: ExportData): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = []
  
  items.push(new Paragraph({ children: [new PageBreak()] }))
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_1, 
    children: [new TextRun('Rate Card')] 
  }))
  
  items.push(new Paragraph({
    style: 'BodyText',
    children: [new TextRun(
      `Fully-burdened hourly rates for all proposed labor categories. ` +
      (data.includeEscalation && data.yearsToInclude > 1 
        ? `Option year rates include ${pct(data.escalationRate)} annual escalation.`
        : 'Rates are fixed across all performance periods.')
    )]
  }))
  
  // Build columns dynamically based on years
  const colWidths: number[] = [3200, 800] // Name, Level
  const headerCells: TableCell[] = [
    tableHeaderCell('Labor Category', 3200),
    tableHeaderCell('Level', 800, AlignmentType.CENTER),
  ]
  
  for (let y = 1; y <= data.yearsToInclude; y++) {
    colWidths.push(1400)
    headerCells.push(tableHeaderCell(yearLabel(y), 1400, AlignmentType.RIGHT))
  }
  
  const rows: TableRow[] = [new TableRow({ children: headerCells })]
  
  // Data rows
  data.roles.forEach(role => {
    const baseRate = data.calculateRate(role.baseSalary, data.rateCardType !== 'ffp')
    const cells: TableCell[] = [
      tableDataCell(role.title || role.name || '', 3200, AlignmentType.LEFT, { bold: true }),
      tableDataCell(role.icLevel || '', 800, AlignmentType.CENTER, { color: COLOR.secondary }),
    ]
    
    for (let y = 1; y <= data.yearsToInclude; y++) {
      const rate = y === 1 ? baseRate : data.calculateEscalatedRate(baseRate, y)
      cells.push(tableDataCell(currency(rate), 1400, AlignmentType.RIGHT, { mono: true }))
    }
    
    rows.push(new TableRow({ children: cells }))
  })
  
  items.push(new Paragraph({ spacing: { before: 200 }, children: [] }))
  items.push(new Table({ columnWidths: colWidths, rows }))
  
  // Rate footnote
  items.push(new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ 
      text: `Rates based on ${num(data.productiveHours)} productive hours per year. ` +
            `Fringe ${pct(data.indirectRates.fringe)} · Overhead ${pct(data.indirectRates.overhead)} · G&A ${pct(data.indirectRates.ga)}` +
            (data.rateCardType !== 'ffp' ? ` · Profit ${pct(data.profitMargin)}` : ''),
      size: SIZE.caption, 
      color: COLOR.tertiary, 
      font: FONT.primary,
      italics: true
    })]
  }))
  
  return items
}

function basisOfEstimate(data: ExportData): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = []
  
  if (!data.wbsElements || data.wbsElements.length === 0) return items
  
  items.push(new Paragraph({ children: [new PageBreak()] }))
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_1, 
    children: [new TextRun('Basis of Estimate')] 
  }))
  
  const totalHours = data.wbsElements.reduce((sum, el) => sum + el.hours, 0)
  
  items.push(new Paragraph({
    style: 'BodyText',
    children: [new TextRun(
      `This section details the work breakdown structure and labor hour estimates for the ${num(totalHours)} total hours proposed.`
    )]
  }))
  
  // Summary table
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_2, 
    children: [new TextRun('WBS Summary')] 
  }))
  
  const summaryRows: TableRow[] = [
    new TableRow({
      children: [
        tableHeaderCell('WBS', 800),
        tableHeaderCell('Element', 3600),
        tableHeaderCell('Method', 1200, AlignmentType.CENTER),
        tableHeaderCell('Confidence', 1200, AlignmentType.CENTER),
        tableHeaderCell('Hours', 1200, AlignmentType.RIGHT),
      ]
    })
  ]
  
  data.wbsElements.forEach(element => {
    summaryRows.push(new TableRow({
      children: [
        tableDataCell(element.wbsNumber, 800, AlignmentType.LEFT, { mono: true, color: COLOR.secondary }),
        tableDataCell(element.title, 3600, AlignmentType.LEFT, { bold: true }),
        tableDataCell(element.estimateMethod, 1200, AlignmentType.CENTER),
        tableDataCell(element.confidenceLevel, 1200, AlignmentType.CENTER, { 
          color: element.confidenceLevel === 'high' ? COLOR.success : COLOR.secondary 
        }),
        tableDataCell(num(element.hours), 1200, AlignmentType.RIGHT, { mono: true }),
      ]
    }))
  })
  
  // Total row
  summaryRows.push(new TableRow({
    children: [
      tableTotalCell('', 800),
      tableTotalCell('Total', 3600),
      tableTotalCell('', 1200),
      tableTotalCell('', 1200),
      tableTotalCell(num(totalHours), 1200, AlignmentType.RIGHT),
    ]
  }))
  
  items.push(new Paragraph({ spacing: { before: 200 }, children: [] }))
  items.push(new Table({ columnWidths: [800, 3600, 1200, 1200, 1200], rows: summaryRows }))
  
  // Detailed breakdown for each WBS
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_2, 
    spacing: { before: 600 },
    children: [new TextRun('Detailed Breakdown')] 
  }))
  
  data.wbsElements.forEach(element => {
    items.push(new Paragraph({ 
      heading: HeadingLevel.HEADING_3, 
      children: [new TextRun(`${element.wbsNumber} ${element.title}`)] 
    }))
    
    items.push(new Paragraph({
      style: 'BodyText',
      children: [new TextRun(element.description)]
    }))
    
    // SOO Reference
    if (element.sooReference) {
      items.push(new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: 'SOO Reference: ', size: SIZE.small, bold: true, color: COLOR.secondary, font: FONT.primary }),
          new TextRun({ text: element.sooReference, size: SIZE.small, color: COLOR.text, font: FONT.primary })
        ]
      }))
    }
    
    // Labor breakdown table
    if (element.laborBreakdown && element.laborBreakdown.length > 0) {
      const laborRows: TableRow[] = [
        new TableRow({
          children: [
            tableHeaderCell('Role', 4000),
            tableHeaderCell('Hours', 1200, AlignmentType.RIGHT),
            tableHeaderCell('Rationale', 3800),
          ]
        })
      ]
      
      element.laborBreakdown.forEach(labor => {
        laborRows.push(new TableRow({
          children: [
            tableDataCell(labor.roleName, 4000),
            tableDataCell(num(labor.hours), 1200, AlignmentType.RIGHT, { mono: true }),
            tableDataCell(labor.rationale || '', 3800, AlignmentType.LEFT, { color: COLOR.secondary }),
          ]
        }))
      })
      
      items.push(new Paragraph({ spacing: { before: 160 }, children: [] }))
      items.push(new Table({ columnWidths: [4000, 1200, 3800], rows: laborRows }))
    }
    
    // Assumptions
    if (element.assumptions && element.assumptions.length > 0) {
      items.push(new Paragraph({
        spacing: { before: 160 },
        children: [new TextRun({ text: 'Assumptions:', size: SIZE.small, bold: true, color: COLOR.secondary, font: FONT.primary })]
      }))
      
      element.assumptions.forEach(assumption => {
        items.push(new Paragraph({
          numbering: { reference: 'bullet-list', level: 0 },
          children: [new TextRun({ text: assumption, size: SIZE.small, color: COLOR.text, font: FONT.primary })]
        }))
      })
    }
    
    items.push(new Paragraph({ spacing: { after: 240 }, children: [] }))
  })
  
  return items
}

function laborCategories(data: ExportData): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = []
  
  // Calculate role hours from WBS
  const roleHours: Record<string, number> = {}
  data.wbsElements?.forEach(el => {
    el.laborBreakdown?.forEach(lb => {
      roleHours[lb.roleName] = (roleHours[lb.roleName] || 0) + lb.hours
    })
  })
  
  items.push(new Paragraph({ children: [new PageBreak()] }))
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_1, 
    children: [new TextRun('Labor Categories')] 
  }))
  
  items.push(new Paragraph({
    style: 'BodyText',
    children: [new TextRun('Qualifications, experience requirements, and responsibilities for each proposed labor category.')]
  }))
  
  // Mock data for descriptions
  const mockDescriptions: Record<string, string> = {
    'delivery manager': 'Oversees project delivery, manages client relationships, and ensures on-time execution of deliverables. Coordinates cross-functional teams and maintains project schedules.',
    'product manager': 'Defines product vision and roadmap, prioritizes features based on user research and business value. Works closely with engineering and design teams.',
    'product designer': 'Creates user-centered designs including wireframes, prototypes, and high-fidelity mockups. Conducts usability testing and ensures Section 508 compliance.',
    'frontend engineer': 'Develops responsive web applications using modern JavaScript frameworks. Implements accessible UI components and optimizes performance.',
    'backend engineer': 'Designs and implements scalable APIs and microservices. Manages database architecture and ensures system reliability.',
    'design lead': 'Leads design strategy and mentors junior designers. Establishes design systems and ensures consistency across products.',
    'ux researcher': 'Conducts user research including interviews, surveys, and usability testing. Synthesizes findings into actionable insights.',
    'data engineer': 'Builds and maintains data pipelines and ETL processes. Ensures data quality and availability for analytics.',
    'devops engineer': 'Manages CI/CD pipelines, infrastructure as code, and cloud environments. Ensures system security and reliability.',
    'technical lead': 'Provides technical leadership and architectural guidance. Mentors engineers and ensures code quality standards.',
  }
  
  const mockExperience: Record<string, string> = {
    'IC3': '3-5 years',
    'IC4': '5-8 years', 
    'IC5': '8-12 years',
    'IC6': '12+ years',
  }
  
  const mockEducation: Record<string, string> = {
    'delivery manager': "Bachelor's degree in Business, IT, or related field",
    'product manager': "Bachelor's degree in Business, Computer Science, or related field",
    'product designer': "Bachelor's degree in Design, HCI, or related field",
    'frontend engineer': "Bachelor's degree in Computer Science or related field",
    'backend engineer': "Bachelor's degree in Computer Science or related field",
    'design lead': "Bachelor's degree in Design, HCI, or related field",
    'ux researcher': "Master's degree in HCI, Psychology, or related field preferred",
    'data engineer': "Bachelor's degree in Computer Science, Data Science, or related field",
    'devops engineer': "Bachelor's degree in Computer Science or related field",
    'technical lead': "Bachelor's degree in Computer Science or related field",
  }

  const mockBLSCodes: Record<string, string> = {
    'delivery manager': '11-3021',
    'product manager': '11-3021',
    'product designer': '15-1255',
    'frontend engineer': '15-1252',
    'backend engineer': '15-1252',
    'design lead': '15-1255',
    'ux researcher': '15-1255',
    'data engineer': '15-1252',
    'devops engineer': '15-1252',
    'technical lead': '15-1252',
  }
  
  data.roles.forEach(role => {
    const name = role.title || role.name || ''
    const nameLower = name.toLowerCase()
    const rate = data.calculateRate(role.baseSalary, data.rateCardType !== 'ffp')
    const hours = roleHours[name] || 0
    
    const description = role.description || mockDescriptions[nameLower] || 
      'Provides specialized expertise supporting federal government initiatives and program objectives.'
    const experience = role.yearsExperience || mockExperience[role.icLevel || 'IC4'] || '5+ years'
    const education = role.education || mockEducation[nameLower] || "Bachelor's degree in relevant field"
    const blsCode = role.blsCode || mockBLSCodes[nameLower] || '15-1252'
    
    items.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun(name)]
    }))
    
    // Metadata badges
    const metaParts: string[] = [role.icLevel || 'N/A', currency(rate) + '/hr']
    if (role.quantity > 1) metaParts.push(`${role.quantity} positions`)
    if (hours > 0) metaParts.push(`${num(hours)} hours`)
    
    items.push(new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ 
        text: metaParts.join('  •  '), 
        size: SIZE.small, 
        color: COLOR.tertiary, 
        font: FONT.primary 
      })]
    }))
    
    // Description
    items.push(new Paragraph({
      style: 'BodyText',
      children: [new TextRun(description)]
    }))
    
    // Qualifications table
    const qualRows: TableRow[] = [
      new TableRow({
        children: [
          tableHeaderCell('Requirement', 2000),
          tableHeaderCell('Details', 6000),
        ]
      }),
      new TableRow({
        children: [
          tableDataCell('Experience', 2000, AlignmentType.LEFT, { bold: true }),
          tableDataCell(experience, 6000),
        ]
      }),
      new TableRow({
        children: [
          tableDataCell('Education', 2000, AlignmentType.LEFT, { bold: true }),
          tableDataCell(education, 6000),
        ]
      }),
      new TableRow({
        children: [
          tableDataCell('BLS Code', 2000, AlignmentType.LEFT, { bold: true }),
          tableDataCell(blsCode, 6000, AlignmentType.LEFT, { mono: true }),
        ]
      }),
    ]
    
    items.push(new Paragraph({ spacing: { before: 120 }, children: [] }))
    items.push(new Table({ columnWidths: [2000, 6000], rows: qualRows }))
    items.push(new Paragraph({ spacing: { after: 300 }, children: [] }))
  })
  
  return items
}

function auditPackage(data: ExportData): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = []
  
  items.push(new Paragraph({ children: [new PageBreak()] }))
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_1, 
    children: [new TextRun('Rate Calculation & Audit Support')] 
  }))
  
  items.push(new Paragraph({
    style: 'BodyText',
    children: [new TextRun('Detailed rate buildup demonstrating FAR 31.2 compliance and supporting audit requirements.')]
  }))
  
  // Methodology
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_2, 
    children: [new TextRun('Rate Methodology')] 
  }))
  
  items.push(new Paragraph({
    style: 'BodyText',
    children: [new TextRun('All rates are calculated using the following formula:')]
  }))
  
  const steps = [
    'Direct Hourly Rate = Annual Salary ÷ 2,080 standard hours',
    `Apply Fringe Benefits @ ${pct(data.indirectRates.fringe)}`,
    `Apply Overhead @ ${pct(data.indirectRates.overhead)}`,
    `Apply G&A @ ${pct(data.indirectRates.ga)}`,
  ]
  if (data.rateCardType !== 'ffp') {
    steps.push(`Apply Profit @ ${pct(data.profitMargin)}`)
  }
  
  steps.forEach(step => {
    items.push(new Paragraph({
      numbering: { reference: 'number-list', level: 0 },
      children: [new TextRun({ text: step, size: SIZE.body, color: COLOR.text, font: FONT.primary })]
    }))
  })
  
  items.push(new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ 
      text: `Indirect rates source: ${data.indirectRates.source} FY${data.indirectRates.fiscalYear}`, 
      size: SIZE.caption, 
      color: COLOR.tertiary, 
      font: FONT.primary,
      italics: true 
    })]
  }))
  
  // Rate buildup table
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_2, 
    children: [new TextRun('Rate Buildup by Category')] 
  }))
  
  const buildupRows: TableRow[] = [
    new TableRow({
      children: [
        tableHeaderCell('Labor Category', 2400),
        tableHeaderCell('Direct', 1200, AlignmentType.RIGHT),
        tableHeaderCell('+Fringe', 1200, AlignmentType.RIGHT),
        tableHeaderCell('+OH', 1200, AlignmentType.RIGHT),
        tableHeaderCell('+G&A', 1200, AlignmentType.RIGHT),
        tableHeaderCell('Burdened', 1200, AlignmentType.RIGHT),
      ]
    })
  ]
  
  data.roles.forEach(role => {
    const direct = role.baseSalary / 2080
    const withFringe = direct * (1 + data.indirectRates.fringe)
    const withOH = withFringe * (1 + data.indirectRates.overhead)
    const withGA = withOH * (1 + data.indirectRates.ga)
    const final = data.rateCardType !== 'ffp' ? withGA * (1 + data.profitMargin) : withGA
    
    buildupRows.push(new TableRow({
      children: [
        tableDataCell(role.title || role.name || '', 2400, AlignmentType.LEFT, { bold: true }),
        tableDataCell(currency(direct), 1200, AlignmentType.RIGHT, { mono: true }),
        tableDataCell(currency(withFringe), 1200, AlignmentType.RIGHT, { mono: true }),
        tableDataCell(currency(withOH), 1200, AlignmentType.RIGHT, { mono: true }),
        tableDataCell(currency(withGA), 1200, AlignmentType.RIGHT, { mono: true }),
        tableDataCell(currency(final), 1200, AlignmentType.RIGHT, { mono: true, bold: true, color: COLOR.accent }),
      ]
    }))
  })
  
  items.push(new Paragraph({ spacing: { before: 200 }, children: [] }))
  items.push(new Table({ columnWidths: [2400, 1200, 1200, 1200, 1200, 1200], rows: buildupRows }))
  
  // FAR compliance statement
  items.push(new Paragraph({ 
    heading: HeadingLevel.HEADING_2, 
    children: [new TextRun('FAR 31.2 Compliance')] 
  }))
  
  items.push(new Paragraph({
    style: 'BodyText',
    children: [new TextRun(
      'All proposed costs comply with FAR 31.2 cost principles. Indirect rates have been applied consistently ' +
      'with our approved accounting system and are subject to audit by the cognizant federal agency. ' +
      'Cost elements are allowable, allocable, and reasonable as defined by FAR 31.201.'
    )]
  }))
  
  // Certification
  items.push(new Paragraph({
    spacing: { before: 400 },
    shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
    children: [new TextRun({ 
      text: 'CERTIFICATION: I certify that the information provided herein is accurate and complete to the best of my knowledge.', 
      size: SIZE.small, 
      color: COLOR.secondary, 
      font: FONT.primary 
    })]
  }))
  
  items.push(new Paragraph({
    spacing: { before: 400 },
    children: [
      new TextRun({ text: '_______________________________', size: SIZE.body, color: COLOR.text, font: FONT.primary }),
      new TextRun({ text: '          ', size: SIZE.body }),
      new TextRun({ text: '_______________________________', size: SIZE.body, color: COLOR.text, font: FONT.primary }),
    ]
  }))
  
  items.push(new Paragraph({
    children: [
      new TextRun({ text: 'Authorized Signature', size: SIZE.caption, color: COLOR.tertiary, font: FONT.primary }),
      new TextRun({ text: '                                        ', size: SIZE.caption }),
      new TextRun({ text: 'Date', size: SIZE.caption, color: COLOR.tertiary, font: FONT.primary }),
    ]
  }))
  
  return items
}

// ============================================================================
// PDF GENERATION - Using pdfmake
// ============================================================================

const PDF_COLORS = {
  black: '#1a1a1a',
  text: '#202124',
  secondary: '#5f6368',
  tertiary: '#80868b',
  border: '#dadce0',
  headerBg: '#f8f9fa',
  accent: '#1a73e8',
  success: '#1e8e3e',
}

function generatePdfDocument(data: ExportData, options: ExportOptions): Promise<Blob> {
  // Calculate totals
  const totalHours = data.wbsElements?.reduce((sum, el) => sum + el.hours, 0) || 0
  let totalCost = 0
  data.roles.forEach(role => {
    const rate = data.calculateRate(role.baseSalary, data.rateCardType !== 'ffp')
    const hours = data.productiveHours * role.quantity * data.yearsToInclude
    totalCost += rate * hours
  })

  // Role hours from WBS
  const roleHours: Record<string, number> = {}
  data.wbsElements?.forEach(el => {
    el.laborBreakdown?.forEach(lb => {
      roleHours[lb.roleName] = (roleHours[lb.roleName] || 0) + lb.hours
    })
  })

  // Mock data
  const mockDescriptions: Record<string, string> = {
    'delivery manager': 'Oversees project delivery, manages client relationships, and ensures on-time execution of deliverables.',
    'product manager': 'Defines product vision and roadmap, prioritizes features based on user research and business value.',
    'product designer': 'Creates user-centered designs including wireframes, prototypes, and high-fidelity mockups.',
    'frontend engineer': 'Develops responsive web applications using modern JavaScript frameworks.',
    'backend engineer': 'Designs and implements scalable APIs and microservices.',
  }
  const mockExperience: Record<string, string> = { 'IC3': '3-5 years', 'IC4': '5-8 years', 'IC5': '8-12 years', 'IC6': '12+ years' }
  const mockEducation: Record<string, string> = {
    'delivery manager': "Bachelor's in Business or IT",
    'product manager': "Bachelor's in Business or CS",
    'product designer': "Bachelor's in Design or HCI",
    'frontend engineer': "Bachelor's in Computer Science",
    'backend engineer': "Bachelor's in Computer Science",
  }

  const content: Content[] = []

  // ===== COVER PAGE =====
  content.push({ text: '\n\n\n\n' })
  content.push({ 
    text: data.companyName.toUpperCase(), 
    style: 'companyName',
    alignment: 'center',
    margin: [0, 0, 0, 30]
  })
  content.push({ 
    text: 'Cost Proposal', 
    style: 'title',
    alignment: 'center'
  })
  if (data.proposalTitle) {
    content.push({ 
      text: data.proposalTitle, 
      style: 'subtitle',
      alignment: 'center',
      margin: [0, 10, 0, 0]
    })
  }
  content.push({ 
    text: '―――――――――――――', 
    alignment: 'center',
    color: PDF_COLORS.border,
    margin: [0, 40, 0, 40]
  })
  
  // Metadata
  const metadata = [
    { label: 'Solicitation', value: data.solicitation || 'N/A' },
    { label: 'Client', value: data.client || 'N/A' },
    { label: 'Prepared By', value: data.preparedBy },
    { label: 'Date', value: formatDate(data.preparedDate) },
  ]
  metadata.forEach(item => {
    content.push({
      text: [
        { text: `${item.label}: `, color: PDF_COLORS.tertiary },
        { text: item.value, bold: true, color: PDF_COLORS.text }
      ],
      alignment: 'center',
      margin: [0, 4, 0, 4]
    })
  })

  // Identifiers
  const identifiers: string[] = []
  if (data.samUei) identifiers.push(`SAM UEI: ${data.samUei}`)
  if (data.gsaContract) identifiers.push(`GSA: ${data.gsaContract}`)
  if (identifiers.length > 0) {
    content.push({
      text: identifiers.join('   •   '),
      alignment: 'center',
      color: PDF_COLORS.tertiary,
      fontSize: 9,
      margin: [0, 40, 0, 0]
    })
  }

  content.push({ text: '', pageBreak: 'after' })

  // ===== EXECUTIVE SUMMARY =====
  if (data.roles.length > 0) {
    content.push({ text: 'Executive Summary', style: 'h1' })
    content.push({ 
      text: `This proposal presents ${data.companyName}'s cost approach for ${data.proposalTitle || 'the referenced solicitation'}. Our team of ${data.roles.length} labor categories will deliver ${num(totalHours)} hours of effort across ${data.yearsToInclude === 1 ? 'the base year' : `${data.yearsToInclude} performance periods`}.`,
      style: 'body',
      margin: [0, 0, 0, 20]
    })

    content.push({ text: 'Proposal Overview', style: 'h2' })
    
    // Metrics table
    content.push({
      table: {
        widths: ['*', '*', '*', '*'],
        body: [[
          { text: [{ text: currencyWhole(totalCost) + '\n', style: 'metricValue' }, { text: 'TOTAL VALUE', style: 'metricLabel' }], alignment: 'center', fillColor: PDF_COLORS.headerBg, margin: [10, 15, 10, 15] },
          { text: [{ text: `${data.yearsToInclude} Year${data.yearsToInclude > 1 ? 's' : ''}\n`, style: 'metricValue' }, { text: 'DURATION', style: 'metricLabel' }], alignment: 'center', fillColor: PDF_COLORS.headerBg, margin: [10, 15, 10, 15] },
          { text: [{ text: `${data.roles.length} Roles\n`, style: 'metricValue' }, { text: 'TEAM SIZE', style: 'metricLabel' }], alignment: 'center', fillColor: PDF_COLORS.headerBg, margin: [10, 15, 10, 15] },
          { text: [{ text: num(totalHours) + '\n', style: 'metricValue' }, { text: 'TOTAL HOURS', style: 'metricLabel' }], alignment: 'center', fillColor: PDF_COLORS.headerBg, margin: [10, 15, 10, 15] },
        ]]
      },
      layout: 'noBorders',
      margin: [0, 10, 0, 20]
    })

    const contractTypeLabel = data.rateCardType === 'tm' ? 'Time & Materials' : data.rateCardType === 'ffp' ? 'Firm Fixed Price' : 'Hybrid'
    content.push({
      text: [
        { text: 'Contract Type: ', bold: true },
        { text: contractTypeLabel },
        { text: '  •  ' },
        { text: 'Indirect Rates: ', bold: true },
        { text: `FY${data.indirectRates.fiscalYear} ${data.indirectRates.source}` }
      ],
      style: 'body'
    })
  }

  // ===== RATE CARD =====
  if (options.includeRateCard && data.roles.length > 0) {
    content.push({ text: '', pageBreak: 'after' })
    content.push({ text: 'Rate Card', style: 'h1' })
    content.push({ 
      text: `Fully-burdened hourly rates for all proposed labor categories. ${data.includeEscalation && data.yearsToInclude > 1 ? `Option year rates include ${pct(data.escalationRate)} annual escalation.` : 'Rates are fixed across all performance periods.'}`,
      style: 'body',
      margin: [0, 0, 0, 15]
    })

    // Build rate table
    const rateHeaders: PdfTableCell[] = [
      { text: 'LABOR CATEGORY', style: 'tableHeader' },
      { text: 'LEVEL', style: 'tableHeader', alignment: 'center' },
    ]
    for (let y = 1; y <= data.yearsToInclude; y++) {
      rateHeaders.push({ text: yearLabel(y).toUpperCase(), style: 'tableHeader', alignment: 'right' })
    }

    const rateBody: PdfTableCell[][] = [rateHeaders]
    data.roles.forEach(role => {
      const baseRate = data.calculateRate(role.baseSalary, data.rateCardType !== 'ffp')
      const row: PdfTableCell[] = [
        { text: role.title || role.name || '', bold: true },
        { text: role.icLevel || '', alignment: 'center', color: PDF_COLORS.secondary },
      ]
      for (let y = 1; y <= data.yearsToInclude; y++) {
        const rate = y === 1 ? baseRate : data.calculateEscalatedRate(baseRate, y)
        row.push({ text: currency(rate), alignment: 'right', font: 'Roboto' })
      }
      rateBody.push(row)
    })

    const rateWidths: (string | number)[] = ['*', 50]
    for (let y = 1; y <= data.yearsToInclude; y++) rateWidths.push(80)

    content.push({
      table: { headerRows: 1, widths: rateWidths, body: rateBody },
      layout: {
        hLineWidth: (i: number, node: ContentTable) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
        vLineWidth: () => 0,
        hLineColor: () => PDF_COLORS.border,
        fillColor: (i: number) => i === 0 ? PDF_COLORS.headerBg : null,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
      margin: [0, 10, 0, 10]
    })

    content.push({
      text: `Rates based on ${num(data.productiveHours)} productive hours per year. Fringe ${pct(data.indirectRates.fringe)} · Overhead ${pct(data.indirectRates.overhead)} · G&A ${pct(data.indirectRates.ga)}${data.rateCardType !== 'ffp' ? ` · Profit ${pct(data.profitMargin)}` : ''}`,
      fontSize: 9,
      italics: true,
      color: PDF_COLORS.tertiary,
      margin: [0, 5, 0, 0]
    })
  }

  // ===== BASIS OF ESTIMATE =====
  if (options.includeBOE && data.wbsElements && data.wbsElements.length > 0) {
    content.push({ text: '', pageBreak: 'after' })
    content.push({ text: 'Basis of Estimate', style: 'h1' })
    content.push({ 
      text: `This section details the work breakdown structure and labor hour estimates for the ${num(totalHours)} total hours proposed.`,
      style: 'body',
      margin: [0, 0, 0, 15]
    })

    content.push({ text: 'WBS Summary', style: 'h2' })

    const wbsBody: PdfTableCell[][] = [[
      { text: 'WBS', style: 'tableHeader' },
      { text: 'ELEMENT', style: 'tableHeader' },
      { text: 'METHOD', style: 'tableHeader', alignment: 'center' },
      { text: 'CONFIDENCE', style: 'tableHeader', alignment: 'center' },
      { text: 'HOURS', style: 'tableHeader', alignment: 'right' },
    ]]
    data.wbsElements.forEach(el => {
      wbsBody.push([
        { text: el.wbsNumber, color: PDF_COLORS.secondary, font: 'Roboto' },
        { text: el.title, bold: true },
        { text: el.estimateMethod, alignment: 'center' },
        { text: el.confidenceLevel, alignment: 'center', color: el.confidenceLevel === 'high' ? PDF_COLORS.success : PDF_COLORS.secondary },
        { text: num(el.hours), alignment: 'right', font: 'Roboto' },
      ])
    })
    wbsBody.push([
      { text: '', fillColor: PDF_COLORS.headerBg },
      { text: 'Total', bold: true, fillColor: PDF_COLORS.headerBg },
      { text: '', fillColor: PDF_COLORS.headerBg },
      { text: '', fillColor: PDF_COLORS.headerBg },
      { text: num(totalHours), bold: true, alignment: 'right', fillColor: PDF_COLORS.headerBg },
    ])

    content.push({
      table: { headerRows: 1, widths: [40, '*', 70, 70, 60], body: wbsBody },
      layout: {
        hLineWidth: (i: number, node: ContentTable) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
        vLineWidth: () => 0,
        hLineColor: () => PDF_COLORS.border,
        fillColor: (i: number) => i === 0 ? PDF_COLORS.headerBg : null,
        paddingTop: () => 8,
        paddingBottom: () => 8,
      },
      margin: [0, 10, 0, 20]
    })

    // Detailed breakdown
    content.push({ text: 'Detailed Breakdown', style: 'h2' })
    data.wbsElements.forEach(el => {
      content.push({ text: `${el.wbsNumber} ${el.title}`, style: 'h3' })
      content.push({ text: el.description, style: 'body' })
      
      if (el.sooReference) {
        content.push({
          text: [{ text: 'SOO Reference: ', bold: true, color: PDF_COLORS.secondary }, { text: el.sooReference }],
          fontSize: 10,
          margin: [0, 5, 0, 10]
        })
      }

      if (el.laborBreakdown && el.laborBreakdown.length > 0) {
        const laborBody: PdfTableCell[][] = [[
          { text: 'ROLE', style: 'tableHeader' },
          { text: 'HOURS', style: 'tableHeader', alignment: 'right' },
          { text: 'RATIONALE', style: 'tableHeader' },
        ]]
        el.laborBreakdown.forEach(lb => {
          laborBody.push([
            { text: lb.roleName },
            { text: num(lb.hours), alignment: 'right', font: 'Roboto' },
            { text: lb.rationale || '', color: PDF_COLORS.secondary },
          ])
        })
        content.push({
          table: { headerRows: 1, widths: [120, 60, '*'], body: laborBody },
          layout: {
            hLineWidth: (i: number, node: ContentTable) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
            vLineWidth: () => 0,
            hLineColor: () => PDF_COLORS.border,
            fillColor: (i: number) => i === 0 ? PDF_COLORS.headerBg : null,
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
          margin: [0, 10, 0, 10]
        })
      }

      if (el.assumptions && el.assumptions.length > 0) {
        content.push({ text: 'Assumptions:', bold: true, fontSize: 10, color: PDF_COLORS.secondary, margin: [0, 5, 0, 5] })
        content.push({
          ul: el.assumptions.map(a => ({ text: a, fontSize: 10 })),
          margin: [0, 0, 0, 15]
        })
      }
    })
  }

  // ===== LABOR CATEGORIES =====
  if (options.includeLCATs && data.roles.length > 0) {
    content.push({ text: '', pageBreak: 'after' })
    content.push({ text: 'Labor Categories', style: 'h1' })
    content.push({ 
      text: 'Qualifications, experience requirements, and responsibilities for each proposed labor category.',
      style: 'body',
      margin: [0, 0, 0, 15]
    })

    data.roles.forEach(role => {
      const name = role.title || role.name || ''
      const nameLower = name.toLowerCase()
      const rate = data.calculateRate(role.baseSalary, data.rateCardType !== 'ffp')
      const hours = roleHours[name] || 0
      const description = role.description || mockDescriptions[nameLower] || 'Provides specialized expertise supporting federal government initiatives.'
      const experience = role.yearsExperience || mockExperience[role.icLevel || 'IC4'] || '5+ years'
      const education = role.education || mockEducation[nameLower] || "Bachelor's degree in relevant field"

      content.push({ text: name, style: 'h2' })
      
      const metaParts = [role.icLevel || 'N/A', currency(rate) + '/hr']
      if (role.quantity > 1) metaParts.push(`${role.quantity} positions`)
      if (hours > 0) metaParts.push(`${num(hours)} hours`)
      
      content.push({
        text: metaParts.join('  •  '),
        fontSize: 10,
        color: PDF_COLORS.tertiary,
        margin: [0, 0, 0, 10]
      })

      content.push({ text: description, style: 'body' })

      content.push({
        table: {
          widths: [100, '*'],
          body: [
            [{ text: 'REQUIREMENT', style: 'tableHeader' }, { text: 'DETAILS', style: 'tableHeader' }],
            [{ text: 'Experience', bold: true }, { text: experience }],
            [{ text: 'Education', bold: true }, { text: education }],
            [{ text: 'BLS Code', bold: true }, { text: role.blsCode || '15-1252', font: 'Roboto' }],
          ]
        },
        layout: {
          hLineWidth: (i: number, node: ContentTable) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => PDF_COLORS.border,
          fillColor: (i: number) => i === 0 ? PDF_COLORS.headerBg : null,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 10, 0, 20]
      })
    })
  }

  // ===== AUDIT PACKAGE =====
  if (options.includeAuditPackage && data.roles.length > 0) {
    content.push({ text: '', pageBreak: 'after' })
    content.push({ text: 'Rate Calculation & Audit Support', style: 'h1' })
    content.push({ 
      text: 'Detailed rate buildup demonstrating FAR 31.2 compliance and supporting audit requirements.',
      style: 'body',
      margin: [0, 0, 0, 15]
    })

    content.push({ text: 'Rate Methodology', style: 'h2' })
    content.push({ text: 'All rates are calculated using the following formula:', style: 'body' })

    const steps = [
      'Direct Hourly Rate = Annual Salary ÷ 2,080 standard hours',
      `Apply Fringe Benefits @ ${pct(data.indirectRates.fringe)}`,
      `Apply Overhead @ ${pct(data.indirectRates.overhead)}`,
      `Apply G&A @ ${pct(data.indirectRates.ga)}`,
    ]
    if (data.rateCardType !== 'ffp') steps.push(`Apply Profit @ ${pct(data.profitMargin)}`)

    content.push({
      ol: steps.map(s => ({ text: s })),
      margin: [0, 10, 0, 10]
    })

    content.push({
      text: `Indirect rates source: ${data.indirectRates.source} FY${data.indirectRates.fiscalYear}`,
      italics: true,
      fontSize: 9,
      color: PDF_COLORS.tertiary,
      margin: [0, 0, 0, 20]
    })

    content.push({ text: 'Rate Buildup by Category', style: 'h2' })

    const buildupBody: PdfTableCell[][] = [[
      { text: 'LABOR CATEGORY', style: 'tableHeader' },
      { text: 'DIRECT', style: 'tableHeader', alignment: 'right' },
      { text: '+FRINGE', style: 'tableHeader', alignment: 'right' },
      { text: '+OH', style: 'tableHeader', alignment: 'right' },
      { text: '+G&A', style: 'tableHeader', alignment: 'right' },
      { text: 'BURDENED', style: 'tableHeader', alignment: 'right' },
    ]]

    data.roles.forEach(role => {
      const direct = role.baseSalary / 2080
      const withFringe = direct * (1 + data.indirectRates.fringe)
      const withOH = withFringe * (1 + data.indirectRates.overhead)
      const withGA = withOH * (1 + data.indirectRates.ga)
      const final = data.rateCardType !== 'ffp' ? withGA * (1 + data.profitMargin) : withGA

      buildupBody.push([
        { text: role.title || role.name || '', bold: true },
        { text: currency(direct), alignment: 'right', font: 'Roboto' },
        { text: currency(withFringe), alignment: 'right', font: 'Roboto' },
        { text: currency(withOH), alignment: 'right', font: 'Roboto' },
        { text: currency(withGA), alignment: 'right', font: 'Roboto' },
        { text: currency(final), alignment: 'right', font: 'Roboto', bold: true, color: PDF_COLORS.accent },
      ])
    })

    content.push({
      table: { headerRows: 1, widths: ['*', 55, 55, 55, 55, 60], body: buildupBody },
      layout: {
        hLineWidth: (i: number, node: ContentTable) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
        vLineWidth: () => 0,
        hLineColor: () => PDF_COLORS.border,
        fillColor: (i: number) => i === 0 ? PDF_COLORS.headerBg : null,
        paddingTop: () => 6,
        paddingBottom: () => 6,
      },
      margin: [0, 10, 0, 20]
    })

    content.push({ text: 'FAR 31.2 Compliance', style: 'h2' })
    content.push({
      text: 'All proposed costs comply with FAR 31.2 cost principles. Indirect rates have been applied consistently with our approved accounting system and are subject to audit by the cognizant federal agency. Cost elements are allowable, allocable, and reasonable as defined by FAR 31.201.',
      style: 'body',
      margin: [0, 0, 0, 30]
    })

    content.push({
      text: 'CERTIFICATION: I certify that the information provided herein is accurate and complete to the best of my knowledge.',
      fillColor: PDF_COLORS.headerBg,
      fontSize: 10,
      color: PDF_COLORS.secondary,
      margin: [10, 10, 10, 10]
    })

    content.push({
      columns: [
        { text: '_______________________________\nAuthorized Signature', alignment: 'left', fontSize: 10 },
        { text: '_______________________________\nDate', alignment: 'left', fontSize: 10 },
      ],
      margin: [0, 40, 0, 0]
    })
  }

  // Document definition
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    pageMargins: [72, 72, 72, 72] as [number, number, number, number],
    header: (currentPage: number) => currentPage > 1 ? {
      text: `${data.companyName}  |  ${data.solicitation || 'Cost Proposal'}`,
      alignment: 'right',
      fontSize: 8,
      color: PDF_COLORS.tertiary,
      margin: [72, 40, 72, 0]
    } : null,
    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: PDF_COLORS.tertiary,
      margin: [0, 20, 0, 0]
    }),
    content,
    styles: {
      title: { fontSize: 28, bold: true, color: PDF_COLORS.black },
      subtitle: { fontSize: 14, color: PDF_COLORS.secondary },
      companyName: { fontSize: 9, color: PDF_COLORS.secondary, characterSpacing: 2 },
      h1: { fontSize: 18, bold: true, color: PDF_COLORS.black, margin: [0, 30, 0, 15] },
      h2: { fontSize: 14, bold: true, color: PDF_COLORS.text, margin: [0, 20, 0, 10] },
      h3: { fontSize: 12, bold: true, color: PDF_COLORS.text, margin: [0, 15, 0, 8] },
      body: { fontSize: 11, color: PDF_COLORS.text, lineHeight: 1.4 },
      tableHeader: { fontSize: 8, bold: true, color: PDF_COLORS.secondary },
      metricValue: { fontSize: 14, bold: true, color: PDF_COLORS.accent },
      metricLabel: { fontSize: 8, color: PDF_COLORS.secondary },
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 11,
      color: PDF_COLORS.text,
    }
  }

  return new Promise(async (resolve, reject) => {
    try {
      const pdfMakeInstance = await loadPdfMake()
      const pdfDocGenerator = pdfMakeInstance.createPdf(docDefinition)
      pdfDocGenerator.getBlob((blob: Blob) => {
        resolve(blob)
      })
    } catch (error) {
      reject(error)
    }
  })
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function generateWordDocument(data: ExportData, options: ExportOptions): Promise<Blob> {
  const content: (Paragraph | Table)[] = []
  
  // Always include cover page
  content.push(...coverPage(data))
  
  // Executive summary (if we have roles)
  if (data.roles.length > 0) {
    content.push(...executiveSummary(data))
  }
  
  // Sections based on options
  if (options.includeRateCard && data.roles.length > 0) {
    content.push(...rateCard(data))
  }
  
  if (options.includeBOE && data.wbsElements && data.wbsElements.length > 0) {
    content.push(...basisOfEstimate(data))
  }
  
  if (options.includeLCATs && data.roles.length > 0) {
    content.push(...laborCategories(data))
  }
  
  if (options.includeAuditPackage && data.roles.length > 0) {
    content.push(...auditPackage(data))
  }
  
  const doc = new Document({
    styles: STYLES,
    numbering: { config: NUMBERING_CONFIG },
    sections: [{
      properties: {
        page: { 
          margin: { 
            top: convertInchesToTwip(1), 
            right: convertInchesToTwip(1), 
            bottom: convertInchesToTwip(0.75), 
            left: convertInchesToTwip(1) 
          } 
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ 
              text: `${data.companyName}  |  ${data.solicitation || 'Cost Proposal'}`, 
              size: SIZE.tiny, 
              color: COLOR.tertiary, 
              font: FONT.primary 
            })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', size: SIZE.tiny, color: COLOR.tertiary, font: FONT.primary }),
              new TextRun({ children: [PageNumber.CURRENT], size: SIZE.tiny, color: COLOR.tertiary, font: FONT.primary }),
              new TextRun({ text: ' of ', size: SIZE.tiny, color: COLOR.tertiary, font: FONT.primary }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: SIZE.tiny, color: COLOR.tertiary, font: FONT.primary }),
            ]
          })]
        })
      },
      children: content
    }]
  })
  
  const buffer = await Packer.toBuffer(doc)
  return new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

export async function generateExport(data: ExportData, options: ExportOptions, format: 'xlsx' | 'pdf' | 'docx'): Promise<Blob> {
  if (format === 'docx') {
    return generateWordDocument(data, options)
  }
  if (format === 'pdf') {
    return generatePdfDocument(data, options)
  }
  if (format === 'xlsx') {
    return generateCSV(data, options)
  }
  throw new Error(`Unsupported format: ${format}`)
}

function generateCSV(data: ExportData, options: ExportOptions): Blob {
  const lines: string[] = []
  
  lines.push(`"Cost Proposal - ${data.solicitation || 'Export'}"`)
  lines.push(`"${data.companyName}","${data.client}","${data.preparedDate}"`)
  lines.push('')
  
  if (options.includeRateCard) {
    lines.push('"RATE CARD"')
    const headers = ['Labor Category', 'Level', 'Qty', 'Salary']
    for (let y = 1; y <= data.yearsToInclude; y++) {
      headers.push(`${yearLabel(y)} Rate`)
    }
    lines.push(headers.map(x => `"${x}"`).join(','))
    
    data.roles.forEach(role => {
      const baseRate = data.calculateRate(role.baseSalary, data.rateCardType !== 'ffp')
      const row: (string | number)[] = [
        role.title || role.name || '', 
        role.icLevel || '', 
        role.quantity, 
        role.baseSalary
      ]
      for (let y = 1; y <= data.yearsToInclude; y++) {
        const rate = y === 1 ? baseRate : data.calculateEscalatedRate(baseRate, y)
        row.push(rate.toFixed(2))
      }
      lines.push(row.map(x => `"${x}"`).join(','))
    })
    lines.push('')
  }
  
  if (options.includeBOE && data.wbsElements) {
    lines.push('"BASIS OF ESTIMATE"')
    lines.push('"WBS","Element","Hours","Method","Confidence"')
    data.wbsElements.forEach(el => {
      lines.push(`"${el.wbsNumber}","${el.title}","${el.hours}","${el.estimateMethod}","${el.confidenceLevel}"`)
    })
    lines.push('')
  }
  
  if (options.includeLCATs) {
    lines.push('"LABOR CATEGORIES"')
    lines.push('"Category","Level","Experience","Hourly Rate"')
    data.roles.forEach(role => {
      const rate = data.calculateRate(role.baseSalary, data.rateCardType !== 'ffp')
      lines.push(`"${role.title || role.name}","${role.icLevel}","${role.yearsExperience || ''}","${rate.toFixed(2)}"`)
    })
  }
  
  return new Blob([lines.join('\n')], { type: 'text/csv' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface GoogleDriveUploadResult { 
  fileId: string
  webViewLink: string
  fileName: string 
}

export async function uploadToGoogleDrive(
  blob: Blob, 
  fileName: string, 
  accessToken: string, 
  folderId?: string
): Promise<GoogleDriveUploadResult> {
  const metadata: Record<string, unknown> = { name: fileName, mimeType: blob.type }
  if (folderId) metadata.parents = [folderId]
  
  const boundary = '-------314159265358979323846'
  const arrayBuffer = await blob.arrayBuffer()
  const base64 = btoa(new Uint8Array(arrayBuffer).reduce((d, b) => d + String.fromCharCode(b), ''))
  
  const body = [
    `\r\n--${boundary}`,
    `\r\nContent-Type: application/json\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}`,
    `\r\nContent-Type: ${blob.type}`,
    `\r\nContent-Transfer-Encoding: base64\r\n\r\n`,
    base64,
    `\r\n--${boundary}--`
  ].join('')
  
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    }
  )
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${await response.text()}`)
  }
  
  const result = await response.json()
  return { 
    fileId: result.id, 
    webViewLink: result.webViewLink, 
    fileName: result.name 
  }
}