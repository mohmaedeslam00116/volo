// Zod schemas for the IPC boundary. Main refuses anything that doesn't parse;
// error strings match the reason codes the renderer maps to Arabic messages.
import { z } from "zod";

export const promptSchema = z
  .string()
  .trim()
  .min(1)
  .max(4000);

export const modelSelectionSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
});

export const startPayloadSchema = z.object({
  prompt: promptSchema,
  model: modelSelectionSchema.optional(),
});

export const sendPayloadSchema = z.object({
  sessionId: z.string().min(1),
  prompt: promptSchema,
});

export const sessionIdPayloadSchema = z.object({
  sessionId: z.string().min(1),
});

export const setKeyPayloadSchema = z.object({
  providerId: z.string().min(1),
  apiKey: z.string().min(8).max(500),
});

export type StartPayload = z.infer<typeof startPayloadSchema>;
export type SendPayload = z.infer<typeof sendPayloadSchema>;
