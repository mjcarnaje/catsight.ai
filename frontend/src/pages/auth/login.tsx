"use client"

import type React from "react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { authApi, LoginCredentials, useGoogleAuth } from "@/lib/auth"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

// Google OAuth Client ID from environment variables
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "283603920028-qgenn6n9029r6ovjsbomooql3o0o6lu6.apps.googleusercontent.com";
// Must match exactly with what's configured in Google Cloud Console
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URL || "http://localhost:3000/auth/login";

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const [email, setEmail] = useState("michaeljames.carnaje@g.msuiit.edu.ph")
  const [password, setPassword] = useState("javascript")

  // Handle Google OAuth redirect
  useEffect(() => {
    const code = searchParams.get("code")
    if (code) {
      handleGoogleCallback(code)
    }
  }, [])

  const login = useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      localStorage.setItem("access_token", data.tokens.access);
      localStorage.setItem("refresh_token", data.tokens.refresh);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      })
    }
  });

  const googleAuth = useGoogleAuth({
    onSuccess: () => {
      navigate("/dashboard");
    }
  });

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check if email has the required domain
    if (!email.endsWith("@g.msuiit.edu.ph")) {
      toast({
        title: "Invalid email",
        description: "Only @g.msuiit.edu.ph email addresses are allowed.",
        variant: "destructive",
      })
      return
    }

    try {
      await login.mutateAsync({ email, password })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error
        ? error.message
        : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "An error occurred during login"

      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth
    // The redirect_uri must exactly match one of the authorized redirect URIs in Google OAuth Console
    const scope = "email profile"

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`
  }

  const handleGoogleCallback = async (code: string) => {
    try {
      await googleAuth.mutateAsync(code)

      // Clear the URL after successful login
      window.history.replaceState({}, document.title, "/auth/login")
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Could not authenticate with Google. Please try again."

      toast({
        title: "Google login failed",
        description: errorMessage,
        variant: "destructive",
      })

      // Clear the URL after failed login
      window.history.replaceState({}, document.title, "/auth/login")
    }
  }

  return (
    <div className="flex items-center justify-center h-screen">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Intel Docs</CardTitle>
          <CardDescription>Sign in to access the document management system</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
            </TabsList>
            <TabsContent value="email">
              <form onSubmit={handleEmailLogin} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@g.msuiit.edu.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Button variant="link" className="px-0 text-xs">
                      Forgot password?
                    </Button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={login.isPending}>
                  {login.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="google">
              <div className="mt-4 space-y-4">
                <p className="text-sm text-center text-muted-foreground">Sign in with your MSU-IIT Google account</p>
                <Button onClick={handleGoogleLogin} className="w-full" variant="outline" disabled={googleAuth.isPending}>
                  {googleAuth.isPending ? "Signing in..." : "Sign in with Google"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col">
          <div className="mt-4 text-sm text-center">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
          <p className="mt-4 text-xs text-center text-muted-foreground">
            Only users with @g.msuiit.edu.ph email addresses are allowed access.
          </p>
        </CardFooter>
      </Card>
    </div>

  )
}
