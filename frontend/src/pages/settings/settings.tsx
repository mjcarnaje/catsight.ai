import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { llmApi } from "@/lib/api";
import { useUpdateProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
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
    reset
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
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif'] },
    maxFiles: 1,
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    try {
      const formData = new FormData();
      formData.append('username', data.username || user?.username || '');
      formData.append('first_name', data.first_name || user?.first_name || '');
      formData.append('last_name', data.last_name || user?.last_name || '');

      if (avatarFile) {
        formData.append('avatar_file', avatarFile);
      }

      await updateProfile.mutateAsync(formData);
      toast({ title: 'Profile updated', description: 'Your profile has been updated successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update profile. Please try again.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (user) {
      reset({
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
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
              <CardDescription>Update your personal information and profile picture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section with Edit Button */}
              <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    {previewImage ? (
                      <AvatarImage src={previewImage} alt={user?.first_name || user?.last_name || "User"} />
                    ) : (
                      <AvatarFallback>{user?.first_name?.charAt(0) || user?.last_name?.charAt(0) || "U"}</AvatarFallback>
                    )}
                  </Avatar>

                  {/* Edit Avatar Button */}
                  <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
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
                        className={cn("border-2 border-dashed rounded-md p-6 cursor-pointer flex flex-col items-center justify-center",
                          isDragActive ? "border-primary bg-primary/5" : "border-gray-300")}
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
                  <h3 className="text-lg font-medium">{user?.first_name || user?.last_name || "User"}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  {avatarFile && (
                    <p className="mt-2 text-sm text-green-600">New image selected. Save changes to update.</p>
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
                    <p className="text-sm text-red-500">{errors.username.message}</p>
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
                  <p className="text-xs text-gray-500">Email cannot be changed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Favorite Models Section */}
          <FavoriteModelsForm />

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateProfile.isPending || (!isDirty && !avatarFile)}
            >
              {updateProfile.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
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

const FavoriteModelsForm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: llmModels, isLoading: llmModelsLoading } = useQuery({
    queryKey: ["llm-models"],
    queryFn: () => llmApi.getAll(),
  });

  // Initialize selected models from user data
  useEffect(() => {
    if (user?.favorite_llm_models) {
      setSelectedModels(user.favorite_llm_models);
    }
  }, [user]);

  const handleToggle = async (modelValue: string, checked: boolean) => {
    let newSelectedModels;

    if (checked) {
      newSelectedModels = [...selectedModels, modelValue];
    } else {
      newSelectedModels = selectedModels.filter(v => v !== modelValue);
    }

    setSelectedModels(newSelectedModels);

    // Save changes immediately
    try {
      setIsSaving(true);
      await llmApi.updateFavorites(newSelectedModels);

      // Update local user data
      if (user) {
        const updatedUser = { ...user, favorite_llm_models: newSelectedModels };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        queryClient.setQueryData(["user"], updatedUser);
      }

      toast({
        title: "Preferences updated",
        description: checked ? "Model added to favorites" : "Model removed from favorites"
      });
    } catch (error) {
      // Revert selection on error
      setSelectedModels(selectedModels);
      toast({
        title: "Error updating preferences",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Favorite Models</CardTitle>
        <CardDescription>
          Select your preferred AI models to use when interacting with documents.
          Favorited models will appear at the top of model selection lists.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {llmModelsLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 mr-3 animate-spin text-primary" />
            <p>Loading available models...</p>
          </div>
        )}

        {isSaving && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/80">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Saving preferences...</span>
            </div>
          </div>
        )}

        {!llmModelsLoading && llmModels?.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No AI models are currently available.</p>
          </div>
        )}

        {!llmModelsLoading && llmModels && llmModels.length > 0 && (
          <div className="relative space-y-1">
            {llmModels.map(model => (
              <div
                key={model.code}
                className="flex items-center justify-between p-3 transition-colors rounded-lg hover:bg-accent/50"
              >
                <div className="flex items-center space-x-3">
                  {model.logo ? (
                    <img src={model.logo} alt={model.name} className="object-cover w-10 h-10 rounded-md" />
                  ) : (
                    <div className="flex items-center justify-center w-10 h-10 font-medium rounded-md bg-primary/10 text-primary">
                      {model.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{model.description}</p>
                  </div>
                </div>
                <Switch
                  checked={selectedModels.includes(model.code)}
                  onCheckedChange={checked => handleToggle(model.code, checked)}
                  disabled={isSaving}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
