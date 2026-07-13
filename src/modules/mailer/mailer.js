import nodemailer from "nodemailer";
import { ENV } from "../../config/env.js";
import logger from "../../config/logger.js";

let transporter;

const getTransporter = () => {
  const { emails_enabled, resend_api_key } = ENV();

  if (!emails_enabled) {
    return null;
  }

  if (!resend_api_key) {
    throw new Error("RESEND_API_KEY is required when EMAILS_ENABLED is true");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      requireTLS: true,
      auth: {
        user: "resend",
        pass: resend_api_key,
      },
    });
  }

  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  try {
    const activeTransporter = getTransporter();

    if (!activeTransporter) {
      logger.info(`Email disabled; skipped sending to ${to} with subject ${subject}`);
      return { skipped: true };
    }

    const info = await activeTransporter.sendMail({
      from: '"VeraLabel" <support@veralabel.dev>',
      replyTo: "noahkhaemba290@gmail.com",
      to,
      subject,
      html,
    });
    logger.info("Email sent:", info.messageId);
  } catch (error) {
    logger.error("Email sending error:", error);
    throw error;
  }
};

export default sendEmail;
