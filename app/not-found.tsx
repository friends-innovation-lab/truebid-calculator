import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-2 text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="mb-2 text-2xl font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mb-6 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
