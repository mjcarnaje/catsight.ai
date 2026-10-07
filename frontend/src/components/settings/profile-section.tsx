import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { SettingsSection } from "@/components/settings/section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "@/contexts/session-context";
import { authApi, errorMessage } from "@/lib/api";
import { useConfig } from "@/lib/queries";
import type { User } from "@/types";

const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const nameSchema = z.object({
  first_name: z.string().trim().min(1, "Enter your first name.").max(255, "That's too long."),
  last_name: z.string().trim().min(1, "Enter your last name.").max(255, "That's too long."),
});

type NameValues = z.infer<typeof nameSchema>;

function initialsOf(user: User) {
  return `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase() || "?";
}

/** Photo, name and email for a signed-in account; guests only get a note about their temporary session. */
export function ProfileSection() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <SettingsSection
      id="settings-profile"
      label="Profile"
      description={user.is_guest ? "You're signed in as a guest." : "How you appear to others in the library."}
    >
      {user.is_guest ? <GuestNotice /> : <ProfileForm user={user} />}
    </SettingsSection>
  );
}

function GuestNotice() {
  const { data: config } = useConfig();
  const hours = config?.guest_ttl_hours ?? 24;
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <Avatar className="size-12">
          <AvatarFallback className="text-sm">G</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="text-sm font-medium">Guest</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Temporary session</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Guest sessions are temporary. This one, with its chats, is deleted after {hours} hours. Profile
        details can't be edited as a guest. Create an account to keep your own.
      </p>
      <Button asChild className="w-fit">
        <Link to="/register">Create an account</Link>
      </Button>
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useSession();
  const { toast } = useToast();

  // --- Photo -------------------------------------------------------------------------
  const picker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    event.target.value = ""; // so the same file can be picked again
    if (!picked) return;
    if (!AVATAR_TYPES.includes(picked.type)) {
      setFile(null);
      setFileError("Use a PNG, JPEG, WebP or GIF image.");
    } else if (picked.size > AVATAR_MAX_BYTES) {
      setFile(null);
      setFileError("That image is over 2 MB. Pick a smaller one.");
    } else {
      setFileError(null);
      setFile(picked);
    }
  };

  const uploadPhoto = useMutation({
    mutationFn: (image: File) => {
      const form = new FormData();
      form.append("avatar", image);
      return authApi.updateMe(form);
    },
    onSuccess: (updated) => {
      setUser(updated);
      setFile(null);
      toast({ title: "Photo updated" });
    },
    onError: (error) => setFileError(errorMessage(error)),
  });

  // --- Name --------------------------------------------------------------------------
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { first_name: user.first_name, last_name: user.last_name },
  });

  const saveName = useMutation({
    mutationFn: (values: NameValues) =>
      authApi.updateMe({ first_name: values.first_name, last_name: values.last_name }),
    onSuccess: (updated) => {
      setUser(updated);
      reset({ first_name: updated.first_name, last_name: updated.last_name });
      toast({ title: "Profile updated" });
    },
  });

  return (
    <div className="flex flex-col divide-y">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="size-16">
            <AvatarImage src={preview ?? (user.avatar || undefined)} alt="" />
            <AvatarFallback className="text-base">{initialsOf(user)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col items-start gap-2">
            <input
              ref={picker}
              type="file"
              accept={AVATAR_TYPES.join(",")}
              className="hidden"
              onChange={choose}
              aria-label="Choose a profile photo"
            />
            {file ? (
              <>
                <p className="max-w-full truncate text-sm">{file.name}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={uploadPhoto.isPending} onClick={() => uploadPhoto.mutate(file)}>
                    {uploadPhoto.isPending && <Loader2 className="animate-spin" />}
                    Save photo
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={uploadPhoto.isPending}
                    onClick={() => {
                      setFile(null);
                      setFileError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => picker.current?.click()}>
                  <Upload />
                  {user.avatar ? "Change photo" : "Upload photo"}
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPEG, WebP or GIF, up to 2 MB.</p>
              </>
            )}
          </div>
        </div>
        {fileError && (
          <p role="alert" className="text-sm text-destructive">
            {fileError}
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit((values) => saveName.mutate(values))}
        noValidate
        className="flex flex-col gap-4 p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              autoComplete="given-name"
              aria-invalid={Boolean(errors.first_name)}
              aria-describedby={errors.first_name ? "first-name-error" : undefined}
              {...register("first_name")}
            />
            {errors.first_name && (
              <p id="first-name-error" className="text-xs text-destructive">
                {errors.first_name.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              autoComplete="family-name"
              aria-invalid={Boolean(errors.last_name)}
              aria-describedby={errors.last_name ? "last-name-error" : undefined}
              {...register("last_name")}
            />
            {errors.last_name && (
              <p id="last-name-error" className="text-xs text-destructive">
                {errors.last_name.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} readOnly aria-describedby="email-hint" className="text-muted-foreground" />
          <p id="email-hint" className="text-xs text-muted-foreground">
            Your email is your sign-in and can't be changed here.
          </p>
        </div>

        {saveName.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(saveName.error)}
          </p>
        )}

        <div>
          <Button type="submit" disabled={!isDirty || saveName.isPending}>
            {saveName.isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
