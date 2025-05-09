"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useNavigate, Link } from "react-router-dom"
import { useRegister, authApi } from "@/lib/auth"
import { useToast } from "@/components/ui/use-toast"

export default function RegisterPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const register = useRegister()

  useEffect(() => {
    // Redirect if already logged in
    if (authApi.isAuthenticated()) {
      navigate("/dashboard", { replace: true })
    }
  }, [navigate])

  // Auto-generate username from email when email changes
  useEffect(() => {
    if (email && !username) {
      // Get the part before @ in the email
      const emailUsername = email.split('@')[0]
      setUsername(emailUsername)
    }
  }, [email, username])

  const handleRegister = async (e: React.FormEvent) => {
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

    if (password !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Password and confirm password do not match.",
        variant: "destructive",
      })
      return
    }

    try {
      await register.mutateAsync({
        first_name: firstName,
        last_name: lastName,
        username,
        email,
        password,
        password_confirm: confirmPassword
      })
      navigate("/onboarding", { replace: true })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error
        ? error.message
        : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "An error occurred during registration"

      toast({
        title: "Registration failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-sm shadow-lg sm:max-w-md lg:max-w-lg">
        <CardHeader className="pb-4 space-y-1 text-center">
          <CardTitle className="text-xl font-bold sm:text-2xl">Create an Account</CardTitle>
          <CardDescription className="text-sm">Sign up to access the document management system</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-sm">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-sm">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm">Username</Label>
              <Input
                id="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-9"
              />
            </div>
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
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-9"
              />
            </div>
            <Button type="submit" className="w-full mt-2 h-9" disabled={register.isPending}>
              {register.isPending ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col pb-6">
          <div className="text-sm text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
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