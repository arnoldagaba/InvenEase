import nodemailer from "nodemailer";
import logger from "@/config/logger.ts";
import env from "@/config/env.ts";
import { ApiError } from "@/errors/ApiError.ts";
import { StatusCodes } from "http-status-codes";

interface MailOptions {
    to: string;
    subject: string;
    text?: string;
    html: string; // Prefer HTML for better formatting
}

// Configure the transporter using environment variables
const transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT, // Default to 587 if not set
    secure: env.EMAIL_PORT === 465 ? true : false, // true for 465, false for other ports
    auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
    },
    // Optional: Add TLS options if needed, e.g., for self-signed certs
    tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production", // Enforce in prod
    },
});

// Verify connection configuration on startup (optional but recommended)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
transporter.verify((error, _success) => {
    if (error) {
        logger.error("Nodemailer configuration error:", error);
    } else {
        logger.info("Nodemailer is configured correctly and ready to send emails.");
    }
});

/**
 * Sends an email using the pre-configured transporter.
 * @param mailOptions - Options for the email (to, subject, text, html).
 */
export const sendEmail = async (mailOptions: MailOptions): Promise<void> => {
    const optionsWithFrom = {
        ...mailOptions,
        from: `"InvenEase" <${env.EMAIL_FROM || env.EMAIL_USER}>`, // Use configured FROM address
    };

    try {
        const info = await transporter.sendMail(optionsWithFrom);
        logger.info(`Email sent successfully: ${info.messageId} to ${mailOptions.to}`);
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info)); // Only works with ethereal accounts
    } catch (error) {
        logger.error(`Error sending email to ${mailOptions.to}:`, error);
        // Don't throw error to the user usually, just log it,
        // unless email sending is absolutely critical for the immediate flow.
        throw new ApiError("Failed to send email.", StatusCodes.INTERNAL_SERVER_ERROR);
    }
};

/**
 * Sends a password reset email.
 * @param toEmail - The recipient's email address.
 * @param token - The raw (unhashed) password reset token.
 * @param userName - Optional user's name for personalization.
 */
export const sendPasswordResetEmail = async (toEmail: string, token: string, userName?: string | null): Promise<void> => {
    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`; // URL for your frontend reset page
    const subject = "Reset Your Password";
    const htmlBody = `
        <p>Hello ${userName || "User"},</p>
        <p>You requested a password reset for your account.</p>
        <p>Please click the link below to set a new password. This link will expire in ${process.env.RESET_TOKEN_EXPIRATION_MINUTES || 60} minutes.</p>
        <p><a href="${resetUrl}" target="_blank">Reset Password</a></p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Link: ${resetUrl}</p> <!-- Include raw link for copy-paste -->
        <br>
        <p>Thanks,</p>
        <p>The InvenEase Team</p>
    `;
    const textBody = `
        Hello ${userName || "User"},\n
        You requested a password reset for your account.\n
        Please visit the following link to set a new password. This link will expire in ${process.env.RESET_TOKEN_EXPIRATION_MINUTES || 60} minutes.\n
        ${resetUrl}\n
        If you did not request a password reset, please ignore this email.\n
        Thanks,\nThe InvenEase Team
    `;

    if (!env.CLIENT_URL) {
        logger.error("CLIENT_URL environment variable is not set. Cannot generate password reset link.");
        return; // Or throw configuration error
    }

    await sendEmail({
        to: toEmail,
        subject: subject,
        text: textBody,
        html: htmlBody,
    });
};

// Optional: Send confirmation email after password reset
export const sendPasswordResetConfirmationEmail = async (toEmail: string, userName?: string | null): Promise<void> => {
    const subject = "Your Password Has Been Reset";
    const htmlBody = `
        <p>Hello ${userName || "User"},</p>
        <p>This email confirms that the password for your account has been successfully reset.</p>
        <p>If you did not perform this action, please contact our support team immediately.</p>
        <br>
        <p>Thanks,</p>
        <p>The InvenEase Team</p>
    `;
    const textBody = `
        Hello ${userName || "User"},\n
        This email confirms that the password for your account has been successfully reset.\n
        If you did not perform this action, please contact our support team immediately.\n
        Thanks,\nThe InvenEase Team
    `;

    await sendEmail({
        to: toEmail,
        subject: subject,
        html: htmlBody,
        text: textBody,
    });
};
