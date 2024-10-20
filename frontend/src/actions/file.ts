"use server";

import { revalidatePath } from "next/cache";

export async function deleteFile(id: number) {
  console.log(`Attempting to delete file with id: ${id}`);
  const res = await fetch(`http://127.0.0.1:8000/api/documents/${id}/delete`, {
    method: "DELETE",
  });
  if (!res.ok) {
    console.error(
      `Failed to delete Documentwith id: ${id}. Status: ${res.status}`
    );
    throw new Error("Failed to delete PDF");
  }
  console.log(`Successfully deleted file with id: ${id}`);
  revalidatePath("/");
}

export async function uploadFile(formData: FormData) {
  console.log(
    `Attempting to upload files: ${formData
      .getAll("files")
      .map((file) => (file as File).name)
      .join(", ")}`
  );
  const res = await fetch("http://127.0.0.1:8000/api/documents/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    console.error(`Failed to upload Documents. Status: ${res.status}`);
    const errorData = await res.json();
    const errorMessage = errorData.message || "Failed to upload Documents";
    throw new Error(errorMessage);
  }
  const responseData = await res.json();
  console.log("Upload response data:", responseData);
  console.log(
    `Successfully uploaded files: ${formData
      .getAll("files")
      .map((file) => (file as File).name)
      .join(", ")}`
  );
}
