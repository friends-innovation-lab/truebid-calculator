/**
 * Shipley PDF configuration for the coaching engine.
 * The Shipley Proposal Guide is used as a knowledge base for AI coaching.
 */

/**
 * Gets the Shipley PDF URL from environment variables.
 * @throws Error if SHIPLEY_PDF_URL is not set
 */
export function getShipleyPdfUrl(): string {
  const url = process.env.SHIPLEY_PDF_URL

  if (!url) {
    throw new Error(
      'SHIPLEY_PDF_URL environment variable is not set. ' +
      'Please add it to your .env.local file.'
    )
  }

  return url
}

/**
 * Builds the document source object for the Claude API.
 * This format is required when passing PDF documents to Claude.
 */
export function buildShipleyDocumentSource(): {
  type: 'document'
  source: { type: 'url'; url: string }
  title: string
} {
  return {
    type: 'document',
    source: {
      type: 'url',
      url: getShipleyPdfUrl(),
    },
    title: 'Shipley Proposal Guide',
  }
}
