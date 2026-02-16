const templates = {
  welcomeEmailTemplate: (username) => `
  <h1>Welcome, ${username} to veraLabel!</h1>
  <p>Thank you for joining our platform. Explore datasets, contribute, and grow your AI knowledge.</p>
`,
  resetPasswordTemplate: (username, resetLink) => `
  <h1>Password Reset Request</h1>
  <p>Hello ${username},</p>
  <p>You requested a password reset. Click the button below to reset your password:</p>
  <a href="${resetLink}" style="padding:10px 15px; background:#4caf50; color:white; text-decoration:none;">Reset Password</a>
  <p>If you did not request this, ignore this email.</p>
`,
  mailVerificationTemplate: (username, verificationLink) => `
  <h1>Email Verification</h1>
  <p>Hi ${username},</p>
  <p>Please verify your email address by clicking the link below:</p>
  <a href="${verificationLink}" style="padding:10px 15px; background:#2196f3; color:white; text-decoration:none;">Verify Email</a>
`,
  paymentConfirmationTemplate: (username, amount, datasetName) => `
  <h1>Payment Confirmed</h1>
  <p>Hi ${username},</p>
  <p>Your payment of <strong>$${amount}</strong> for the dataset <strong>${datasetName}</strong> has been successfully processed.</p>
  <p>Thank you for your purchase!</p>
`,
  paymentFailureTemplate: (username, amount, datasetName) => `
  <h1>Payment Failed</h1>
  <p>Hi ${username},</p>
  <p>Unfortunately, your payment of <strong>$${amount}</strong> for the dataset <strong>${datasetName}</strong> did not go through.</p>
  <p>Please try again or contact support.</p>
`,
  accountCreditedTemplate: (username, amount) => `
  <h1>Account Credited</h1>
  <p>Hi ${username},</p>
  <p>Your account has been credited with <strong>$${amount}</strong>.</p>
  <p>Check your balance and continue exploring datasets!</p>
`,
  accountDebitedTemplate: (username, amount) => `
  <h1>Account Debited</h1>
  <p>Hi ${username},</p>
  <p><strong>$${amount}</strong> has been debited from your account.</p>
  <p>Thank you for using our platform!</p>
`,
  datasetApprovalTemplate: (username, datasetName) => `
  <h1>Dataset Approved</h1>
  <p>Hi ${username},</p>
  <p>Your dataset <strong>${datasetName}</strong> has been approved and is now visible to potential buyers.</p>
`,
  datasetRejectionTemplate: (username, datasetName, reason) => `
  <h1>Dataset Rejected</h1>
  <p>Hi ${username},</p>
  <p>Your dataset <strong>${datasetName}</strong> has been rejected.</p>
  <p>Reason: ${reason}</p>
`,
  datasetFlagTemplate: (username, datasetName, reason) => `
  <h1>Dataset Flagged</h1>
  <p>Hi ${username},</p>
  <p>Your dataset <strong>${datasetName}</strong> has been flagged by our moderators.</p>
  <p>Reason: ${reason}</p>
`,
  datasetUnflagTemplate: (username, datasetName) => `
  <h1>Dataset Unflagged</h1>
  <p>Hi ${username},</p>
  <p>Your dataset <strong>${datasetName}</strong> has been reviewed and unflagged. It is now visible again.</p>
`,
  datasetDeletionTemplate: (username, datasetName, reason) => `
  <h1>Dataset Deleted</h1>
  <p>Hi ${username},</p>
  <p>Your dataset <strong>${datasetName}</strong> has been deleted.</p>
  <p>Reason: ${reason}</p>
`,
  datasetUpdateTemplate: (username, datasetName) => `
  <h1>Dataset Updated</h1>
  <p>Hi ${username},</p>
  <p>Your dataset <strong>${datasetName}</strong> has been updated successfully.</p>
`,
  datasetPublishTemplate: (username, datasetName) => `
  <h1>Dataset Published</h1>
  <p>Hi ${username},</p>
  <p>Your dataset <strong>${datasetName}</strong> has been published and is live for users.</p>
`,
  datasetUnpublishTemplate: (username, datasetName) => `
  <h1>Dataset Unpublished</h1>
  <p>Hi ${username},</p>
  <p>Your dataset <strong>${datasetName}</strong> has been unpublished and is no longer visible to users.</p>
`,
};

export default templates;
