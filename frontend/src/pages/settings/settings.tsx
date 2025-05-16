import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { useUpdateProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Switch } from "@/components/ui/switch";

const formSchema = z.object({
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  avatar: z.instanceof(File).optional(),
  is_dev_mode: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const SettingsPage = () => {
  const { user, isLoading: userLoading } = useSession();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => setPreviewImage(reader.result as string);
      reader.readAsDataURL(file);
      // Close the dialog after selection
      setAvatarDialogOpen(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".gif"] },
    maxFiles: 1,
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    try {
      const formData = new FormData();
      formData.append("username", data.username || user?.username || "");
      formData.append("first_name", data.first_name || user?.first_name || "");
      formData.append("last_name", data.last_name || user?.last_name || "");
      formData.append("is_dev_mode", String(data.is_dev_mode));

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      await updateProfile.mutateAsync(formData);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      reset({
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        is_dev_mode: user.is_dev_mode,
      });
      setPreviewImage(user.avatar);
    }
  }, [user]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>User not found</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-10 mx-auto">
      <h1 className="mb-8 text-3xl font-bold">Settings</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-8">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and profile picture
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section with Edit Button */}
              <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    {previewImage ? (
                      <AvatarImage
                        src={previewImage}
                        alt={user?.first_name || user?.last_name || "User"}
                      />
                    ) : (
                      <AvatarFallback>
                        {user?.first_name?.charAt(0) ||
                          user?.last_name?.charAt(0) ||
                          "U"}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  {/* Edit Avatar Button */}
                  <Dialog
                    open={avatarDialogOpen}
                    onOpenChange={setAvatarDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute bottom-0 right-0 rounded-full"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Profile Picture</DialogTitle>
                      </DialogHeader>
                      <div
                        {...getRootProps()}
                        className={cn(
                          "border-2 border-dashed rounded-md p-6 cursor-pointer flex flex-col items-center justify-center",
                          isDragActive
                            ? "border-primary bg-primary/5"
                            : "border-gray-300"
                        )}
                      >
                        <input {...getInputProps()} />
                        <Upload className="w-10 h-10 mb-2 text-gray-400" />
                        <p className="text-sm text-center text-gray-500">
                          {isDragActive
                            ? "Drop the image here"
                            : "Drag & drop an image here, or click to select"}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          JPG, PNG or GIF, max 2MB
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-medium">
                    {user?.first_name || user?.last_name || "User"}
                  </h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  {avatarFile && (
                    <p className="mt-2 text-sm text-green-600">
                      New image selected. Save changes to update.
                    </p>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    {...register("first_name")}
                    placeholder="Enter your first name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    {...register("last_name")}
                    placeholder="Enter your last name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    {...register("username")}
                    placeholder="Enter your username"
                  />
                  {errors.username && (
                    <p className="text-sm text-red-500">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email}
                    readOnly
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">
                    Email cannot be changed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Developer Settings Section */}
          <Card>
            <CardHeader>
              <CardTitle>Developer Settings</CardTitle>
              <CardDescription>
                Configure developer-specific settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Label htmlFor="is_dev_mode" className="text-base">Developer Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable advanced features and developer tools
                  </p>
                </div>
                <Switch
                  id="is_dev_mode"
                  checked={watch("is_dev_mode")}
                  onCheckedChange={(checked) => setValue("is_dev_mode", checked, { shouldDirty: true })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateProfile.isPending || (!isDirty && !avatarFile)}
            >
              {updateProfile.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;
