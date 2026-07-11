import { Skeleton } from "./skeleton"

// Generic tab content loading skeleton
export function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header area */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Content blocks */}
      <div className="grid gap-4">
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <Skeleton className="h-5 w-1/3 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <Skeleton className="h-5 w-1/4 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <Skeleton className="h-5 w-2/5 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  )
}

// Mimics a proposal card in the dashboard
export function CardSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      {/* Title */}
      <Skeleton className="h-4 w-3/4 mb-3" />

      {/* Badges row */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>

      {/* Client */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-48" />
      </div>

      {/* Metadata lines */}
      <div className="space-y-2 border-t border-gray-100 pt-3">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

// Mimics a table row
export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-5 w-16 rounded-md" />
      <Skeleton className="h-4 w-16 ml-auto" />
    </div>
  )
}

// Mimics a requirement card in the estimate tab
export function RequirementSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <Skeleton className="h-5 w-5 rounded mt-0.5" />

        <div className="flex-1">
          {/* Badge and ID */}
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-5 w-12 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>

          {/* Title */}
          <Skeleton className="h-4 w-full mb-2" />

          {/* Description */}
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  )
}

// Mimics a WBS element card
export function WBSElementSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      {/* Header with WBS number and title */}
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="h-6 w-16 rounded" />
        <div className="flex-1">
          <Skeleton className="h-5 w-2/3 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
    </div>
  )
}

// Loading grid of card skeletons
export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
