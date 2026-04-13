import { z } from "zod";

const projectStatusValues = [
  "lead",
  "active",
  "on_hold",
  "review",
  "completed",
  "cancelled",
] as const;

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientId: z.string().uuid("Select a client"),
  status: z.enum(projectStatusValues).default("lead"),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
  teamMemberIds: z.array(z.string().uuid()).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
