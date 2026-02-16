import nodemailer from "nodemailer";
import {ENV} from "../../config/env.js";
import logger from "../../config/logger.js";
const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  port: 465,
  secure: true,
  requireTLS: true,
  auth: {
    user: "resend",
    pass: ENV().resend_api_key,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: "onboarding@resend.dev",
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
