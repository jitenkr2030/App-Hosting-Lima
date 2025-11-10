"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to landing page immediately
    router.push('/landing')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold mb-2">Redirecting to LimaHost...</h1>
        <p className="text-muted-foreground">Please wait while we load the landing page</p>
      </div>
    </div>
  )
}