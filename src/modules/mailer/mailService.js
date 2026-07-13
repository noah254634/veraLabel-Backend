import logger from "../../config/logger.js";
import templates from "./templates.js";
import sendEmail from "./mailer.js";
import UserVera from "../users/user.model.js";
import ResetPassword from "../auth/resetPassword.model.js";
import { generateResetToken } from "./tokens.js";
import crypto from "crypto";
import { ENV } from "../../config/env.js";

const mailService = {
    verifyEmailAccount: async (email, token) => {
       if(!email || !token) throw new Error("Email and token are required");
       const user = await UserVera.findOne({ email });
       if (!user) throw new Error("User not found");
       // Hash incoming token to compare against stored hash
       const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
       const resetTokenDoc = await ResetPassword.findOne({
         email,
         token: hashedToken,
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
    // NOTE: never log the raw token — it is a credential.
    const frontendUrl = ENV().frontend_url;
    const resetLink = `${frontendUrl}/forgot-password`;
    const html = templates.resetPasswordTemplate(user.name || user.username || "there", usertoken, resetLink);
    await sendEmail({
      to: user.email,
      subject: "VeraLabel Password Reset Code",
      html,
    });
    const hashedToken = crypto.createHash("sha256").update(usertoken).digest("hex");
    const user_resetting_password = await ResetPassword.findOneAndUpdate(
      { email: user.email },
      {
        userId: user._id,
        token: hashedToken,
        email: user.email,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
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
    logger.info(`Sending verification email to ${email} for user ${username}`);
    const user = await UserVera.findOne({ email });
    if (!user) throw new Error("User not found");

    // 1. Generate cryptographically secure 6-digit verification code
    const verificationCode = crypto.randomInt(100000, 1000000).toString();

    // 2. Store in ResetPassword collection
    // Hash before storing — never keep plaintext OTPs in the database
    const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
    await ResetPassword.findOneAndUpdate(
      { email: user.email },
      {
        userId: user._id,
        token: hashedCode,
        email: user.email,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    // 3. Send email with the verification code
    const html = templates.mailVerificationTemplate(username || "User", verificationCode);
    await sendEmail({
      to: email,
      subject: "Verify Your VeraLabel Account",
      html,
    });
    logger.info(`Verification email sent to ${email} with code ${verificationCode}`);
  },
  sendWithdrawalOTPEmail: async (user, amount) => {
    logger.info(`Sending withdrawal OTP email to ${user.email} for amount ${amount}`);
    
    // 1. Generate cryptographically secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString();

    // 2. Hash before storing — the plaintext is sent to the user via email only
    const hashedOtp = crypto.createHash('sha256').update(otpCode).digest('hex');
    await ResetPassword.findOneAndUpdate(
      { email: user.email },
      {
        userId: user._id,
        token: hashedOtp,
        email: user.email,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    // 3. Send email with the OTP
    const html = templates.withdrawalOTPTemplate(user.name || "User", otpCode, amount);
    await sendEmail({
      to: user.email,
      subject: "VeraLabel: Withdrawal Authorization Code",
      html,
    });
    logger.info(`Withdrawal OTP email sent to ${user.email}`);
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

  // ===== LABELLER PROMOTION & RATING EMAILS =====
  sendLabellerPromotionNotificationToAdmin: async ({
    labellerName,
    labellerEmail,
    previousTier,
    newTier,
    metrics
  }) => {
    try {
      if (!labellerName || !labellerEmail || !previousTier || !newTier) {
        throw new Error('Missing required promotion notification fields');
      }

      const admins = await UserVera.find({ role: 'admin' }).select('email name');
      
      if (!admins || admins.length === 0) {
        logger.warn('No admin emails found for promotion notification');
        return;
      }

      const adminEmails = admins.map(admin => admin.email).join(',');

      const html = templates.promotionAdminTemplate({
        labellerName,
        labellerEmail,
        previousTier,
        newTier,
        metrics
      });

      await sendEmail({
        to: adminEmails,
        subject: `🎉 Labeller Promotion: ${labellerName} → ${newTier}`,
        html,
      });

      logger.info('Promotion notification sent to admins', {
        labellerName,
        labellerEmail,
        newTier,
        adminCount: admins.length
      });

    } catch (error) {
      logger.error('Error sending promotion notification email', {
        error: error.message,
        labellerName,
        newTier
      });
      throw error;
    }
  },

  /**
   * Send notification to labeller about their promotion
   */
  sendLabellerPromotionEmail: async (labellerName, labellerEmail, newTier) => {
    try {
      if (!labellerName || !labellerEmail || !newTier) {
        throw new Error('Missing required promotion email fields');
      }

      const html = templates.promotionLabellerTemplate(labellerName, newTier);

      await sendEmail({
        to: labellerEmail,
        subject: `🎉 Congratulations! You've been promoted to ${newTier}`,
        html,
      });

      logger.info('Promotion email sent to labeller', {
        labellerName,
        labellerEmail,
        newTier
      });

    } catch (error) {
      logger.error('Error sending labeller promotion email', {
        error: error.message,
        labellerName,
        newTier
      });
      throw error;
    }
  }
};
export default mailService;
