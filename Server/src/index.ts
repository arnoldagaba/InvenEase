import express, { Express, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { StatusCodes } from "http-status-codes";
import env from "@/config/env"

const app: Express = express();
const port = env.PORT;

// --- Core middleware ---
app.use(helmet());
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Routes ---
app.get("/", (_req: Request, res: Response) => {
    res.send("Server is up and running");
})

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({ status: "OK", timestamp: new Date() });
});

// --- Server ---
app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
})