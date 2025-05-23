import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { useUpdateProfile } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading } = useSession();
  const updateProfile = useUpdateProfile();

  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(
    user?.avatar
  );
  const [firstName, setFirstName] = useState<string>(user?.first_name || "");
  const [lastName, setLastName] = useState<string>(user?.last_name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.is_onboarded) {
      navigate("/dashboard");
    }
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSkip = () => {
    const formData = new FormData();
    formData.append("is_onboarded", "true");

    updateProfile.mutate(formData, {
      onSuccess: () => {
        toast({
          title: "Profile completed",
          description: "You can always update your profile later",
        });
      },
      onError: (error) => {
        toast({
          title: "Error updating profile",
          description:
            error instanceof Error ? error.message : "An error occurred",
          variant: "destructive",
        });
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("is_onboarded", "true");
      formData.append("first_name", firstName);
      formData.append("last_name", lastName);

      if (avatar) {
        formData.append("avatar", avatar);
      }

      await updateProfile.mutateAsync(formData);

      toast({
        title: "Profile updated successfully",
        description: "Your profile has been completed",
      });
    } catch (error) {
      toast({
        title: "Error updating profile",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">Loading...</div>
    );
  }

  const initials = user
    ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`
    : "U";

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            Complete Your Profile
          </CardTitle>
          <CardDescription>
            Let's add a profile picture to complete your account setup
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar
                className="w-32 h-32 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <AvatarImage src={avatarPreview} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Profile Picture
                </Button>
                <Input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  Click the avatar or button to upload an image
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={handleSkip}>
              Skip for Now
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Complete Profile"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
