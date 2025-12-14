import { z } from "zod";
import { PrinterDeviceType, PrinterInterface, PrintJobStatus, PrintJobType } from "@prisma/client";

export const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(60),
  isReceiptDefault: z.boolean().optional(),
});

export const updateLocationSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  isReceiptDefault: z.boolean().optional(),
});

export const deleteLocationQuerySchema = z.object({
  force: z.coerce.boolean().optional(),
});

export const createDeviceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.nativeEnum(PrinterDeviceType),
  interface: z.nativeEnum(PrinterInterface),
  host: z.string().trim().max(120).nullable().optional(),
  port: z.coerce.number().int().positive().nullable().optional(),
  locationId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
  workstationId: z.string().trim().max(120).nullable().optional(),
});

export const updateDeviceSchema = createDeviceSchema.partial();

export const listDevicesQuerySchema = z.object({
  locationId: z.string().cuid().optional(),
  active: z.coerce.boolean().optional(),
});

export const listJobsQuerySchema = z.object({
  status: z.nativeEnum(PrintJobStatus).optional(),
  type: z.nativeEnum(PrintJobType).optional(),
  locationId: z.string().cuid().optional(),
  printerDeviceId: z.string().cuid().optional(),
  workstationId: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const updateJobSchema = z.object({
  status: z.nativeEnum(PrintJobStatus),
  errorMessage: z.string().max(500).optional(),
  printerDeviceId: z.string().cuid().optional(),
  lastSeenAt: z.coerce.date().optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type DeleteLocationQuery = z.infer<typeof deleteLocationQuerySchema>;
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type ListDevicesQuery = z.infer<typeof listDevicesQuerySchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
