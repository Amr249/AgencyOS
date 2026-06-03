import { z } from "zod";

const projectStatusValues = [
  "lead",
  "active",
  "on_hold",
  "review",
  "completed",
  "cancelled",
] as const;

const projectBaseFields = {
  name: z.string().min(1, "Project name is required"),
  isInternal: z.boolean().optional().default(false),
  clientId: z.string().uuid().optional(),
  status: z.enum(projectStatusValues).default("lead"),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
  teamMemberIds: z.array(z.string().uuid()).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
};

function refineClientOrInternal(
  data: { isInternal?: boolean; clientId?: string },
  ctx: z.RefinementCtx
) {
  if (data.isInternal) {
    if (data.clientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Internal projects cannot be linked to a client",
        path: ["clientId"],
      });
    }
    return;
  }
  if (!data.clientId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a client",
      path: ["clientId"],
    });
  }
}

export const createProjectSchema = z
  .object(projectBaseFields)
  .superRefine(refineClientOrInternal);

export const updateProjectSchema = z
  .object({
    id: z.string().uuid(),
    ...projectBaseFields,
  })
  .partial()
  .required({ id: true })
  .superRefine((data, ctx) => {
    if (data.isInternal === undefined && data.clientId === undefined) return;
    refineClientOrInternal(
      {
        isInternal: data.isInternal ?? false,
        clientId: data.clientId,
      },
      ctx
    );
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/** URL / filter value for projects list: show only agency-internal projects. */
export const INTERNAL_PROJECTS_CLIENT_FILTER = "__internal__";
