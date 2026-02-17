import logger from "../../config/logger.js";
import mailService from "./mailService.js";
//ignored this file as it is not being used anywhere in the codebase. were calling functions directly in the mailService
const mailController = {
  sendWelcomeEmail: async (req,res) => {
    try {
      logger.info("Sending welcome email");
      const { email, username } = req.body;
      if (!email || !username)
        throw new Error("Email and username are required");
      await mailService.sendWelcomeEmail(email, username);
      logger.info(`Welcome email sent to ${email}`);
      return res.status(200).json({ message: "Welcome email sent successfully" });
    } catch (err) {
      logger.error(`Error sending welcome email: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
  },
  sendResetPasswordEmail: async (req, res) => {
        try {
            logger.info("Sending reset password email");
            const user = req.user;
            if (!user) throw new Error("User not found");
            await mailService.sendResetPasswordEmail(user);
            return res.json({ message: "Reset password email sent successfully" });
        }catch (err) {
            logger.error(`Error sending reset password email: ${err.message}`);
            return res.status(400).json({ message: err.message });
        }
  },
  sendVerificationEmail: async (req, res) => {
      try {
        const { email, username } = req.body;
        if (!email || !username)
          throw new Error("Email and username are required");
        await mailService.sendVerificationEmail(email, username);
        logger.info(`Verification email sent to ${email}`);
        return res.status(200).json({ message: "Verification email sent successfully" });
      }catch(err){
        logger.error(`Error sending verification email: ${err.message}`);
        return res.status(400).json({ message: err.message });
      }
  },
  sendPaymentConfirmationEmail: async (req, res) => {
    try{
      logger.info("Sending payment confirmation email");
      const { email, username } = req.body;
      if (!email || !username)
        throw new Error("Email and username are required");
      await mailService.sendPaymentConfirmationEmail(email, username);
      logger.info(`Payment confirmation email sent to ${email}`);
      return res.status(200).json({ message: "Payment confirmation email sent successfully" });
    }catch(err){
      logger.error(`Error sending payment confirmation email: ${err.message}`);
      return res.status(400).json({ message: err.message });
    }
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
export default mailController;
