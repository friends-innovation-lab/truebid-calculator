/**
 * Phase 5: Labor Catalog Commands
 *
 * Commands and queries for managing tenant labor catalogs.
 */

// Types
export * from './types'

// Commands
export {
  createCreateLaborCategoryCommand,
  createLaborCategory,
  DisciplineNotFoundError,
  DuplicateCategoryKeyError,
} from './create-labor-category'

export {
  createUpdateLaborCategoryCommand,
  updateLaborCategory,
  LaborCategoryNotFoundError,
  InvalidDisciplineError,
} from './update-labor-category'

export {
  createAddCategoryAliasCommand,
  addCategoryAlias,
  CategoryNotFoundError,
  DuplicateAliasError,
  AliasConflictError,
} from './add-category-alias'

// Resolution (Query operations)
export {
  resolveLaborCategory,
  bulkResolveLaborCategories,
  getSalaryFromCategory,
  categoryNeedsSetup,
  getAvailableLevels,
  getPopulatedSteps,
} from './resolve-labor-category'
