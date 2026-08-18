import { z } from "zod";

export const hermesPayloadSchema = z.object({
  proyecto: z.string().min(1),
  torre: z.string().min(1),
  nivel: z.union([z.number(), z.string()]).transform((value) => String(value)),
  zona: z.string().min(1),
  actividad: z.string().min(1),
  avance: z.number().min(0).max(100),
  observacion: z.string().max(2000).optional().default(""),
});

export const hermesCaptureSchema = z.object({
  source: z.string().min(1).default("WHATSAPP"),
  sender: z.string().min(5),
  timestamp: z.string().min(1),
  payload: hermesPayloadSchema,
});

export type HermesCaptureInput = z.infer<typeof hermesCaptureSchema>;
