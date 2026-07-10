/**
 * Profit Rate Resolver
 *
 * THE single place that decides the effective profit rate.
 * All pricing call sites MUST obtain profit rate via this resolver.
 *
 * Resolution order:
 * 1. Explicit user-set margin for the role/proposal (if present)
 * 2. Contract-type default from profitTargets (if contract type known)
 * 3. Error if neither exists
 *
 * FFP Risk Levels:
 * - FFP default (this resolver): 10% (Low risk)
 * - FFP Medium (12%): Only via explicit role/proposal margin
 * - FFP High (15%+): Only via explicit role/proposal margin
 *
 * Rationale: Proposals don't yet capture risk level, so Medium/High
 * are reachable only through explicit margin override. When proposal
 * risk level field is added (Phase 5 backlog), the resolver can
 * accept risk level as input and return the appropriate FFP target.
 */

import { PricingValidationError } from './types'

/**
 * Contract types and their default profit targets.
 * NOTE: Using 'ffp' (Fixed Firm Price) to match app-context.tsx ContractType.
 */
export type ContractType = 'tm' | 'ffp' | 'cpff' | 'cpif' | 'hybrid' | 'gsa'

/**
 * Default profit targets by contract type.
 *
 * FFP uses Low risk (10%) as default. Medium (12%) and High (15%)
 * require explicit margin selection until proposal risk level is implemented.
 */
export const DEFAULT_PROFIT_TARGETS: Record<ContractType, number> = {
  tm: 0.08,      // Time & Materials: 8%
  ffp: 0.10,     // Fixed Firm Price: 10% (Low risk default)
  cpff: 0.08,    // Cost Plus Fixed Fee: 8%
  cpif: 0.10,    // Cost Plus Incentive Fee: 10%
  hybrid: 0.10,  // Hybrid: 10%
  gsa: 0.08,     // GSA Schedule: 8%
}

/**
 * Input for resolving profit rate.
 */
export interface ProfitResolverInput {
  /** Explicit user-set profit margin (as decimal, e.g., 0.10 for 10%) */
  explicitProfitRate?: number | null
  /** Contract type for default lookup */
  contractType?: ContractType | null
  /** Custom profit targets (overrides DEFAULT_PROFIT_TARGETS) */
  profitTargets?: Partial<Record<ContractType, number>>
}

/**
 * Result from profit resolution.
 */
export interface ProfitResolverResult {
  /** The resolved profit rate (decimal) */
  profitRate: number
  /** Source of the rate */
  source: 'explicit' | 'contract_default' | 'fallback'
  /** Contract type used (if applicable) */
  contractType?: ContractType
}

/**
 * Resolve the effective profit rate.
 *
 * Resolution order:
 * 1. Explicit user-set margin (if present and valid)
 * 2. Contract-type default (if contract type known)
 * 3. Error if neither exists
 *
 * @param input - Resolution input
 * @returns Resolved profit rate and source
 * @throws PricingValidationError if no rate can be resolved
 */
export function resolveProfitRate(input: ProfitResolverInput): ProfitResolverResult {
  const { explicitProfitRate, contractType, profitTargets } = input

  // 1. Explicit user-set margin takes precedence
  if (explicitProfitRate !== undefined && explicitProfitRate !== null) {
    // Validate the explicit rate
    if (explicitProfitRate < 0) {
      throw new PricingValidationError(
        'Explicit profit rate cannot be negative',
        'explicitProfitRate',
        explicitProfitRate
      )
    }
    if (explicitProfitRate >= 1) {
      throw new PricingValidationError(
        'Explicit profit rate must be less than 100% (1.0)',
        'explicitProfitRate',
        explicitProfitRate
      )
    }
    return {
      profitRate: explicitProfitRate,
      source: 'explicit',
    }
  }

  // 2. Contract-type default
  if (contractType) {
    const targets = { ...DEFAULT_PROFIT_TARGETS, ...profitTargets }
    const defaultRate = targets[contractType]
    if (defaultRate !== undefined) {
      return {
        profitRate: defaultRate,
        source: 'contract_default',
        contractType,
      }
    }
  }

  // 3. No rate available - error
  throw new PricingValidationError(
    'Cannot resolve profit rate: no explicit rate provided and no contract type for default lookup',
    'profitRate',
    { explicitProfitRate, contractType }
  )
}

/**
 * Resolve profit rate with fallback to a specific default.
 * Use this when you have a known fallback value.
 *
 * @param input - Resolution input
 * @param fallbackRate - Fallback rate if resolution fails
 * @returns Resolved profit rate and source
 */
export function resolveProfitRateWithFallback(
  input: ProfitResolverInput,
  fallbackRate: number
): ProfitResolverResult {
  try {
    return resolveProfitRate(input)
  } catch {
    return {
      profitRate: fallbackRate,
      source: 'fallback',
    }
  }
}
