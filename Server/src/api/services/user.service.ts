import { Prisma, User, UserRole } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import { StatusCodes } from "http-status-codes";
import { hashPassword } from "@/utils/password.util.ts";
import { ApiError, ConflictError, NotFoundError } from "@/errors/index.ts";
import logger from "@/config/logger.ts";
import { ListUsersQuery, UpdateUserInput, CreateUserInput } from "@/api/validators/user.validator.ts";

// // Type for user creation input (can reuse AdminCreateUserInput if suitable or define separately)
// export type CreateUserInput = Omit<Prisma.UserCreateInput, "passwordHash"> & {
//     password?: string; // Make password optional here as it's handled separately
// };

// Type for the data returned when creating/fetching a user (exclude sensitive fields)
export type SafeUser = Omit<User, "passwordHash">;

// Type for the list response including pagination metadata
export type PaginatedUsersResult = {
    users: SafeUser[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

class UserService {
    /**
     * Creates a new user in the database (Admin context).
     * @param userData - Data for the new user, including plain text password.
     * @returns The created user object (excluding password hash).
     * @throws {ConflictError} If a user with the given email already exists.
     * @throws {ApiError} If password hashing fails or for other database errors.
     */
    async createUser(userData: CreateUserInput): Promise<SafeUser> {
        const { email, password, ...restData } = userData;

        const existingUser = await this.findUserByEmailInternal(email); // Use internal version that returns full User object
        if (existingUser) {
            throw new ConflictError(`User with email ${email} already exists.`);
        }

        // Password required on creation through this service method
        if (!password) {
            throw new ApiError("Password is required to create a user.", StatusCodes.BAD_REQUEST);
        }

        let hashedPassword: string;
        try {
            hashedPassword = await hashPassword(password);
        } catch (error) {
            logger.error("Password hashing failed during user creation:", error);
            throw new ApiError("Failed to process password.", StatusCodes.INTERNAL_SERVER_ERROR);
        }

        try {
            const newUser = await prisma.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    ...restData,
                    role: restData.role || UserRole.STAFF, // Ensure role is set
                    isActive: restData.isActive !== undefined ? restData.isActive : true, // Ensure isActive is set
                },
            });

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { passwordHash, ...safeUserData } = newUser;
            return safeUserData;
        } catch (error) {
            logger.error("Prisma user creation error:", error);
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    // Unique constraint violation
                    throw new ConflictError(`User with email ${email} already exists.`);
                }
            }
            throw new ApiError("Could not create user.", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    // Internal version to get full user object including password hash
    async findUserByEmailInternal(email: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { email },
        });
    }

    // Public version (still used by auth service) returns null, not error
    async findUserByEmail(email: string): Promise<User | null> {
        return this.findUserByEmailInternal(email);
    }

    /**
     * Finds a user by their ID.
     * @param id - The user ID to search for.
     * @returns The user object (excluding password hash).
     * @throws {NotFoundError} If user with the ID is not found.
     */
    async findUserById(id: string): Promise<SafeUser> {
        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new NotFoundError(`User with ID ${id} not found.`);
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...safeUserData } = user;
        return safeUserData;
    }

    /**
     * Retrieves a paginated and filtered list of users.
     * @param queryParams - Parameters for filtering, sorting, and pagination.
     * @returns Paginated list of users (excluding password hash).
     */
    async listUsers(queryParams: ListUsersQuery): Promise<PaginatedUsersResult> {
        const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", role, isActive, search } = queryParams;

        const skip = (page - 1) * limit;
        const take = limit;

        const where: Prisma.UserWhereInput = {
            role: role ? role : undefined,
            isActive: isActive !== undefined ? isActive : undefined,
            ...(search && {
                // Add search filter if provided
                OR: [{ email: { contains: search } }, { firstName: { contains: search } }, { lastName: { contains: search } }],
            }),
        };

        const orderBy: Prisma.UserOrderByWithRelationInput = {
            [sortBy]: sortOrder,
        };

        try {
            const users = await prisma.user.findMany({
                where,
                orderBy,
                skip,
                take,
                select: {
                    // Explicitly select fields to exclude passwordHash
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    // Explicitly list fields instead of excluding one
                },
            });

            const total = await prisma.user.count({ where });

            return {
                users,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error("Failed to list users:", error);
            throw new ApiError("Could not retrieve users.", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Updates a user's information.
     * @param id - The ID of the user to update.
     * @param updateData - The data to update. Can include plain text password.
     * @param updatedByUserId - The ID of the user performing the update (for authorization checks). Optional.
     * @returns The updated user object (excluding password hash).
     * @throws {NotFoundError} If the user to update is not found.
     * @throws {ConflictError} If the updated email already exists for another user.
     * @throws {ApiError} If password hashing fails or for other database errors.
     */
    async updateUser(id: string, updateData: UpdateUserInput | Prisma.UserUpdateInput): Promise<SafeUser> {
        // Ensure user exists first
        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (!existingUser) {
            throw new NotFoundError(`User with ID ${id} not found.`);
        }

        const { password, email, ...restData } = updateData as UpdateUserInput & { password?: string }; // Cast for easier access

        // eslint-disable-next-line prefer-const
        let dataToUpdate: Prisma.UserUpdateInput = { ...restData };

        // 1. Handle email update (check for conflicts)
        if (email && email !== existingUser.email) {
            const conflictingUser = await this.findUserByEmailInternal(email);
            if (conflictingUser && conflictingUser.id !== id) {
                throw new ConflictError(`Email ${email} is already in use by another user.`);
            }
            dataToUpdate.email = email;
        }

        // 2. Handle password update (hash if provided)
        if (password) {
            try {
                dataToUpdate.passwordHash = await hashPassword(password);
            } catch (error) {
                logger.error("Password hashing failed during user update:", error);
                throw new ApiError("Failed to process password update.", StatusCodes.INTERNAL_SERVER_ERROR);
            }
        }

        // 3. Perform the update
        try {
            const updatedUser = await prisma.user.update({
                where: { id },
                data: dataToUpdate,
            });

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { passwordHash, ...safeUserData } = updatedUser;
            return safeUserData;
        } catch (error) {
            logger.error(`Failed to update user ${id}:`, error);
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    // Unique constraint violation (should be caught by email check above, but belt-and-suspenders)
                    throw new ConflictError(`Email ${email} is already in use.`);
                }
                if (error.code === "P2025") {
                    // Record to update not found (should be caught by initial check)
                    throw new NotFoundError(`User with ID ${id} not found during update attempt.`);
                }
            }
            throw new ApiError(`Could not update user ${id}.`, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Deletes a user from the database.
     * Note: Related records might be cascaded based on schema (`onDelete: Cascade`).
     * Consider implications before deleting users with significant related data (orders, transactions).
     * @param id - The ID of the user to delete.
     * @throws {NotFoundError} If the user to delete is not found.
     * @throws {ApiError} For database errors.
     */
    async deleteUser(id: string): Promise<void> {
        // Optional: Prevent deleting the 'super admin' user if applicable
        // const userToDelete = await this.findUserById(id); // Check user details before deleting
        // if (userToDelete.email === 'admin@example.com') {
        //   throw new ForbiddenError('Cannot delete the primary admin account.');
        // }

        try {
            await prisma.user.delete({
                where: { id },
            });
            logger.info(`User with ID ${id} deleted successfully.`);
        } catch (error) {
            logger.error(`Failed to delete user ${id}:`, error);
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2025") {
                    // Record to delete not found
                    throw new NotFoundError(`User with ID ${id} not found.`);
                }
                // Handle potential foreign key constraint errors if cascade isn't set up perfectly,
                // though cascade should handle it. e.g., P2003
            }
            throw new ApiError(`Could not delete user ${id}.`, StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }
}

export default new UserService();
