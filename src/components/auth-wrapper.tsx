"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = () => {
      console.log("AuthWrapper: Checking authentication...")
      const token = localStorage.getItem("limahost_token")
      const user = localStorage.getItem("limahost_user")

      console.log("AuthWrapper: Token exists:", !!token)
      console.log("AuthWrapper: User exists:", !!user)

      if (!token || !user) {
        console.log("AuthWrapper: No token or user found, setting isAuthenticated to false")
        setIsAuthenticated(false)
        setIsLoading(false)
        return
      }

      // Validate token by checking user info
      try {
        const userInfo = JSON.parse(user)
        console.log("AuthWrapper: User info parsed:", userInfo)
        
        if (userInfo && userInfo.email) {
          console.log("AuthWrapper: User has email, setting isAuthenticated to true")
          setIsAuthenticated(true)
        } else {
          console.log("AuthWrapper: User info invalid, setting isAuthenticated to false")
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error("AuthWrapper: Error parsing user info:", error)
        setIsAuthenticated(false)
      }

      setIsLoading(false)
    }

    checkAuth()
  }, [])

  useEffect(() => {
    console.log("AuthWrapper: Effect triggered - isLoading:", isLoading, "isAuthenticated:", isAuthenticated)
    if (!isLoading && !isAuthenticated) {
      console.log("AuthWrapper: Redirecting to login...")
      router.push("/login")
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    console.log("AuthWrapper: Not authenticated, returning null (will redirect)")
    return null // Will redirect to login
  }

  console.log("AuthWrapper: Authenticated, rendering children")
  return <>{children}</>
}