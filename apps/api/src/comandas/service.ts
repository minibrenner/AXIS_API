import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { TenantContext } from "../tenancy/tenant.context";
import { ErrorCodes, HttpError } from "../utils/httpErrors";
import type {
  AddComandaItemsInput,
  CreateComandaInput,
  ListComandaQuery,
  UpdateComandaInput,
} from "./dto";
import { comandaNotFound, comandaNumberConflict } from "./err";
import { enqueueOrderTicketPrintJobs } from "../printing/service";

export class ComandasService {
  private tenantId(): string {
    const tenantId = TenantContext.get();
    if (!tenantId) {
      throw new HttpError({
        status: 400,
        code: ErrorCodes.TENANT_NOT_RESOLVED,
        message: "Tenant nao identificado",
      });
    }
    return tenantId;
  }

  private normalize(dto: Partial<CreateComandaInput | UpdateComandaInput>) {
    const trim = (value?: string | null) =>
      typeof value === "string" ? value.trim() || undefined : undefined;
    const digits = (value?: string | null) =>
      typeof value === "string" ? value.replace(/\D+/g, "") || undefined : undefined;

    return {
      number: trim(dto.number),
      customerName: trim(dto.customerName),
      customerPhone: trim(dto.customerPhone),
      customerCpf: digits(dto.customerCpf),
      customerStatus: dto.customerStatus,
      status: dto.status,
      notes: trim(dto.notes),
      tableNumber: trim((dto as { tableNumber?: string }).tableNumber),
    };
  }

  async create(dto: CreateComandaInput) {
    const tenantId = this.tenantId();
    const data = this.normalize(dto);

    if (data.customerCpf) {
      const customer = await prisma.customer.findFirst({
        where: { tenantId, document: data.customerCpf },
        select: { id: true, comandaStatus: true, name: true },
      });

      if (customer?.comandaStatus === "DESATIVADO") {
        throw new HttpError({
          status: 403,
          code: ErrorCodes.FORBIDDEN,
          message: "USUARIO BLOQUEADO, POR FAVOR CHAME A GERENCIA",
        });
      }

      const openComanda = await prisma.comanda.findFirst({
        where: {
          tenantId,
          customerCpf: data.customerCpf,
          status: { in: ["ABERTO", "PENDENTE"] },
        },
      });

      if (openComanda) {
        throw new HttpError({
          status: 409,
          code: ErrorCodes.CONFLICT,
          message: "Cliente ja possui uma comanda ativa.",
        });
      }
    }

    try {
      return await prisma.comanda.create({
        data: {
          tenantId,
          number: data.number ?? "",
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerCpf: data.customerCpf,
          customerStatus: data.customerStatus ?? "ATIVO",
          status: data.status ?? "ABERTO",
          notes: data.notes,
          tableNumber: data.tableNumber,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw comandaNumberConflict(data.number ?? dto.number);
      }
      throw err;
    }
  }

  async list(filters: ListComandaQuery = {}) {
    const tenantId = this.tenantId();
    const term = filters.q?.trim() || undefined;

    const rows = await prisma.comanda.findMany({
      where: {
        tenantId,
        status: filters.status ?? undefined,
        customerStatus: filters.customerStatus ?? undefined,
        OR: term
          ? [
              { number: { contains: term, mode: "insensitive" } },
              { customerName: { contains: term, mode: "insensitive" } },
              { customerCpf: { contains: term } },
              { customerPhone: { contains: term } },
            ]
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        items: {
          select: { quantity: true, totalPrice: true },
        },
      },
    });

    return rows.map((row) => {
      const totalValue = row.items.reduce(
        (acc, it) => acc.add(it.totalPrice),
        new Prisma.Decimal(0),
      );
      const totalItems = row.items.reduce(
        (acc, it) => acc + Number(it.quantity),
        0,
      );

      const { items, ...rest } = row;
      return {
        ...rest,
        totalValue: totalValue.toNumber(),
        totalItems,
      };
    });
  }

  async get(id: string) {
    const tenantId = this.tenantId();
    const comanda = await prisma.comanda.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, price: true, barcode: true, sku: true },
            },
          },
        },
      },
    });

    if (!comanda) {
      throw comandaNotFound();
    }

    const totalValue = comanda.items.reduce(
      (acc, it) => acc.add(it.totalPrice),
      new Prisma.Decimal(0),
    );
    const totalItems = comanda.items.reduce(
      (acc, it) => acc + Number(it.quantity),
      0,
    );

    return {
      ...comanda,
      totalValue: totalValue.toNumber(),
      totalItems,
    };
  }

  async update(id: string, dto: UpdateComandaInput) {
    const tenantId = this.tenantId();
    await this.get(id);
    const data = this.normalize(dto);

    try {
      return await prisma.comanda.update({
        where: { id },
        data: {
          ...data,
          number: data.number ?? undefined,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw comandaNumberConflict(data.number ?? "");
      }
      throw err;
    }
  }

  async delete(id: string) {
    await this.get(id);
    const deleted = await prisma.comanda.delete({ where: { id } });
    return deleted;
  }

  async addItems(comandaId: string, input: AddComandaItemsInput, user: { userId: string; name?: string }) {
    const tenantId = this.tenantId();
    const comanda = await prisma.comanda.findFirst({
      where: { id: comandaId, tenantId },
    });

    if (!comanda) {
      throw comandaNotFound();
    }

    if (comanda.customerStatus === "DESATIVADO") {
      throw new HttpError({
        status: 403,
        code: ErrorCodes.FORBIDDEN,
        message: "USUARIO BLOQUEADO, POR FAVOR CHAME A GERENCIA",
      });
    }

    if (comanda.status === "ENCERRADO") {
      throw new HttpError({
        status: 400,
        code: ErrorCodes.BAD_REQUEST,
        message: "Comanda encerrada nao aceita novos itens.",
      });
    }

    const productIds = input.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, price: true, name: true, printerLocationId: true },
    });

    if (products.length !== productIds.length) {
      throw new HttpError({
        status: 404,
        code: ErrorCodes.NOT_FOUND,
        message: "Um ou mais produtos nao encontrados para o tenant.",
      });
    }

    const priceMap = new Map(products.map((p) => [p.id, p.price]));

    const itemsData = input.items.map((item) => {
      const unitPrice = priceMap.get(item.productId)!;
      const qty = new Prisma.Decimal(item.qty);
      const total = unitPrice.mul(qty);
      return {
        tenantId,
        comandaId,
        productId: item.productId,
        quantity: qty,
        unitPrice,
        totalPrice: total,
        tableNumber: input.tableNumber?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        createdByUserId: user.userId,
        createdByUserName: user.name ?? undefined,
      };
    });

    const totalValue = itemsData.reduce(
      (acc, it) => acc.add(it.totalPrice),
      new Prisma.Decimal(0),
    );

    await prisma.$transaction(async (tx) => {
      await tx.comandaItem.createMany({ data: itemsData });
      await tx.comanda.update({
        where: { id: comandaId },
        data: {
          tableNumber: input.tableNumber?.trim() || undefined,
          notes: (input.notes?.trim() || comanda.notes) ?? undefined,
        },
      });
    });

    // Enfileira impressÃ£o por praça (ORDER_TICKET), mas não bloqueia o fluxo se falhar
    try {
      const comandaInfo = await prisma.comanda.findUnique({
        where: { id: comandaId },
        select: { number: true, tableNumber: true, customerName: true },
      });
      await enqueueOrderTicketPrintJobs({
        tenantId,
        comandaId,
        comandaNumber: comandaInfo?.number ?? "N/A",
        tableNumber: input.tableNumber ?? comandaInfo?.tableNumber,
        customerName: comandaInfo?.customerName ?? comanda.customerName ?? undefined,
        requestedById: user.userId,
        source: "comanda-order",
        items: input.items.map((item) => {
          const product = priceMap.get(item.productId)!;
          const prodFull = products.find((p) => p.id === item.productId);
          return {
            productId: item.productId,
            productName: prodFull?.name ?? "Produto",
            qty: item.qty,
            printerLocationId: prodFull?.printerLocationId,
            notes: input.notes,
          };
        }),
      });
    } catch (err) {
      console.warn("Falha ao enfileirar impressao de comanda", err);
    }

    return {
      comandaId,
      itemsAdded: itemsData.length,
      totalValue: totalValue.toString(),
    };
  }
}

export const comandasService = new ComandasService();
