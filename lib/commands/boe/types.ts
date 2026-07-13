/**
 * BOE Command Types
 *
 * Type definitions for BOE artifact commands.
 */

/**
 * Input for generating a BOE artifact.
 */
export interface GenerateBOEArtifactInput {
  proposalId: string
  pricingScenarioId: string
}

/**
 * Output from generating a BOE artifact.
 */
export interface GenerateBOEArtifactOutput {
  artifactId: string
  contentHash: string
  engineVersion: string
  lineCount: number
  citationCount: number

  totals: {
    wbsEstimateTotal: number
    laborLoadingTotal: number
    grandTotal: number
  }

  conservation: {
    allConserved: boolean
  }

  generatedAt: string
}

/**
 * Uncited line detail for CITATION_INCOMPLETE error.
 */
export interface UncitedLineDetail {
  lineId: string
  lineType: 'wbs_estimate' | 'labor_loading'
  wbsCode: string | null
  taskTitle: string | null
  roleTitle: string
  periodLabel: string
  missingLinkage: 'no_wbs_task' | 'no_requirement_links'
}

/**
 * Input for creating a proposal snapshot.
 */
export interface CreateProposalSnapshotInput {
  proposalId: string
  artifactIds: string[]
  label?: string // Defaults to 'Submission'
}

/**
 * Output from creating a proposal snapshot.
 */
export interface CreateProposalSnapshotOutput {
  snapshotId: string
  compositeHash: string
  artifactCount: number
  submittedAt: string
}
