import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import userService from "@/api/services/user.service.ts";
import {
    CreateUserInput,
    UpdateUserInput,
    UpdateUserParams,
    UpdateProfileInput,
    ListUsersQuery,
    UserIdParams,
} from "@/api/validators/user.validator.ts";
import { ApiError, AuthenticationError, ForbiddenError } from "@/errors/index.ts";
import logger from "@/config/logger.ts";

class UserController {
    /**
     * @route GET /users
     * @group Users - User management operations (Admin)
     * @description Retrieves a paginated list of users. Requires ADMIN role.
     * @param {integer} page.query - Page number for pagination (default: 1)
     * @param {integer} limit.query - Number of users per page (default: 10)
     * @param {string} sortBy.query - Field to sort by (email, firstName, lastName, role, createdAt, updatedAt - default: createdAt)
     * @param {string} sortOrder.query - Sort order ('asc' or 'desc' - default: desc)
     * @param {string} role.query - Filter by user role (ADMIN, MANAGER, STAFF)
     * @param {boolean} isActive.query - Filter by active status (true or false)
     * @param {string} search.query - Search term for email, first name, or last name
     * @security bearerAuth
     * @returns {PaginatedUsersResult.model} 200 - List of users and pagination info
     * @returns {ApiError.model} 400 - Invalid query parameters
     * @returns {ApiError.model} 401 - Authentication required
     * @returns {ApiError.model} 403 - Forbidden (User is not an Admin)
     * @returns {ApiError.model} 500 - Internal Server Error
     */
    async listUsers(req: Request<ListUsersQuery>, res: Response, next: NextFunction): Promise<void> {
        try {
            // Validation of query params is handled by middleware
            const result = await userService.listUsers(req.query);
            res.status(StatusCodes.OK).json(result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route GET /users/{id}
     * @group Users - User management operations (Admin)
     * @description Retrieves a specific user by ID. Requires ADMIN role.
     * @param {string} id.path.required - The UUID of the user to retrieve
     * @security bearerAuth
     * @returns {SafeUser.model} 200 - User details found
     * @returns {ApiError.model} 400 - Invalid ID format
     * @returns {ApiError.model} 401 - Authentication required
     * @returns {ApiError.model} 403 - Forbidden (User is not an Admin)
     * @returns {ApiError.model} 404 - User not found
     * @returns {ApiError.model} 500 - Internal Server Error
     */
    async getUserById(req: Request<UserIdParams>, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.params.id;
            const user = await userService.findUserById(userId);
            res.status(StatusCodes.OK).json(user);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route POST /users
     * @group Users - User management operations (Admin)
     * @description Creates a new user. Requires ADMIN role.
     * @param {CreateUserInput.model} body.body.required - User details for creation
     * @security bearerAuth
     * @returns {SafeUser.model} 201 - User created successfully
     * @returns {ApiError.model} 400 - Validation failed
     * @returns {ApiError.model} 401 - Authentication required
     * @returns {ApiError.model} 403 - Forbidden (User is not an Admin)
     * @returns {ApiError.model} 409 - User with this email already exists
     * @returns {ApiError.model} 500 - Internal Server Error
     */
    async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // Access validated body from middleware
            const validatedBody = req.validatedData?.body as CreateUserInput;
            if (!validatedBody) {
                logger.error("Validated body data is missing in createUser controller.");
                next(new ApiError("Internal processing error: Missing validated data.", StatusCodes.INTERNAL_SERVER_ERROR));
                return;
            }

            const newUser = await userService.createUser(validatedBody);
            res.status(StatusCodes.CREATED).json(newUser);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route PUT /users/{id}
     * @group Users - User management operations (Admin)
     * @description Updates an existing user by ID. Requires ADMIN role.
     * @param {string} id.path.required - The UUID of the user to update
     * @param {UpdateUserInput.model} body.body.required - User details to update (at least one field required)
     * @security bearerAuth
     * @returns {SafeUser.model} 200 - User updated successfully
     * @returns {ApiError.model} 400 - Validation failed (invalid ID or body empty/invalid)
     * @returns {ApiError.model} 401 - Authentication required
     * @returns {ApiError.model} 403 - Forbidden (User is not an Admin)
     * @returns {ApiError.model} 404 - User not found
     * @returns {ApiError.model} 409 - Updated email already in use by another user
     * @returns {ApiError.model} 500 - Internal Server Error
     */
    async updateUser(req: Request<UpdateUserParams, UpdateUserInput>, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.params.id;
            const updatedUser = await userService.updateUser(userId, req.body);
            res.status(StatusCodes.OK).json(updatedUser);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route DELETE /users/{id}
     * @group Users - User management operations (Admin)
     * @description Deletes a user by ID. Requires ADMIN role.
     * @param {string} id.path.required - The UUID of the user to delete
     * @security bearerAuth
     * @returns {object} 204 - No Content (Successful deletion)
     * @returns {ApiError.model} 400 - Invalid ID format
     * @returns {ApiError.model} 401 - Authentication required
     * @returns {ApiError.model} 403 - Forbidden (User is not an Admin or trying to delete self in some setups)
     * @returns {ApiError.model} 404 - User not found
     * @returns {ApiError.model} 500 - Internal Server Error
     */
    async deleteUser(req: Request<UserIdParams>, res: Response, next: NextFunction): Promise<void> {
        try {
            const userIdToDelete = req.params.id;
            const requestingUserId = req.user?.userId; // Get ID from authenticated user

            // Optional: Prevent admin from deleting themselves
            if (userIdToDelete === requestingUserId) {
                next(new ForbiddenError("Administrators cannot delete their own account."));
                return;
            }

            await userService.deleteUser(userIdToDelete);
            res.status(StatusCodes.NO_CONTENT).send(); // Send 204 No Content on successful deletion
        } catch (error) {
            next(error);
        }
    }

    // --- Current User ('Me') Endpoints ---

    /**
     * @route GET /users/me
     * @group Users - Current user operations
     * @description Retrieves the profile details of the currently authenticated user.
     * @security bearerAuth
     * @returns {SafeUser.model} 200 - Current user details
     * @returns {ApiError.model} 401 - Authentication required
     * @returns {ApiError.model} 404 - User data not found (edge case)
     * @returns {ApiError.model} 500 - Internal Server Error
     */
    async getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            // The authenticateToken middleware should have attached req.user
            if (!req.user) {
                // Should be caught by middleware, but safeguard here
                next(new AuthenticationError("Authentication details not found."));
                return;
            }
            // We already checked for existence/active status in middleware, just fetch safe data
            const user = await userService.findUserById(req.user.userId);
            res.status(StatusCodes.OK).json(user);
        } catch (error) {
            // Handle NotFoundError from findUserById if middleware check failed somehow
            next(error);
        }
    }

    /**
     * @route PUT /users/me
     * @group Users - Current user operations
     * @description Updates the profile of the currently authenticated user (limited fields).
     * @param {UpdateProfileInput.model} body.body.required - Profile details to update (e.g., firstName, lastName, password)
     * @security bearerAuth
     * @returns {SafeUser.model} 200 - Updated user profile details
     * @returns {ApiError.model} 400 - Validation failed (body empty/invalid)
     * @returns {ApiError.model} 401 - Authentication required
     * @returns {ApiError.model} 500 - Internal Server Error (e.g., password hashing failed)
     */
    async updateMyProfile(req: Request<UpdateProfileInput>, res: Response, next: NextFunction): Promise<void> {
        try {
            if (!req.user) {
                next(new AuthenticationError("Authentication details not found."));
                return;
            }
            const userId = req.user.userId;
            // Use the same updateUser service method, but provide only allowed fields
            // The service layer handles hashing the password if provided.
            // We rely on the UpdateProfileInput schema validated by middleware to restrict fields.
            const updatedUser = await userService.updateUser(userId, req.body);
            res.status(StatusCodes.OK).json(updatedUser);
        } catch (error) {
            next(error);
        }
    }
}

export default new UserController();
