/**
 * Calculates the number of records to skip for pagination.
 * @param page - Current page number (1-based).
 * @param limit - Number of items per page.
 * @returns The number of items to skip.
 */
export const calculateSkip = (page: number, limit: number): number => {
    return (page - 1) * limit;
};

/**
 * Generates pagination metadata.
 * @param totalItems - Total number of items available.
 * @param page - Current page number (1-based).
 * @param limit - Number of items per page.
 * @returns Pagination metadata object.
 */
export const getPaginationData = (totalItems: number, page: number, limit: number) => {
    const totalPages = Math.ceil(totalItems / limit);
    return {
        totalItems,
        currentPage: page,
        pageSize: limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };
};
