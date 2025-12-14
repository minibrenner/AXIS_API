import { Prisma, PrintJobStatus, PrintJobType } from "@prisma/client";
import { prisma } from "../prisma/client";
import { TenantContext } from "../tenancy/tenant.context";
import { HttpError, ErrorCodes } from "../utils/httpErrors";
import { buildReceipt } from "../sales/receipt";
import {
  CreateDeviceInput,
  CreateLocationInput,
  DeleteLocationQuery,
  ListDevicesQuery,
  ListJobsQuery,
  UpdateDeviceInput,
  UpdateJobInput,
  UpdateLocationInput,
} from "./dto";

export class PrintingService {
  private tenantId() {
    const tid = TenantContext.get();
    if (!tid) {
      throw new HttpError({
        status: 400,
        code: ErrorCodes.TENANT_NOT_RESOLVED,
        message: "Tenant nao identificado",
      });
    }
    return tid;
  }

  // -------- Locations --------
  async createLocation(input: CreateLocationInput) {
    const tenantId = this.tenantId();
    const data = {
      name: input.name.trim(),
      isReceiptDefault: input.isReceiptDefault ?? false,
    };

    return prisma.$transaction(async (tx) => {
      if (data.isReceiptDefault) {
        // se for novo default de recibo, desmarca outros defaults do mesmo tenant
        await tx.printerLocation.updateMany({
          where: { tenantId },
          data: { isReceiptDefault: false },
        });
      }
      return tx.printerLocation.create({
        data: { ...data, tenantId },
      });
    });
  }

  async listLocations() {
    const tenantId = this.tenantId();
    return prisma.printerLocation.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  }

  async updateLocation(id: string, input: UpdateLocationInput) {
    const tenantId = this.tenantId();
    const data: Prisma.PrinterLocationUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.isReceiptDefault !== undefined) data.isReceiptDefault = input.isReceiptDefault;

    return prisma.$transaction(async (tx) => {
      if (input.isReceiptDefault) {
        await tx.printerLocation.updateMany({
          where: { tenantId },
          data: { isReceiptDefault: false },
        });
      }
      const updated = await tx.printerLocation.update({
        where: { id },
        data,
      });
      return updated;
    });
  }

  async deleteLocation(id: string, query: DeleteLocationQuery) {
    const tenantId = this.tenantId();
    const hasDevices = await prisma.printerDevice.count({
      where: { tenantId, locationId: id },
    });
    const hasJobs = await prisma.printJob.count({
      where: { tenantId, locationId: id, status: { in: ["PENDING", "SENDING"] } },
    });

    if (!query.force && (hasDevices > 0 || hasJobs > 0)) {
      throw new HttpError({
        status: 400,
        code: ErrorCodes.BAD_REQUEST,
        message: "Praça possui impressoras ou jobs pendentes. Use force=true para remover mesmo assim.",
      });
    }

    await prisma.printerLocation.delete({ where: { id } });
  }

  // -------- Devices --------
  async createDevice(input: CreateDeviceInput) {
    const tenantId = this.tenantId();
    const data: Prisma.PrinterDeviceCreateInput = {
      tenant: { connect: { id: tenantId } },
      name: input.name.trim(),
      type: input.type,
      interface: input.interface,
      host: input.host?.trim() || null,
      port: input.port ?? null,
      isActive: input.isActive ?? true,
      workstationId: input.workstationId?.trim() || null,
      location: input.locationId ? { connect: { id: input.locationId } } : undefined,
    };
    return prisma.printerDevice.create({ data });
  }

  async listDevices(filters: ListDevicesQuery) {
    const tenantId = this.tenantId();
    return prisma.printerDevice.findMany({
      where: {
        tenantId,
        locationId: filters.locationId,
        isActive: filters.active ?? undefined,
      },
      orderBy: { name: "asc" },
    });
  }

  async updateDevice(id: string, input: UpdateDeviceInput) {
    const data: Prisma.PrinterDeviceUpdateInput = {
      name: input.name?.trim(),
      type: input.type,
      interface: input.interface,
      host: input.host === undefined ? undefined : (input.host?.trim() || null),
      port: input.port === undefined ? undefined : (input.port ?? null),
      isActive: input.isActive,
      workstationId: input.workstationId === undefined ? undefined : (input.workstationId?.trim() || null),
    };
    if (input.locationId !== undefined) {
      data.location = input.locationId ? { connect: { id: input.locationId } } : { disconnect: true };
    }
    return prisma.printerDevice.update({
      where: { id },
      data,
    });
  }

  async deleteDevice(id: string) {
    await prisma.printerDevice.delete({ where: { id } });
  }

  async enqueueTestPrint(deviceId: string) {
    const tenantId = this.tenantId();
    const device = await prisma.printerDevice.findFirst({
      where: { id: deviceId, tenantId },
      include: { location: true },
    });
    if (!device) {
      throw new HttpError({
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: "Impressora nao encontrada.",
      });
    }
    return prisma.printJob.create({
      data: {
        tenantId,
        type: PrintJobType.TEST_PRINT,
        status: PrintJobStatus.PENDING,
        locationId: device.locationId,
        printerDeviceId: deviceId,
        payload: {
          message: "Teste de impressao",
          device: device.name,
          location: device.location?.name,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  // -------- Jobs --------
  async listJobs(filters: ListJobsQuery) {
    const tenantId = this.tenantId();
    return prisma.printJob.findMany({
      where: {
        tenantId,
        status: filters.status ?? undefined,
        type: filters.type ?? undefined,
        locationId: filters.locationId,
        printerDeviceId: filters.printerDeviceId,
        // workstation: filtramos via device (join)
        printerDevice: filters.workstationId
          ? { workstationId: filters.workstationId }
          : undefined,
      },
      take: filters.limit ?? 50,
      orderBy: { queuedAt: "asc" },
      include: {
        printerDevice: true,
        location: true,
      },
    });
  }

  async updateJob(id: string, input: UpdateJobInput) {
    const data: Prisma.PrintJobUpdateInput = {
      status: input.status,
      errorMessage: input.errorMessage,
      lastError: input.errorMessage,
      processedAt: input.status === PrintJobStatus.DONE ? new Date() : undefined,
    };
    if (input.printerDeviceId) {
      data.printerDevice = { connect: { id: input.printerDeviceId } };
    }
    if (input.lastSeenAt) {
      data.updatedAt = input.lastSeenAt;
    }
    return prisma.printJob.update({
      where: { id },
      data,
    });
  }

  async reprintJob(id: string) {
    const tenantId = this.tenantId();
    const job = await prisma.printJob.findFirst({
      where: { id, tenantId },
    });
    if (!job) {
      throw new HttpError({
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: "Job nao encontrado.",
      });
    }
    return prisma.printJob.create({
      data: {
        tenantId,
        type: job.type,
        status: PrintJobStatus.PENDING,
        payload: job.payload as Prisma.InputJsonValue,
        locationId: job.locationId ?? undefined,
        printerDeviceId: job.printerDeviceId ?? undefined,
        requestedById: job.requestedById,
        source: job.source,
      },
    });
  }
}

export const printingService = new PrintingService();

// ------------------ HELPERS PARA FLUXOS EXISTENTES ------------------

type OrderTicketItem = {
  productId: string;
  productName: string;
  qty: number;
  printerLocationId?: string | null;
  notes?: string | null;
};

export async function enqueueOrderTicketPrintJobs(params: {
  tenantId: string;
  comandaId: string;
  comandaNumber: string;
  tableNumber?: string | null;
  customerName?: string | null;
  items: OrderTicketItem[];
  requestedById?: string;
  source?: string;
}) {
  const { tenantId, items } = params;

  // agrupa itens por printerLocationId (ignora os que não têm)
    const byLocation = new Map<string, OrderTicketItem[]>();
    for (const item of items) {
      if (!item.printerLocationId) continue;
      // agrupa por praça para imprimir cada setor apenas com seus itens
      const list = byLocation.get(item.printerLocationId) ?? [];
      list.push(item);
      byLocation.set(item.printerLocationId, list);
    }

    if (byLocation.size === 0) return [];

    const jobs: Prisma.PrintJobCreateManyInput[] = [];
    for (const [locationId, locationItems] of byLocation.entries()) {
      jobs.push({
        tenantId,
        type: PrintJobType.ORDER_TICKET,
        status: PrintJobStatus.PENDING,
        locationId,
        payload: {
          comandaNumber: params.comandaNumber,
          tableNumber: params.tableNumber,
          customerName: params.customerName,
        items: locationItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          qty: it.qty,
          notes: it.notes,
        })),
        source: params.source ?? "comanda",
        createdAt: new Date().toISOString(),
      },
      requestedById: params.requestedById,
      queuedAt: new Date(),
    });
  }

  if (!jobs.length) return [];
  const created = await prisma.printJob.createMany({ data: jobs, skipDuplicates: true });
  return created;
}

export async function enqueueSaleReceiptPrintJob(params: {
  tenantId: string;
  userId: string;
  saleId: string;
  source?: string;
  receipt?: Awaited<ReturnType<typeof buildReceipt>>;
  printerDeviceId?: string;
  workstationId?: string | null;
  receiptPrinterLocationId?: string | null;
}) {
  const tenantId = params.tenantId;

  const sale = await prisma.sale.findFirst({
    where: { id: params.saleId, tenantId },
    select: { receiptPrinterLocationId: true },
  });

  const defaultLocation = await prisma.printerLocation.findFirst({
    where: { tenantId, isReceiptDefault: true },
    select: { id: true },
  });

  const resolvedLocationId =
    params.receiptPrinterLocationId ?? sale?.receiptPrinterLocationId ?? defaultLocation?.id ?? null;

  let resolvedDeviceId = params.printerDeviceId ?? null;
  if (!resolvedDeviceId && params.workstationId) {
    const device = await prisma.printerDevice.findFirst({
      where: {
        tenantId,
        workstationId: params.workstationId,
        isActive: true,
      },
      select: { id: true, locationId: true },
    });
    if (device) {
      resolvedDeviceId = device.id;
    }
  }

  const job = await prisma.printJob.create({
    data: {
      tenantId,
      type: PrintJobType.SALE_RECEIPT,
      status: PrintJobStatus.PENDING,
      saleId: params.saleId,
      locationId: resolvedLocationId ?? undefined,
      printerDeviceId: resolvedDeviceId ?? undefined,
      payload: params.receipt
        ? (params.receipt as Prisma.InputJsonValue)
        : ({ saleId: params.saleId, source: params.source ?? "pos-web" } as Prisma.InputJsonValue),
      requestedById: params.userId,
      source: params.source ?? "pos-web",
    },
  });

  return job;
}

export async function enqueueCashClosingPrintJob(params: {
  tenantId: string;
  userId: string;
  cashSessionId: string;
  snapshot: unknown;
  printerDeviceId?: string;
  workstationId?: string | null;
  locationId?: string | null;
}) {
  const tenantId = params.tenantId;

  const defaultLocation = await prisma.printerLocation.findFirst({
    where: { tenantId, isReceiptDefault: true },
    select: { id: true },
  });
  const resolvedLocationId = params.locationId ?? defaultLocation?.id ?? null;

  let resolvedDeviceId = params.printerDeviceId ?? null;
  if (!resolvedDeviceId && params.workstationId) {
    const device = await prisma.printerDevice.findFirst({
      where: {
        tenantId,
        workstationId: params.workstationId,
        isActive: true,
      },
      select: { id: true },
    });
    if (device) resolvedDeviceId = device.id;
  }

  const job = await prisma.printJob.create({
    data: {
      tenantId,
      type: PrintJobType.CASH_CLOSING,
      status: PrintJobStatus.PENDING,
      cashSessionId: params.cashSessionId,
      locationId: resolvedLocationId ?? undefined,
      printerDeviceId: resolvedDeviceId ?? undefined,
      payload: { snapshot: params.snapshot },
      requestedById: params.userId,
      source: "cash-close",
    },
  });

  return job;
}
