import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getProjectTemplateById } from "@/actions/project-templates";
import { DeleteProjectTemplateButton } from "@/components/modules/projects/delete-project-template-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getProjectTemplateById(id);
  if (!result.ok) return { title: "Template | AgencyOS" };
  return {
    title: `${result.data.template.name} | Template`,
    description: result.data.template.description ?? undefined,
  };
}

type TaskTpl = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  phaseIndex: number;
  sortOrder: number;
  parentTaskTemplateId: string | null;
};

function siblingSort(a: TaskTpl, b: TaskTpl) {
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
}

function TaskTreeRows({
  parentId,
  tasksByParent,
  depth,
}: {
  parentId: string;
  tasksByParent: Map<string, TaskTpl[]>;
  depth: number;
}) {
  const list = (tasksByParent.get(parentId) ?? []).slice().sort(siblingSort);
  return (
    <>
      {list.map((t) => (
        <div key={t.id} className="space-y-1">
          <div
            className="flex flex-wrap items-baseline gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-muted/50"
            style={{ paddingInlineStart: `${8 + depth * 16}px` }}
          >
            <span className="font-medium text-sm">{t.title}</span>
            <Badge variant="secondary" className="text-[10px] font-normal capitalize">
              {t.priority}
            </Badge>
          </div>
          {t.description ? (
            <p
              className="text-muted-foreground text-xs px-2 pb-1 whitespace-pre-wrap"
              style={{ paddingInlineStart: `${8 + depth * 16}px` }}
            >
              {t.description}
            </p>
          ) : null}
          <TaskTreeRows parentId={t.id} tasksByParent={tasksByParent} depth={depth + 1} />
        </div>
      ))}
    </>
  );
}

function TaskRootBlock({ task, tasksByParent }: { task: TaskTpl; tasksByParent: Map<string, TaskTpl[]> }) {
  return (
    <div className="space-y-1 border-b border-border/60 last:border-0 py-2 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-2 rounded-md border border-transparent px-2 py-1 hover:bg-muted/50">
        <span className="font-medium text-sm">{task.title}</span>
        <Badge variant="secondary" className="text-[10px] font-normal capitalize">
          {task.priority}
        </Badge>
      </div>
      {task.description ? (
        <p className="text-muted-foreground text-xs px-2 pb-1 whitespace-pre-wrap">{task.description}</p>
      ) : null}
      <TaskTreeRows parentId={task.id} tasksByParent={tasksByParent} depth={1} />
    </div>
  );
}

export default async function ProjectTemplateDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getProjectTemplateById(id);
  if (!result.ok) {
    if (result.error === "Template not found" || result.error === "Invalid template id") {
      notFound();
    }
    return (
      <div className="space-y-4">
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  const { template, tasks } = result.data;
  const phases = template.defaultPhases ?? [];

  const roots = tasks
    .filter((row) => !row.parentTaskTemplateId)
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      phaseIndex: row.phaseIndex,
      sortOrder: row.sortOrder,
      parentTaskTemplateId: row.parentTaskTemplateId,
    }))
    .sort(siblingSort);
  const childrenByParent = new Map<string, TaskTpl[]>();
  for (const row of tasks) {
    if (row.parentTaskTemplateId) {
      if (!childrenByParent.has(row.parentTaskTemplateId)) {
        childrenByParent.set(row.parentTaskTemplateId, []);
      }
      childrenByParent.get(row.parentTaskTemplateId)!.push({
        id: row.id,
        title: row.title,
        description: row.description,
        priority: row.priority,
        phaseIndex: row.phaseIndex,
        sortOrder: row.sortOrder,
        parentTaskTemplateId: row.parentTaskTemplateId,
      });
    }
  }
  for (const [, arr] of childrenByParent) {
    arr.sort(siblingSort);
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">Dashboard</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/templates">Templates</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[200px] truncate">{template.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
          {template.description ? (
            <p className="text-muted-foreground text-sm max-w-2xl whitespace-pre-wrap">
              {template.description}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Created {format(new Date(template.createdAt), "MMM d, yyyy")}
            {template.sourceProjectId ? (
              <>
                {" · "}
                <Link
                  href={`/dashboard/projects/${template.sourceProjectId}`}
                  className="underline hover:text-foreground"
                >
                  Source project
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <DeleteProjectTemplateButton templateId={template.id} templateName={template.name} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Phases</h2>
        {phases.length === 0 ? (
          <p className="text-muted-foreground text-sm">No phases in this template.</p>
        ) : (
          <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
            {phases.map((name, i) => (
              <li key={`${i}-${name}`}>
                <span className="text-foreground">{name}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tasks in this template.</p>
        ) : (
          <div className="space-y-8">
            {phases.length > 0
              ? phases.map((phaseName, phaseIndex) => {
                  const rootsInPhase = roots.filter((t) => t.phaseIndex === phaseIndex);
                  if (rootsInPhase.length === 0) return null;
                  return (
                    <div key={phaseIndex} className="space-y-2">
                      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {phaseName}
                      </h3>
                      <div className="rounded-lg border bg-card px-2">
                        {rootsInPhase.map((t) => (
                          <TaskRootBlock key={t.id} task={t} tasksByParent={childrenByParent} />
                        ))}
                      </div>
                    </div>
                  );
                })
              : null}
            {(() => {
              const orphanRoots =
                phases.length === 0
                  ? roots
                  : roots.filter((t) => t.phaseIndex < 0 || t.phaseIndex >= phases.length);
              if (orphanRoots.length === 0) return null;
              return (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {phases.length === 0 ? "Tasks" : "Other"}
                  </h3>
                  <div className="rounded-lg border bg-card px-2">
                    {orphanRoots.map((t) => (
                      <div key={t.id}>
                        {phases.length > 0 ? (
                          <div className="flex flex-wrap items-baseline gap-2 px-2 pt-2">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              Phase index {t.phaseIndex}
                            </Badge>
                          </div>
                        ) : null}
                        <TaskRootBlock task={t} tasksByParent={childrenByParent} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </section>
    </div>
  );
}
