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

      // Get admin email(s) - fetch all admins
      const admins = await UserVera.find({ role: 'admin' }).select('email name');
      
      if (!admins || admins.length === 0) {
        logger.warn('No admin emails found for promotion notification');
        return;
      }

      const adminEmails = admins.map(admin => admin.email).join(',');

      const metricsDisplay = `
        <li><strong>Average Quality Score:</strong> ${metrics.averageQualityScore.toFixed(2)}/5.0</li>
        <li><strong>Approval Rate:</strong> ${metrics.approvalRate.toFixed(2)}%</li>
        <li><strong>Tasks Completed:</strong> ${metrics.totalTasksCompleted}</li>
      `;

      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
          <h2 style="color: #2c3e50;">🎉 Labeller Promotion Alert</h2>
          
          <p style="font-size: 16px;">A labeller has been automatically promoted based on performance metrics:</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
            <p><strong>Labeller Name:</strong> ${labellerName}</p>
            <p><strong>Email:</strong> <a href="mailto:${labellerEmail}">${labellerEmail}</a></p>
            <p><strong>Previous Tier:</strong> <span style="color: #e74c3c;">${previousTier}</span></p>
            <p><strong>New Tier:</strong> <span style="color: #27ae60; font-weight: bold;">⭐ ${newTier}</span></p>
          </div>

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Performance Metrics:</h3>
            <ul style="list-style: none; padding: 0;">
              ${metricsDisplay}
            </ul>
          </div>

          <div style="background-color: #ecf0f1; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Action Required:</strong> You can review this promotion and the labeller's profile to ensure the promotion is appropriate.</p>
          </div>

          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">
            This is an automated notification from the VeraLabel system.
          </p>
        </div>
      `;

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

      const tierBadges = {
        'Bronze': '🥉',
        'Silver': '🥈',
        'Gold': '🥇'
      };

      const tierBenefits = {
        'Bronze': 'Access to more task types and higher-paying projects',
        'Silver': 'Priority task assignments and exclusive datasets',
        'Gold': 'Premium projects, highest pay rates, and special perks'
      };

      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
          <h2 style="color: #2c3e50;">🎉 Congratulations! You\'ve Been Promoted!</h2>
          
          <p style="font-size: 16px;">Dear ${labellerName},</p>
          
          <p>We\'re thrilled to inform you that your excellent performance has earned you a promotion!</p>

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12; text-align: center;">
            <p style="font-size: 48px; margin: 10px 0;">${tierBadges[newTier] || '⭐'}</p>
            <h3 style="color: #27ae60; margin: 0;">You are now a <strong>${newTier}</strong> Labeller</h3>
          </div>

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>What This Means For You:</h3>
            <p style="font-size: 16px; line-height: 1.6;">
              ${tierBenefits[newTier] || 'Continue to unlock more opportunities as you improve!'}
            </p>
          </div>

          <div style="background-color: #ecf0f1; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Keep Up The Great Work!</strong> Your dedication to quality work is appreciated. Continue to maintain these high standards to unlock even more opportunities.</p>
          </div>

          <p style="color: #7f8c8d; font-size: 12px; margin-top: 30px;">
            Best regards,<br/>
            The VeraLabel Team
          </p>
        </div>
      `;

      await sendEmail({
        to: labellerEmail,
        subject: `🎉 Congratulations! You\'ve been promoted to ${newTier}`,
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
