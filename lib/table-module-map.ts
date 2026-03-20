import type { ModuleTableConfig } from "@/components/ui/entity-table-contract";

type UnknownRow = Record<string, unknown>;

export const tableModuleMap: Record<string, Pick<ModuleTableConfig<UnknownRow>, "tableId" | "title">> = {
  clients: { tableId: "clients-table", title: "Clients" },
  projects: { tableId: "projects-table", title: "Projects" },
  invoices: { tableId: "invoices-table", title: "Invoices" },
  tasks: { tableId: "tasks-table", title: "Tasks" },
};
