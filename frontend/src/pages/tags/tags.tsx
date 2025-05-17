import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tagsApi } from "@/lib/api";
import { Tag } from "@/types/tags";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TagsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [newTag, setNewTag] = useState({ name: "", description: "" });
  const [editedTag, setEditedTag] = useState({ name: "", description: "" });

  // Fetch all tags
  const { data: tags, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsApi.getAll(),
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      tagsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setIsCreateOpen(false);
      setNewTag({ name: "", description: "" });
      toast({
        title: "Tag created",
        description: "Your tag has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating tag",
        description:
          error.message || "An error occurred while creating the tag.",
        variant: "destructive",
      });
    },
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; description?: string };
    }) => tagsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setIsEditOpen(false);
      setTagToEdit(null);
      toast({
        title: "Tag updated",
        description: "Your tag has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating tag",
        description:
          error.message || "An error occurred while updating the tag.",
        variant: "destructive",
      });
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: (id: number) => tagsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setIsDeleteOpen(false);
      setTagToDelete(null);
      toast({
        title: "Tag deleted",
        description: "Your tag has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting tag",
        description:
          error.message || "An error occurred while deleting the tag.",
        variant: "destructive",
      });
    },
  });

  const handleCreateTag = () => {
    if (!newTag.name.trim()) {
      toast({
        title: "Validation error",
        description: "Tag name is required",
        variant: "destructive",
      });
      return;
    }
    createTagMutation.mutate(newTag);
  };

  const handleUpdateTag = () => {
    if (!editedTag.name.trim()) {
      toast({
        title: "Validation error",
        description: "Tag name is required",
        variant: "destructive",
      });
      return;
    }
    if (tagToEdit) {
      updateTagMutation.mutate({
        id: tagToEdit.id,
        data: editedTag,
      });
    }
  };

  const handleDeleteTag = () => {
    if (tagToDelete) {
      deleteTagMutation.mutate(tagToDelete.id);
    }
  };

  const openEditDialog = (tag: Tag) => {
    setTagToEdit(tag);
    setEditedTag({
      name: tag.name,
      description: tag.description || "",
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (tag: Tag) => {
    setTagToDelete(tag);
    setIsDeleteOpen(true);
  };

  return (
    <div className="container py-8 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tags</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tag</DialogTitle>
              <DialogDescription>
                Add a new tag that can be used to categorize documents.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newTag.name}
                  onChange={(e) =>
                    setNewTag({ ...newTag, name: e.target.value })
                  }
                  placeholder="Enter tag name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTag.description}
                  onChange={(e) =>
                    setNewTag({ ...newTag, description: e.target.value })
                  }
                  placeholder="Enter tag description (optional)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTag}
                disabled={createTagMutation.isPending}
              >
                {createTagMutation.isPending ? "Creating..." : "Create Tag"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="w-1/2 h-6 mb-2" />
                <Skeleton className="w-full h-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="w-full h-16" />
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pt-2">
                <Skeleton className="w-24 h-9" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : tags && tags.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <Card key={tag.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle>{tag.name}</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Created by {tag?.author?.first_name} {tag?.author?.last_name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  {tag.description || "No description provided."}
                </p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => openEditDialog(tag)}
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => openDeleteDialog(tag)}
                >
                  <Trash className="w-4 h-4" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 rounded-lg bg-gray-50">
          <div className="text-center">
            <h3 className="mt-2 text-xl font-semibold">No Tags Found</h3>
            <p className="mt-1 text-gray-500">
              Create a new tag to help categorize documents.
            </p>
            <Button onClick={() => setIsCreateOpen(true)} className="mt-4">
              Create your first tag
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update the information for this tag.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editedTag.name}
                onChange={(e) =>
                  setEditedTag({ ...editedTag, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editedTag.description}
                onChange={(e) =>
                  setEditedTag({ ...editedTag, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateTag}
              disabled={updateTagMutation.isPending}
            >
              {updateTagMutation.isPending ? "Updating..." : "Update Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tag
              "{tagToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTag}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTagMutation.isPending}
            >
              {deleteTagMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
