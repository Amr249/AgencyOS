import { z } from "zod";
import { CLIENT_LOSS_CATEGORIES } from "@/lib/client-loss";

export const winLossTypeSchema = z.enum(["won", "lost"]);

export const createWinLossReasonSchema = z.object({
  type: winLossTypeSchema,
  reason: z.string().min(1, "Reason is required").max(500),
});

export const markClientWonSchema = z.object({
  clientId: z.string().uuid(),
  reason: z.string().min(1, "Reason is required").max(2000),
  dealValue: z.number().nonnegative().optional(),
});

const clientLossCategorySchema = z.enum(CLIENT_LOSS_CATEGORIES);

export const markClientLostSchema = z.object({
  clientId: z.string().uuid(),
  lossCategory: clientLossCategorySchema,
  notes: z.string().min(1, "Notes are required").max(5000),
});

export type CreateWinLossReasonInput = z.infer<typeof createWinLossReasonSchema>;
export type MarkClientWonInput = z.infer<typeof markClientWonSchema>;
export type MarkClientLostInput = z.infer<typeof markClientLostSchema>;
