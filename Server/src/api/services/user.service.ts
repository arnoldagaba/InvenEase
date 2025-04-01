import { Prisma, User, UserRole } from "@prisma/client";
import prisma from "@/config/prisma.ts";
import { hashPassword } from "@/utils/password.util.ts";
import { ApiError, ConflictError, NotFoundError } from "@/errors/index.ts";
import { StatusCodes } from "http-status-codes";

// Type for user creation input (can reuse AdminCreateUserInput if suitable or define separately)
export type CreateUserInput = Omit<Prisma.UserCreateInput, "passwordHash"> & {
    password?: string; // Make password optional here as it's handled separately
};

// Type for the data returned when creating/fetching a user (exclude sensitive fields)
export type SafeUser = Omit<User, "passwordHash">;

class UserService {
    /**
     * Creates a new user in the database.
     * @param userData - Data for the new user, including plain text password.
     * @returns The created user object (excluding password hash).
     * @throws {ConflictError} If a user with the given email already exists.
     * @throws {ApiError} If password hashing fails or for other database errors.
     */
    async createUser(userData: CreateUserInput): Promise<SafeUser> {
        const { email, password, ...restData } = userData;

        // 1. Check if user already exists
        const existingUser = await this.findUserByEmail(email);
        if (existingUser) {
            throw new ConflictError(`User with email ${email} already exists.`);
        }

        // 2. Ensure password is provided for new user creation
        if (!password) {
            throw new ApiError("Password is required to create a user.", StatusCodes.BAD_REQUEST);
        }

        // 3. Hash the password
        let hashedPassword: string;
        try {
            hashedPassword = await hashPassword(password);
        } catch (error) {
            // Log the actual error internally
            console.error("Password hashing failed:", error);
            throw new ApiError("Failed to process password.", StatusCodes.INTERNAL_SERVER_ERROR);
        }

        // 4. Create user in database
        try {
            const newUser = await prisma.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    ...restData, // Includes firstName, lastName, role, isActive etc. if provided
                    role: restData.role || UserRole.STAFF, // Default role if not provided
                    isActive: restData.isActive !== undefined ? restData.isActive : true, // Default to active
                },
            });

            // 5. Exclude password hash from returned object
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { passwordHash, ...safeUserData } = newUser;
            return safeUserData;
        } catch (error) {
            // Log the actual prisma error
            console.error("Prisma user creation error:", error);
            // Could check for specific Prisma error codes if needed
            throw new ApiError("Could not create user.", StatusCodes.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Finds a user by their email address.
     * @param email - The email address to search for.
     * @returns The user object (including password hash) or null if not found.
     */
    async findUserByEmail(email: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { email },
        });
    }

    /**
     * Finds a user by their ID.
     * @param id - The user ID to search for.
     * @returns The user object (excluding password hash) or null if not found.
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

    // --- Add other user management methods later ---
    // async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<SafeUser> { ... }
    // async deleteUser(id: string): Promise<void> { ... }
    // async listUsers(params: { ... }): Promise<{ users: SafeUser[], total: number }> { ... }
}

export default new UserService();
