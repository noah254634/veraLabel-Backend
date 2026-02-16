import logger from "../../config/logger.js";
import templates from "./templates.js";
import sendEmail from "./mailer.js";


const mailService= {
    sendWelcomeEmail: async (email, username) => {
        // Here you would integrate with your email sending service (e.g., nodemailer, SendGrid)
        // and use the welcomeEmailTemplate to create the email content.
        logger.info(`Sending welcome email to ${email} for user ${username}`);
        const html = templates.welcomeEmailTemplate(username);
        await sendEmail({
            to: email,
            subject: "Welcome to VeraLabel!",
            html,
        });
        logger.info(`Welcome email sent to ${email} for user ${username}`);

    },
    sendResetPasswordEmail: async (user) => {
        const token = await generateResetToken(user);
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        const html = templates.resetPasswordTemplate(user.username, resetLink);
        await sendEmail({
            to: user.email,
            subject: "Password Reset Request",
            html
        })
    },
    sendVerificationEmail: async (req, res) => {},
    sendPaymentConfirmationEmail: async (req, res) => {
        
    },
    sendPaymentFailureEmail: async (req, res) => {},
    sendAccountCreditedEmail: async (req, res) => {},
    sendAccountDebitedEmail: async (req, res) => {},
    sendDatasetApprovalEmail: async (req, res) => {},
    sendDatasetRejectionEmail: async (req, res) => {},
    sendDatasetFlagEmail: async (req, res) => {},
    sendDatasetUnflagEmail: async (req, res) => {},
    sendDatasetDeletionEmail: async (req, res) => {},
    sendDatasetUpdateEmail: async (req, res) => {},
    sendDatasetPublishEmail: async (req, res) => {},
    sendDatasetUnpublishEmail: async (req, res) => {},
};
export default mailService;