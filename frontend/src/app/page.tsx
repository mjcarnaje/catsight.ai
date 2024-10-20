import { UploadForm } from "./_components/UploadForm";
import { FileCard } from "./_components/FileCard";
import { deleteFile } from "@/actions/file";
import { Document } from "@/types/file";

async function getDocuments() {
  const res = await fetch("http://127.0.0.1:8000/api/documents", {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch Documents");
  }
  return res.json();
}

export default async function Home() {
  const documents: Document[] = await getDocuments();

  return (
    <div className="min-h-screen w-full p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="flex flex-col gap-8 mx-auto w-full max-w-5xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Welcome to SmartDocument</h1>
          <p className="text-xl text-gray-600">
            Upload, analyze, and manage your documents with ease.
          </p>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Upload a New Document</h2>
          <UploadForm />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Your Documents</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {documents.map((document) => (
              <FileCard
                key={document.id}
                document={document}
                onDelete={deleteFile}
                isDeleting={false}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
