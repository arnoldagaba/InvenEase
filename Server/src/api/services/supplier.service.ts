import { Prisma, Supplier } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import { NotFoundError, ConflictError } from "@/errors/index.ts";
import { CreateSupplierInput, UpdateSupplierInput, GetSupplierQueryInput } from "@/api/validators/supplier.validator.ts";
import { calculateSkip, getPaginationData } from "@/utils/pagination.util.ts";
import { auditLogService } from "./audit.service.ts";

export const supplierService = {
    /**
     * Creates a new supplier.
     * Checks for name uniqueness.
     * @param data - Supplier creation data.
     * @param userId - ID of the user performing the action (for audit).
     * @returns The newly created supplier.
     * @throws ConflictError if name already exists.
     */
    async createSupplier(data: CreateSupplierInput, userId: string): Promise<Supplier> {
        const existing = await prisma.supplier.findUnique({ where: { name: data.name } });
        if (existing) {
            throw new ConflictError(`Supplier with name "${data.name}" already exists.`);
        }

        const newSupplier = await prisma.supplier.create({ data });

        // Audit log
        await auditLogService.logAction(userId, "CREATE_SUPPLIER", "Supplier", newSupplier.id, { name: newSupplier.name, email: newSupplier.email });

        return newSupplier;
    },

    /**
     * Retrieves suppliers with filtering, sorting, pagination.
     * @param queryParams - Parameters for filtering, sorting, pagination.
     * @returns Paginated list of suppliers.
     */
    async getAllSuppliers(queryParams?: GetSupplierQueryInput) {
        const { page = 1, limit = 10, search, sortBy = "name", sortOrder = "asc" } = queryParams || {};
        const skip = calculateSkip(page, limit);

        const where: Prisma.SupplierWhereInput = {};
        if (search) {
            where.OR = [{ name: { contains: search } }, { contactPerson: { contains: search } }, { email: { contains: search } }];
        }

        const orderBy: Prisma.SupplierOrderByWithRelationInput = { [sortBy]: sortOrder };

        const [suppliers, totalCount] = await prisma.$transaction([
            prisma.supplier.findMany({ where, skip, take: limit, orderBy }),
            prisma.supplier.count({ where }),
        ]);

        const paginationData = getPaginationData(totalCount, page, limit);
        return { data: suppliers, pagination: paginationData };
    },

    /**
     * Retrieves a single supplier by ID.
     * @param id - Supplier UUID.
     * @returns The supplier object.
     * @throws NotFoundError if not found.
     */
    async getSupplierById(id: string): Promise<Supplier> {
        const supplier = await prisma.supplier.findUnique({ where: { id } });
        if (!supplier) {
            throw new NotFoundError(`Supplier with ID "${id}" not found.`);
        }
        return supplier;
    },

    /**
     * Updates an existing supplier. Handles name uniqueness.
     * @param id - Supplier UUID.
     * @param data - Data to update.
     * @param userId - ID of the user performing the action.
     * @returns The updated supplier.
     * @throws NotFoundError if supplier not found.
     * @throws ConflictError if updating to an existing name (of another supplier).
     */
    async updateSupplier(id: string, data: UpdateSupplierInput, userId: string): Promise<Supplier> {
        const existingSupplier = await prisma.supplier.findUnique({ where: { id } });
        if (!existingSupplier) {
            throw new NotFoundError(`Supplier with ID "${id}" not found.`);
        }

        if (data.name && data.name !== existingSupplier.name) {
            const conflicting = await prisma.supplier.findUnique({ where: { name: data.name } });
            if (conflicting && conflicting.id !== id) {
                throw new ConflictError(`Another supplier with name "${data.name}" already exists.`);
            }
        }

        // Store previous state for audit logging (simple version)
        const previousData = { name: existingSupplier.name, email: existingSupplier.email, contact: existingSupplier.contactPerson };

        const updatedSupplier = await prisma.supplier.update({
            where: { id },
            data: data,
        });

        // Audit log
        await auditLogService.logAction(
            userId,
            "UPDATE_SUPPLIER",
            "Supplier",
            updatedSupplier.id,
            { changes: data, previous: previousData }, // Log changes and maybe previous state
        );

        return updatedSupplier;
    },

    /**
     * Deletes a supplier after checking for dependencies (Purchase Orders).
     * @param id - Supplier UUID.
     * @param userId - ID of the user performing the action.
     * @returns The deleted supplier object.
     * @throws NotFoundError if supplier not found.
     * @throws ConflictError if supplier has existing purchase orders.
     */
    async deleteSupplier(id: string, userId: string): Promise<Supplier> {
        const purchaseOrderCount = await prisma.purchaseOrder.count({
            where: { supplierId: id },
        });

        if (purchaseOrderCount > 0) {
            throw new ConflictError(`Cannot delete supplier ID "${id}". It is linked to ${purchaseOrderCount} purchase order(s).`);
        }

        try {
            const deletedSupplier = await prisma.supplier.delete({ where: { id } });

            // Audit log
            await auditLogService.logAction(userId, "DELETE_SUPPLIER", "Supplier", deletedSupplier.id, { name: deletedSupplier.name });

            return deletedSupplier;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
                throw new NotFoundError(`Supplier with ID "${id}" not found.`);
            }
            throw error;
        }
    },
};
