import Link from "next/link";
import { notFound } from "next/navigation";
import { getFolderByShareToken } from "@/actions/folders";
import { getFileVisualKind } from "@/components/modules/files/file-type-icon";

type Props = { params: Promise<{ token: string }> };

function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function SharedFolderPage({ params }: Props) {
  const { token } = await params;
  const res = await getFolderByShareToken(token);
  if (!res.ok) {
    if (res.reason === "not_found") notFound();
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Shared folder unavailable</h1>
        <p className="text-muted-foreground mt-2 text-sm">This link is invalid, private, or expired.</p>
      </main>
    );
  }

  const rootPath = res.data.folder.path;
  const directChildren = res.data.childFolders.filter((f) => {
    const rel = f.path.slice(rootPath.length + 1);
    return rel.length > 0 && !rel.includes("/");
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">{res.data.folder.name}</h1>
      <p className="text-muted-foreground mt-1 text-sm">Shared folder preview</p>

      {directChildren.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Folders</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {directChildren.map((f) => (
              <div key={f.id} className="rounded border p-3 text-sm">{f.name}</div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Files</h2>
        <div className="space-y-2">
          {res.data.childFiles.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {getFileVisualKind(f.name, f.mimeType)} · {formatSize(f.sizeBytes)}
                </p>
              </div>
              <Link className="text-sm underline" href={f.imagekitUrl} target="_blank">
                Open
              </Link>
            </div>
          ))}
          {res.data.childFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files in this shared folder.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
