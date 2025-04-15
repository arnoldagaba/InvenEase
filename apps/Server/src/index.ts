import express, { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import logger from "./config/logger.js";
import morganMiddleware from "./lib/morganMiddleware.js";
import AppError from "./utils/AppError.js";
import { globalErrorHandler } from "./lib/globalErrorHandler.js";

const app = express();

app.use(express.json());
app.use(morganMiddleware);

app.get("/api/v1/health", (_req: Request, res: Response) => {
    res.status(StatusCodes.OK).send("Backend is working");
});

// Global Error handler
app.use(globalErrorHandler);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
});
