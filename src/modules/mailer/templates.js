const templates = {
  welcomeEmailTemplate: (username) => `
  <h1>Welcome, ${username} to veraLabel!</h1>
  <p>Thank you for joining our platform. Explore datasets, contribute, and grow your AI knowledge.</p>
`,
  resetPasswordTemplate: (username, resetCode, resetLink) => `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px;">
      <h2 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800; tracking-tight: -0.025em;">VeraLabel Account Recovery</h2>
      <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin: 5px 0 0 0; font-weight: 600;">Security Transmission</p>
    </div>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Hello <strong>${username}</strong>,</p>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px; color: #475569;">A password reset sequence was initiated for your VeraLabel workstation. Please enter the authorization code below into the recovery gateway to proceed:</p>
    
    <div style="text-align: center; margin: 35px 0;">
      <span style="display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #1e1b4b; background-color: #f8fafc; padding: 16px 40px; border-radius: 12px; letter-spacing: 8px; border: 1px solid #cbd5e1; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);">
        ${resetCode}
      </span>
    </div>
    
    <div style="text-align: center; margin: 25px 0;">
      <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
        Go to Recovery Gateway
      </a>
    </div>
    
    <p style="font-size: 13px; color: #ef4444; margin-bottom: 30px; font-weight: 500; text-align: center; background-color: #fef2f2; padding: 10px; border-radius: 8px; border: 1px solid #fee2e2;">
      ⚠️ This security credential expires in 10 minutes and can only be used once.
    </p>
    
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 30px; color: #475569;">If you did not request this, you may safely ignore this transmission. Your account credentials remain secure.</p>
    
    <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; font-weight: 500;">
      <p style="margin: 0 0 5px 0;">This is an automated system message. Do not reply to this address.</p>
      <p style="margin: 0;">VeraLabel Security Protocol © 2026</p>
    </div>
  </div>
`,
  mailVerificationTemplate: (username, verificationCode) => `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
    <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px;">
      <h2 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800; tracking-tight: -0.025em;">VeraLabel Account Verification</h2>
      <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin: 5px 0 0 0; font-weight: 600;">Verification Code</p>
    </div>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 15px;">Hello <strong>${username}</strong>,</p>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px; color: #475569;">Thank you for registering with VeraLabel. To verify your email address and authorize your account, please enter the following 6-digit verification code in the system signup gateway:</p>
    
    <div style="text-align: center; margin: 35px 0;">
      <span style="display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #1e1b4b; background-color: #f8fafc; padding: 16px 40px; border-radius: 12px; letter-spacing: 8px; border: 1px solid #cbd5e1; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);">
        ${verificationCode}
      </span>
    </div>
    
    <p style="font-size: 13px; color: #ef4444; margin-bottom: 30px; font-weight: 500; text-align: center; background-color: #fef2f2; padding: 10px; border-radius: 8px; border: 1px solid #fee2e2;">
      ⚠️ This verification credential expires in 10 minutes.
    </p>
    
    <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; font-weight: 500;">
      <p style="margin: 0 0 5px 0;">This is an automated system message. Do not reply to this address.</p>
      <p style="margin: 0;">VeraLabel Security Protocol © 2026</p>
    </div>
  </div>
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
