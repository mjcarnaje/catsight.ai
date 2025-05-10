"use client"

import type React from "react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useGoogleAuth, useLogin, authApi } from "@/lib/auth"
import axios from "axios"
import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"

const GOOGLE_CLIENT_ID = "283603920028-qgenn6n9029r6ovjsbomooql3o0o6lu6.apps.googleusercontent.com";
const REDIRECT_URI = "https://catsightai.ngrok.app/auth/login"

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Clear any previous errors when form changes
  useEffect(() => {
    setLoginError("")
  }, [email, password])

  // Handle Google OAuth redirect
  useEffect(() => {
    const code = searchParams.get("code")
    if (code) {
      handleGoogleCallback(code)
    }
  }, [])

  const login = useLogin();

  const googleAuth = useGoogleAuth({
    onSuccess: () => {
      navigate("/dashboard");
    }
  });

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")

    // Check if email has the required domain
    if (!email.endsWith("@g.msuiit.edu.ph")) {
      setLoginError("Only @g.msuiit.edu.ph email addresses are allowed.")
      toast({
        title: "Invalid email",
        description: "Only @g.msuiit.edu.ph email addresses are allowed.",
        variant: "destructive",
      })
      return
    }

    try {
      console.log("Attempting login with:", { email, password: "********" })

      // Call the login mutation and wait for it to complete
      const result = await login.mutateAsync({ email, password })
      console.log("Login successful:", result)

      // Check if we have the tokens stored properly
      const accessToken = localStorage.getItem("access_token")
      if (!accessToken) {
        console.error("No access token after login")
        throw new Error("Authentication failed. Please try again.")
      }

      // Verify authentication state
      if (!authApi.isAuthenticated()) {
        console.error("Auth state not updated after successful login")
        throw new Error("Authentication state error. Please try again.")
      }

      // Navigate to dashboard after successful login
      navigate("/dashboard")
    } catch (error: unknown) {
      console.error("Login error:", error)

      let errorMessage = "Authentication failed. Please check your credentials."

      if (axios.isAxiosError(error)) {
        // Get detailed error message from the axios error
        errorMessage = error.response?.data?.detail ||
          error.response?.data?.message ||
          error.response?.data?.error ||
          "Authentication failed. Please check your credentials."

        console.error("Response status:", error.response?.status)
        console.error("Response data:", error.response?.data)
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      setLoginError(errorMessage)
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
      console.log("Processing Google authentication code...")
      const result = await googleAuth.mutateAsync(code)
      console.log("Google auth successful:", result)

      // Double-check if tokens were stored properly
      const accessToken = localStorage.getItem("access_token")
      if (!accessToken) {
        console.error("No access token after Google login")
        throw new Error("Google authentication failed. Please try again.")
      }

      // Verify authentication state
      if (!authApi.isAuthenticated()) {
        console.error("Auth state not updated after successful Google login")
        throw new Error("Authentication state error. Please try again.")
      }

      // We have the onSuccess callback in googleAuth hook, but let's make sure navigation happens
      navigate("/dashboard")
    } catch (error) {
      console.error("Google login error:", error)
      const errorMessage = error instanceof Error
        ? error.message
        : (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Could not authenticate with Google. Please try again."

      toast({
        title: "Google login failed",
        description: errorMessage,
        variant: "destructive",
      })

      // Clear the URL after failed login
      navigate("/login")
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-sm shadow-lg sm:max-w-md lg:max-w-lg">
        <CardHeader className="pb-4 space-y-1 text-center">
          <CardTitle className="flex items-center justify-center">
            <div className="flex items-center gap-2 transition-transform duration-75 hover:scale-[1.01]">
              <img
                src="/icon.png"
                alt="CATSight.AI Logo"
                className="w-auto h-7 sm:h-8"
              />
              <span className="text-lg font-bold text-transparent sm:text-xl bg-gradient-to-r from-primary to-accent bg-clip-text">
                CATSight.AI
              </span>
            </div>
          </CardTitle>
          <CardDescription className="text-sm">Sign in to access the document management system</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
            </TabsList>
            <TabsContent value="email">
              <form onSubmit={handleEmailLogin} className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@g.msuiit.edu.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm">Password</Label>
                    <Button variant="link" className="h-auto px-0 py-0 text-xs">
                      Forgot password?
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute -translate-y-1/2 right-1 top-1/2 h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                      <span className="sr-only">
                        {showPassword ? "Hide password" : "Show password"}
                      </span>
                    </Button>
                  </div>
                </div>
                {loginError && (
                  <div className="text-sm text-destructive">
                    {loginError}
                  </div>
                )}
                <Button type="submit" className="w-full mt-2 h-9" disabled={login.isPending}>
                  {login.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="google">
              <div className="mt-3 space-y-4">
                <p className="text-sm text-center text-muted-foreground">Sign in with your MSU-IIT Google account</p>
                <Button onClick={handleGoogleLogin} className="w-full h-9" variant="outline" disabled={googleAuth.isPending}>
                  {googleAuth.isPending ? "Signing in..." : "Sign in with Google"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col pb-6">
          <div className="text-sm text-center">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
          <p className="mt-3 text-xs text-center text-muted-foreground">
            Only users with @g.msuiit.edu.ph email addresses are allowed access.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
