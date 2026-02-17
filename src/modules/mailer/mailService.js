import logger from "../../config/logger.js";
import templates from "./templates.js";
import sendEmail from "./mailer.js";
import UserVera from "../users/user.model.js";
import ResetPassword from "../auth/resetPassword.model.js";
import { generateResetToken } from "./tokens.js";

const mailService = {
    verifyEmailAccount: async (email, token) => {
       if(!email || !token) throw new Error("Email and token are required");
       const user = await UserVera.findOne({ email });
       if (!user) throw new Error("User not found");
       const resetTokenDoc = await ResetPassword.findOne({
         email,
         token,
         expiresAt: { $gt: Date.now() },
       });
       if (!resetTokenDoc) throw new Error("Invalid or expired token");
       if (resetTokenDoc.userId.toString() !== user._id.toString())
         throw new Error("Invalid token for this user");
       user.isVerified = true;
       await user.save();
       await resetTokenDoc.deleteOne();
       return user;

    },
  sendWelcomeEmail: async (email, username) => {
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
    const usertoken = await generateResetToken(user);
    logger.info(`The token is: ${usertoken}`)
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${usertoken}`;
    const html =templates.resetPasswordTemplate(user.name || user.username || "there", resetLink);
    await sendEmail({
      to: user.email,
      subject: "Password Reset Request",
      html,
    });
    const user_resetting_password = await ResetPassword.findOneAndUpdate(
      { email: user.email },
      {
        userId: user._id,
        token: usertoken,
        email: user.email,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
    logger.info(`Reset password email sent to ${user.email}`);
    return user_resetting_password;
  },
  sendVerificationEmail: async (email, username) => {
    const verificationLink = `${process.env.FRONTEND_URL}/verifyEmail?email=${email}`;
    logger.info(`Sending verification email to ${email} for user ${username}`);
    const user=await UserVera.findOne({email});
    if(!user) throw new Error("User not found");
    const html = templates.mailVerificationTemplate(username, verificationLink);
    await sendEmail({
      to: email,
      subject: "Verify Your Email Address",
      html,
    });
  },
  sendPaymentConfirmationEmail: async (username,amount,datasetName) => {
    logger.info(`Sending payment confirmation email to ${username}`);
    const html =templates.paymentConfirmationTemplate(username, amount, datasetName);
    await sendEmail({
      to: username,
      subject: "Payment Confirmation",
      html,
    });
    logger.info(`Payment confirmation email sent to ${username}`);

  },
  sendPaymentFailureEmail: async (username, amount, datasetName) => {
    logger.info(`Sending payment failure email to ${username}`);
    const html=templates.paymentFailureTemplate(username, amount, datasetName);
    await sendEmail({
        to:username,
        subject:"Payment Failure",
        html
    })
  },
  sendAccountCreditedEmail: async (username,amount) => {
    logger.info(`Sending account credited email to ${username}`);
    const html=templates.accountCreditedTemplate(username, amount);
    await sendEmail({
        to:username,
        subject:"Account Credited",
        html
    })
  },
  sendAccountDebitedEmail: async (username,amount) => {
    logger.info("Sending account debited email to ${username}");
    const html=templates.accountDebitedTemplate(username, amount);
    await sendEmail({
        to:username,
        subject:"Account Debited",
        html
    })
  },
  sendDatasetApprovalEmail: async (username, datasetName) => {
    // Implement logic to send dataset approval email
    logger.info(`Sending dataset approval email to ${username}`);
    const html=templates.datasetApprovalTemplate(username, datasetName);
    await sendEmail({
        to:username,
        subject:"Dataset Approved",
        html
    })

  },
  sendDatasetRejectionEmail: async (username,datasetName,reason) => {
    logger.info(`Sending dataset rejection email to ${username}`);
    const html=templates.datasetRejectionTemplate(username, datasetName, reason);
    await sendEmail({
        to:username,
        subject:"Dataset Rejected",
        html
    })
  },
  sendDatasetFlagEmail: async (username, datasetName, reason) => {
    logger.info(`Sending dataset flag email to ${username}`);
    const html=templates.datasetFlagTemplate(username, datasetName, reason);
    await sendEmail({
        to:username,
        subject:"Dataset Flagged",
        html
    })
  },
  sendDatasetUnflagEmail: async (username, datasetName) => {
    logger.info(`Sending dataset unflag email to ${username}`);
    const html=templates.datasetUnflagTemplate(username, datasetName);
    await sendEmail({
        to:username,
        subject:"Dataset Unflagged",
        html
    })
  },
  sendDatasetDeletionEmail: async (username,datasetName,reason) => {
    logger.info(`sending dataset deletion email to ${username}`);
    const html=templates.datasetDeletionTemplate(username, datasetName, reason);
    await sendEmail({
        to:username,
        subject:"Dataset Deleted",
        html
    })

  },
  sendDatasetUpdateEmail: async (username,datasetName,reason) => {
    logger.info("Sending dataset update email");
    const html=templates.datasetUpdateTemplate(username, datasetName, reason);
    await sendEmail({
        to:username,
        subject:"Dataset Updated",
        html
    })
  },
  sendDatasetPublishEmail: async (username,datasetName) => {
    logger.info("Sending dataset publish email");
    const html=templates.datasetPublishTemplate(username, datasetName);
    await sendEmail({
        to:username,
        subject:"Dataset Published",
        html
    })
  },
  sendDatasetUnpublishEmail: async (username,datasetName) => {
    logger.info("Sending dataset unpublish email");
    const html=templates.datasetUnpublishTemplate(username, datasetName);
    await sendEmail({
        to:username,
        subject:"Dataset Unpublished",
        html
    })
  },
};
export default mailService;
