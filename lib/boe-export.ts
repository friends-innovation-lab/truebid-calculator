// BOE (Basis of Estimate) Document Export Utility
// Uses docx library to generate professional Word documents

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
  ShadingType,
  PageNumber,
  PageBreak,
  LevelFormat,
} from 'docx'

// Types matching estimate-tab
interface PeriodHours {
  base: number
  option1: number
  option2: number
  option3: number
  option4: number
}

interface WBSRisk {
  id: string
  description: string
  probability: 1 | 2 | 3 | 4 | 5
  impact: 1 | 2 | 3 | 4 | 5
  mitigation: string
  status: 'identified' | 'mitigating' | 'accepted' | 'resolved'
}

interface LaborEstimate {
  id: string
  roleId: string
  roleName: string
  hoursByPeriod: PeriodHours
  rationale: string
  isOrphaned?: boolean
}

interface WBSDependency {
  id: string
  targetWbsId: string
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish'
  description: string
}

interface EnhancedWBSElement {
  id: string
  wbsNumber: string
  title: string
  description: string
  sowReference?: string
  clin?: string
  technicalApproach: string
  assumptions: string[]
  laborEstimates: LaborEstimate[]
  risks: WBSRisk[]
  dependencies: WBSDependency[]
  qualityScore: number
}

interface SOORequirement {
  id: string
  referenceNumber: string
  title: string
  description: string
  type: 'shall' | 'should' | 'will' | 'may'
  linkedWbsIds: string[]
}

interface ContractPeriod {
  key: keyof PeriodHours
  label: string
}

interface BOEExportOptions {
  wbsElements: EnhancedWBSElement[]
  requirements: SOORequirement[]
  contractPeriods: ContractPeriod[]
  contractTitle?: string
  companyName?: string
  rfpNumber?: string
}

// Helper functions
function getTotalHours(hoursByPeriod: PeriodHours): number {
  return Object.values(hoursByPeriod).reduce((sum, h) => sum + h, 0)
}

function getElementTotalHours(element: EnhancedWBSElement): number {
  return element.laborEstimates.reduce((sum, labor) => sum + getTotalHours(labor.hoursByPeriod), 0)
}

function getRiskScore(risk: WBSRisk): number {
  return risk.probability * risk.impact
}

// Reusable type for alignment values from the AlignmentType enum
type Alignment = (typeof AlignmentType)[keyof typeof AlignmentType]

// Reusable type for cell shading
interface CellShading {
  fill: string
  type: typeof ShadingType.CLEAR
}

// Table styling constants
const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder }
const headerShading: CellShading = { fill: 'E8F4FD', type: ShadingType.CLEAR }
const altRowShading: CellShading = { fill: 'F9FAFB', type: ShadingType.CLEAR }

// Create standard cell
function createCell(content: string, options: {
  bold?: boolean
  width?: number
  shading?: { fill: string; type: typeof ShadingType.CLEAR }
  alignment?: Alignment
} = {}): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
    shading: options.shading,
    children: [
      new Paragraph({
        alignment: options.alignment || AlignmentType.LEFT,
        children: [new TextRun({ text: content, bold: options.bold, size: 20 })]
      })
    ]
  })
}

// Create number cell (right-aligned)
function createNumberCell(value: number, options: {
  width?: number
  shading?: { fill: string; type: typeof ShadingType.CLEAR }
  bold?: boolean
  alignment?: Alignment
} = {}): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
    shading: options.shading,
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: value.toLocaleString(), bold: options.bold, size: 20 })]
      })
    ]
  })
}

export async function generateBOEDocument(options: BOEExportOptions): Promise<Blob> {
  const {
    wbsElements,
    requirements,
    contractPeriods,
    contractTitle = 'Government Contract',
    companyName = 'Friends From The City, LLC',
    rfpNumber = 'TBD'
  } = options

  // Calculate totals
  const totalHours = wbsElements.reduce((sum, el) => sum + getElementTotalHours(el), 0)
  const totalRisks = wbsElements.reduce((sum, el) => sum + el.risks.length, 0)
  const avgQuality = wbsElements.length > 0
    ? Math.round(wbsElements.reduce((sum, el) => sum + el.qualityScore, 0) / wbsElements.length)
    : 0
  const mappedReqs = requirements.filter(r => r.linkedWbsIds.length > 0).length
  const shallReqs = requirements.filter(r => r.type === 'shall')
  const shallMapped = shallReqs.filter(r => r.linkedWbsIds.length > 0).length

  // Calculate hours by period
  const hoursByPeriod: PeriodHours = { base: 0, option1: 0, option2: 0, option3: 0, option4: 0 }
  wbsElements.forEach(el => {
    el.laborEstimates.forEach(labor => {
      Object.keys(labor.hoursByPeriod).forEach(key => {
        hoursByPeriod[key as keyof PeriodHours] += labor.hoursByPeriod[key as keyof PeriodHours]
      })
    })
  })

  // Build document
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 } // 11pt
        }
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          run: { size: 48, bold: true, color: '1E3A5F' },
          paragraph: { spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER }
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 32, bold: true, color: '1E3A5F' },
          paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 }
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 26, bold: true, color: '2563EB' },
          paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 }
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 24, bold: true, color: '374151' },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 }
        }
      ]
    },
    numbering: {
      config: [
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
          reference: 'assumption-list',
          levels: [{
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }]
        }
      ]
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: `${companyName} — Basis of Estimate`, size: 18, color: '6B7280' })
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Page ', size: 18 }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                new TextRun({ text: ' of ', size: 18 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 })
              ]
            })
          ]
        })
      },
      children: [
        // ═══════════════════════════════════════════════════════════════
        // TITLE PAGE
        // ═══════════════════════════════════════════════════════════════
        new Paragraph({
          heading: HeadingLevel.TITLE,
          spacing: { before: 2000 },
          children: [new TextRun('Basis of Estimate')]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: contractTitle, size: 28, color: '4B5563' })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `RFP: ${rfpNumber}`, size: 22, color: '6B7280' })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 800 },
          children: [new TextRun({ text: companyName, size: 24, bold: true })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 1200 },
          children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString()}`, size: 20, color: '6B7280' })]
        }),

        // Page break
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════════════════════════════════════════════════
        // EXECUTIVE SUMMARY
        // ═══════════════════════════════════════════════════════════════
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('Executive Summary')]
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun(
            `This Basis of Estimate (BOE) documents the labor hours and technical approach for ${wbsElements.length} ` +
            `Work Breakdown Structure (WBS) elements totaling ${totalHours.toLocaleString()} hours across all contract periods.`
          )]
        }),

        // Summary stats table
        new Table({
          columnWidths: [4680, 4680],
          rows: [
            new TableRow({
              children: [
                createCell('Metric', { bold: true, width: 4680, shading: headerShading }),
                createCell('Value', { bold: true, width: 4680, shading: headerShading, alignment: AlignmentType.RIGHT })
              ]
            }),
            new TableRow({
              children: [
                createCell('Total Labor Hours', { width: 4680 }),
                createNumberCell(totalHours, { width: 4680, bold: true })
              ]
            }),
            new TableRow({
              children: [
                createCell('WBS Elements', { width: 4680, shading: altRowShading }),
                createNumberCell(wbsElements.length, { width: 4680, shading: altRowShading })
              ]
            }),
            new TableRow({
              children: [
                createCell('Requirements Traced', { width: 4680 }),
                createCell(`${mappedReqs} of ${requirements.length} (${requirements.length > 0 ? Math.round(mappedReqs / requirements.length * 100) : 0}%)`, { width: 4680, alignment: AlignmentType.RIGHT })
              ]
            }),
            new TableRow({
              children: [
                createCell('"Shall" Requirements Covered', { width: 4680, shading: altRowShading }),
                createCell(`${shallMapped} of ${shallReqs.length} (${shallReqs.length > 0 ? Math.round(shallMapped / shallReqs.length * 100) : 0}%)`, { width: 4680, shading: altRowShading, alignment: AlignmentType.RIGHT })
              ]
            }),
            new TableRow({
              children: [
                createCell('Average Quality Score', { width: 4680 }),
                createCell(`${avgQuality}%`, { width: 4680, alignment: AlignmentType.RIGHT })
              ]
            }),
            new TableRow({
              children: [
                createCell('Identified Risks', { width: 4680, shading: altRowShading }),
                createNumberCell(totalRisks, { width: 4680, shading: altRowShading })
              ]
            })
          ]
        }),

        // Hours by period
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun('Hours by Contract Period')]
        }),
        new Table({
          columnWidths: contractPeriods.map(() => Math.floor(9360 / contractPeriods.length)),
          rows: [
            new TableRow({
              children: contractPeriods.map(p =>
                createCell(p.label, { bold: true, width: Math.floor(9360 / contractPeriods.length), shading: headerShading, alignment: AlignmentType.CENTER })
              )
            }),
            new TableRow({
              children: contractPeriods.map(p =>
                createNumberCell(hoursByPeriod[p.key], { width: Math.floor(9360 / contractPeriods.length) })
              )
            })
          ]
        }),

        // Page break before requirements
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════════════════════════════════════════════════
        // REQUIREMENTS TRACEABILITY
        // ═══════════════════════════════════════════════════════════════
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('Requirements Traceability')]
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun(
            `The following table maps ${requirements.length} SOO/PWS requirements to their corresponding WBS elements.`
          )]
        }),

        // Requirements table
        new Table({
          columnWidths: [1500, 3000, 2000, 2860],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                createCell('Ref #', { bold: true, width: 1500, shading: headerShading }),
                createCell('Requirement', { bold: true, width: 3000, shading: headerShading }),
                createCell('Type', { bold: true, width: 2000, shading: headerShading }),
                createCell('WBS Coverage', { bold: true, width: 2860, shading: headerShading })
              ]
            }),
            ...requirements.map((req, idx) => {
              const linkedWbs = wbsElements.filter(el => req.linkedWbsIds.includes(el.id))
              const coverage = linkedWbs.length > 0
                ? linkedWbs.map(el => el.wbsNumber).join(', ')
                : 'NOT MAPPED'
              return new TableRow({
                children: [
                  createCell(req.referenceNumber, { width: 1500, shading: idx % 2 === 1 ? altRowShading : undefined }),
                  createCell(req.title, { width: 3000, shading: idx % 2 === 1 ? altRowShading : undefined }),
                  createCell(req.type.toUpperCase(), { width: 2000, shading: idx % 2 === 1 ? altRowShading : undefined }),
                  createCell(coverage, { width: 2860, shading: idx % 2 === 1 ? altRowShading : undefined })
                ]
              })
            })
          ]
        }),

        // Page break before WBS details
        new Paragraph({ children: [new PageBreak()] }),

        // ═══════════════════════════════════════════════════════════════
        // WBS SUMMARY
        // ═══════════════════════════════════════════════════════════════
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun('WBS Summary')]
        }),
        new Table({
          columnWidths: [1200, 4000, 2000, 2160],
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                createCell('WBS #', { bold: true, width: 1200, shading: headerShading }),
                createCell('Title', { bold: true, width: 4000, shading: headerShading }),
                createCell('Total Hours', { bold: true, width: 2000, shading: headerShading, alignment: AlignmentType.RIGHT }),
                createCell('Quality', { bold: true, width: 2160, shading: headerShading, alignment: AlignmentType.CENTER })
              ]
            }),
            ...wbsElements.map((el, idx) => new TableRow({
              children: [
                createCell(el.wbsNumber, { width: 1200, shading: idx % 2 === 1 ? altRowShading : undefined }),
                createCell(el.title, { width: 4000, shading: idx % 2 === 1 ? altRowShading : undefined }),
                createNumberCell(getElementTotalHours(el), { width: 2000, shading: idx % 2 === 1 ? altRowShading : undefined }),
                createCell(`${el.qualityScore}%`, { width: 2160, shading: idx % 2 === 1 ? altRowShading : undefined, alignment: AlignmentType.CENTER })
              ]
            })),
            // Total row
            new TableRow({
              children: [
                createCell('', { width: 1200, shading: headerShading }),
                createCell('TOTAL', { bold: true, width: 4000, shading: headerShading }),
                createNumberCell(totalHours, { width: 2000, shading: headerShading, bold: true }),
                createCell('', { width: 2160, shading: headerShading })
              ]
            })
          ]
        }),

        // ═══════════════════════════════════════════════════════════════
        // DETAILED WBS ELEMENTS
        // ═══════════════════════════════════════════════════════════════
        ...wbsElements.flatMap((element, idx) => {
          const elementHours = getElementTotalHours(element)
          const linkedReqs = requirements.filter(r => r.linkedWbsIds.includes(element.id))

          const content: (Paragraph | Table)[] = []

          // Page break before each WBS (except first which follows summary)
          if (idx > 0) {
            content.push(new Paragraph({ children: [new PageBreak()] }))
          }

          // WBS heading
          content.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun(`${element.wbsNumber} — ${element.title}`)]
          }))

          // Meta info
          if (element.sowReference || element.clin) {
            content.push(new Paragraph({
              spacing: { after: 100 },
              children: [
                new TextRun({ text: 'Reference: ', bold: true, size: 20 }),
                new TextRun({ text: [element.sowReference, element.clin ? `CLIN ${element.clin}` : ''].filter(Boolean).join(' | '), size: 20, color: '6B7280' })
              ]
            }))
          }

          // Description
          if (element.description) {
            content.push(new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [new TextRun('Description')]
            }))
            content.push(new Paragraph({
              children: [new TextRun(element.description)]
            }))
          }

          // Technical Approach
          if (element.technicalApproach) {
            content.push(new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [new TextRun('Technical Approach')]
            }))
            content.push(new Paragraph({
              children: [new TextRun(element.technicalApproach)]
            }))
          }

          // Linked Requirements
          if (linkedReqs.length > 0) {
            content.push(new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [new TextRun('Requirements Addressed')]
            }))
            linkedReqs.forEach(req => {
              content.push(new Paragraph({
                numbering: { reference: 'bullet-list', level: 0 },
                children: [
                  new TextRun({ text: `${req.referenceNumber}: `, bold: true }),
                  new TextRun(req.title)
                ]
              }))
            })
          }

          // Labor Breakdown
          if (element.laborEstimates.length > 0) {
            content.push(new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [new TextRun('Labor Breakdown')]
            }))

            const colWidth = Math.floor(9360 / (contractPeriods.length + 2))
            content.push(new Table({
              columnWidths: [2500, ...contractPeriods.map(() => colWidth), colWidth],
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: [
                    createCell('Role', { bold: true, width: 2500, shading: headerShading }),
                    ...contractPeriods.map(p =>
                      createCell(p.label, { bold: true, width: colWidth, shading: headerShading, alignment: AlignmentType.RIGHT })
                    ),
                    createCell('Total', { bold: true, width: colWidth, shading: headerShading, alignment: AlignmentType.RIGHT })
                  ]
                }),
                ...element.laborEstimates.map((labor, lIdx) => new TableRow({
                  children: [
                    createCell(labor.roleName, { width: 2500, shading: lIdx % 2 === 1 ? altRowShading : undefined }),
                    ...contractPeriods.map(p =>
                      createNumberCell(labor.hoursByPeriod[p.key], { width: colWidth, shading: lIdx % 2 === 1 ? altRowShading : undefined })
                    ),
                    createNumberCell(getTotalHours(labor.hoursByPeriod), { width: colWidth, shading: lIdx % 2 === 1 ? altRowShading : undefined, bold: true })
                  ]
                })),
                // Subtotal row
                new TableRow({
                  children: [
                    createCell('Subtotal', { bold: true, width: 2500, shading: headerShading }),
                    ...contractPeriods.map(p => {
                      const periodTotal = element.laborEstimates.reduce((sum, l) => sum + l.hoursByPeriod[p.key], 0)
                      return createNumberCell(periodTotal, { width: colWidth, shading: headerShading, bold: true })
                    }),
                    createNumberCell(elementHours, { width: colWidth, shading: headerShading, bold: true })
                  ]
                })
              ]
            }))

            // Labor rationales
            const rationales = element.laborEstimates.filter(l => l.rationale)
            if (rationales.length > 0) {
              content.push(new Paragraph({
                spacing: { before: 200 },
                children: [new TextRun({ text: 'Rationale:', bold: true, italics: true, size: 20 })]
              }))
              rationales.forEach(labor => {
                content.push(new Paragraph({
                  numbering: { reference: 'bullet-list', level: 0 },
                  children: [
                    new TextRun({ text: `${labor.roleName}: `, bold: true, size: 20 }),
                    new TextRun({ text: labor.rationale, size: 20 })
                  ]
                }))
              })
            }
          }

          // Assumptions
          if (element.assumptions.length > 0) {
            content.push(new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [new TextRun('Assumptions')]
            }))
            element.assumptions.forEach((assumption, aIdx) => {
              content.push(new Paragraph({
                numbering: { reference: 'assumption-list', level: 0 },
                children: [new TextRun(assumption)]
              }))
            })
          }

          // Risks
          if (element.risks.length > 0) {
            content.push(new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [new TextRun('Risks')]
            }))
            content.push(new Table({
              columnWidths: [4000, 1200, 1200, 2960],
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: [
                    createCell('Risk', { bold: true, width: 4000, shading: headerShading }),
                    createCell('P × I', { bold: true, width: 1200, shading: headerShading, alignment: AlignmentType.CENTER }),
                    createCell('Status', { bold: true, width: 1200, shading: headerShading, alignment: AlignmentType.CENTER }),
                    createCell('Mitigation', { bold: true, width: 2960, shading: headerShading })
                  ]
                }),
                ...element.risks.map((risk, rIdx) => new TableRow({
                  children: [
                    createCell(risk.description, { width: 4000, shading: rIdx % 2 === 1 ? altRowShading : undefined }),
                    createCell(`${risk.probability} × ${risk.impact} = ${getRiskScore(risk)}`, { width: 1200, shading: rIdx % 2 === 1 ? altRowShading : undefined, alignment: AlignmentType.CENTER }),
                    createCell(risk.status, { width: 1200, shading: rIdx % 2 === 1 ? altRowShading : undefined, alignment: AlignmentType.CENTER }),
                    createCell(risk.mitigation, { width: 2960, shading: rIdx % 2 === 1 ? altRowShading : undefined })
                  ]
                }))
              ]
            }))
          }

          return content
        })
      ]
    }]
  })

  // Generate and return blob
  return await Packer.toBlob(doc)
}

// Helper to trigger download in browser
export function downloadBOE(blob: Blob, filename: string = 'Basis-of-Estimate.docx') {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}