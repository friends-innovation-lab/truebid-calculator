// Force static generation for auth pages (no server-side data fetching)
export const dynamic = 'force-static'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
