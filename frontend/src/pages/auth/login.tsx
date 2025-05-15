"use client";

import type React from "react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { authApi } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LoginCredentials } from "@/types/auth";

const GOOGLE_CLIENT_ID =
  "283603920028-qgenn6n9029r6ovjsbomooql3o0o6lu6.apps.googleusercontent.com";
const REDIRECT_URI = "https://catsightai.ngrok.app/auth/login";

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { setHasTokenAndUser } = useSession();
  const [email, setEmail] = useState("michaeljames.carnaje@g.msuiit.edu.ph");
  const [password, setPassword] = useState("password");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      const { tokens, user } = data;
      if (tokens) {
        setHasTokenAndUser(tokens.access, tokens.refresh, user);
      }
    },
    onError: (error) => {
      toast({
        title: "Login failed",
        description: "Invalid email or password.",
        variant: "destructive",
      });
    },
  });

  const googleAuthMutation = useMutation({
    mutationFn: (code: string) => authApi.googleAuth({ token: code }),
    onSuccess: (data) => {
      const { tokens, user } = data;
      if (tokens) {
        setHasTokenAndUser(tokens.access, tokens.refresh, user);
      }
    },
    onError: (error) => {
      toast({
        title: "Login failed",
        description: "Invalid email or password.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      handleGoogleCallback(code);
    }
  }, [searchParams]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.endsWith("@g.msuiit.edu.ph")) {
      toast({
        title: "Invalid email",
        description: "Only @g.msuiit.edu.ph email addresses are allowed.",
        variant: "destructive",
      });
      return;
    }

    await loginMutation.mutateAsync({ email, password });
  };

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth
    // The redirect_uri must exactly match one of the authorized redirect URIs in Google OAuth Console
    const scope = "email profile";

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  };

  const handleGoogleCallback = async (code: string) => {
    await googleAuthMutation.mutateAsync(code);
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen p-4 sm:p-6 md:p-8">
      <Card className="z-10 w-full max-w-sm shadow-lg sm:max-w-md lg:max-w-lg">
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
          <CardDescription className="text-sm">
            Sign in to access the document management system
          </CardDescription>
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
                  <Label htmlFor="email" className="text-sm">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@g.msuiit.edu.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm">
                      Password
                    </Label>
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
                <Button
                  type="submit"
                  className="w-full h-10 mt-4"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="google">
              <div className="mt-3 space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                  Sign in with your MSU-IIT Google account
                </p>
                <Button
                  onClick={handleGoogleLogin}
                  className="w-full h-10"
                  variant="outline"
                  disabled={googleAuthMutation.isPending}
                >
                  {googleAuthMutation.isPending
                    ? "Signing in..."
                    : "Sign in with Google"}
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
  );
}
