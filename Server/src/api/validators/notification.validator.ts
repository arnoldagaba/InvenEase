import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid ID format" });

// Schema for querying user notifications
export const getNotificationQuerySchema = z.object({
    query: z
        .object({
            page: z.string().regex(/^\d+$/).transform(Number).optional(),
            limit: z.string().regex(/^\d+$/).transform(Number).optional(),
            isRead: z
                .enum(["true", "false"])
                .transform((v) => v === "true")
                .optional(), // Filter by read status
            // You could add filters for type, relatedEntityType etc. if needed later
        })
        .strict(),
});

// Schema for validating notification ID in parameters
export const notificationIdParamSchema = z.object({
    params: z.object({
        id: uuidSchema,
    }),
});

// Type Aliases
export type GetNotificationQueryInput = z.infer<typeof getNotificationQuerySchema>["query"];
export type NotificationIdParamInput = z.infer<typeof notificationIdParamSchema>["params"];
