# TrueBid Design System

## Stack

shadcn/ui + Tailwind CSS + Geist Sans font + Lucide icons

## Component Rules

- Always use `<Button>` from `components/ui/button` — never raw `<button>`
  Exception: tab navigation and toggle/selection buttons with complex active state logic
- Always use `<Card>` for any white/bordered container — never inline `bg-white rounded-lg border`
- Always use `<Input>`, `<Textarea>`, `<Select>` from `components/ui` — never raw HTML equivalents
- Always use `<EmptyState>` for empty list/tab states — never inline implementations
- Always use `<ErrorAlert>` for error display — never inline red text or ad-hoc alert boxes

## Typography Scale

- `text-xs`: labels, hints, metadata, badges, timestamps
- `text-sm`: body text, descriptions, form content (dominant size)
- `text-base`: intentionally avoided — jump from sm to lg
- `text-lg`: section subheadings, slightly emphasized content
- `text-xl`: section headings, tab titles
- `text-2xl`: page headings, large metric values
- `text-3xl`: hero/display headings only

## Error Display Rules

- `toast.success()` / `toast.error()`: operation feedback (save, add, remove, copy, generate)
- `<ErrorAlert variant="form">`: form-level errors (auth failures, API errors on a form)
- `<ErrorAlert variant="inline">`: field-level validation below an input
- `<ErrorAlert variant="page">`: fatal errors (failed upload, failed page load)
- Never use bare `<p className="text-red-...">` for errors

## Loading State Rules

- Initial page/tab data load: `<Skeleton>` rows matching the content shape
- Button actions (save, submit, generate): `<Loader2 className="animate-spin">` in button + disabled
- Background sync / autosave: `<SaveStatus>` component (idle/saving/saved/error)
- AI generation: progress bar with percentage (already implemented in estimate-tab)

## Empty State Rules

- Always use `<EmptyState>` component
- Icon: use a Lucide icon relevant to the content type
- Title: describe what's missing, not that it's empty ("No WBS elements yet", not "Empty")
- Description: tell the user what to do next
- CTA: if there's a primary action, always include it

## Spacing

- Cards: use `p-6` as default, `p-4` for compact/dense contexts, `p-8` for spacious hero cards
- Sections within a tab: `gap-6` between major sections
- Form fields: `space-y-4` between fields
- Never use arbitrary values: `p-[14px]`, `mt-[23px]`, etc.

## Accessibility Requirements

- All icon-only buttons must have `aria-label` describing the action
- All form inputs must have an associated `<Label htmlFor="...">`
- Placeholder text is not a substitute for a label
- Decorative icons must have `aria-hidden="true"`
- Interactive custom elements need `onKeyDown` handlers for Enter/Space

## Utility Functions (lib/utils.ts)

- `formatCurrency(value, decimals?)` — always use for money display
- `formatDate(dateString)` — always use for date display
- `cn(...classes)` — always use for conditional className merging

## Shared Data (lib/solicitation-type.ts)

- `contractTypeLabels` — canonical contract type display names (accepts both `'ffp'` and `'FFP'` keys)
- `setAsideLabels` — canonical set-aside display names (accepts both slug and display keys)
- Never define local copies of these maps in components
