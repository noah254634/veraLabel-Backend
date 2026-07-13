import { baseLayout, COLORS, FONT_STACK } from './emailBaseLayout.js';

// ─── Reusable inline-style helpers ──────────────────────────────────

const paragraph = (text) =>
  `<p style="font-family: ${FONT_STACK}; font-size: 15px; line-height: 1.7; color: #334155; margin: 0 0 16px 0;">${text}</p>`;

const greeting = (name) =>
  `<p style="font-family: ${FONT_STACK}; font-size: 16px; line-height: 1.6; color: #1e293b; margin: 0 0 16px 0;">Hello <strong>${name}</strong>,</p>`;

const otpBlock = (code) => `
  <div style="text-align: center; margin: 28px 0;">
    <span style="display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; color: #1e1b4b; background-color: #f8fafc; padding: 14px 36px; border-radius: 10px; letter-spacing: 8px; border: 1px solid #cbd5e1; box-shadow: inset 0 2px 4px 0 rgba(0,0,0,0.06);">
      ${code}
    </span>
  </div>`;

const warningBox = (text) => `
  <div style="font-family: ${FONT_STACK}; font-size: 13px; color: ${COLORS.danger}; font-weight: 500; text-align: center; background-color: #fef2f2; padding: 10px 16px; border-radius: 8px; border: 1px solid #fee2e2; margin: 16px 0;">
    ⚠️ ${text}
  </div>`;

const infoBox = (text, borderColor = COLORS.primary) => `
  <div style="font-family: ${FONT_STACK}; background-color: #f8fafc; padding: 16px 20px; border-radius: 8px; border-left: 4px solid ${borderColor}; margin: 20px 0;">
    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #475569;">${text}</p>
  </div>`;

const ctaButton = (text, href, color = COLORS.primary) => `
  <div style="text-align: center; margin: 28px 0;">
    <a href="${href}" style="display: inline-block; padding: 12px 28px; background-color: ${color}; color: #ffffff; text-decoration: none; border-radius: 8px; font-family: ${FONT_STACK}; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); letter-spacing: 0.025em;">
      ${text}
    </a>
  </div>`;

const signOffBlock = (text) =>
  `<p style="font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.5; color: #475569; font-style: italic; margin-top: 24px; border-top: 1px dashed ${COLORS.border}; padding-top: 16px; white-space: pre-line;">${text}</p>`;


// ─── Templates ──────────────────────────────────────────────────────

const templates = {
  // ===== ONBOARDING =====

  welcomeEmailTemplate: (username) => baseLayout({
    preheader: `Welcome to VeraLabel, ${username}! Start exploring datasets and contributing today.`,
    heading: 'Welcome to VeraLabel!',
    headingColor: COLORS.primary,
    content: `
      ${greeting(username)}
      ${paragraph('Thank you for joining our platform. We\'re excited to have you on board!')}
      ${infoBox('Explore datasets, contribute to AI projects, and grow your knowledge — all in one place.', COLORS.primary)}
      ${paragraph('If you have any questions or need help getting started, don\'t hesitate to reach out to our support team.')}
      ${paragraph('Happy exploring! 🚀')}
    `,
  }),

  // ===== SECURITY & AUTH =====

  resetPasswordTemplate: (username, resetCode, resetLink) => baseLayout({
    preheader: 'Your VeraLabel password reset code. Expires in 10 minutes.',
    heading: 'Password Reset',
    headingColor: COLORS.primary,
    content: `
      ${greeting(username)}
      ${paragraph('A password reset was requested for your VeraLabel account. Please use the code below to proceed:')}
      ${otpBlock(resetCode)}
      ${warningBox('This code expires in 10 minutes and can only be used once.')}
      ${ctaButton('Go to Reset Page', resetLink, COLORS.primary)}
      ${paragraph('If you did not request this, you can safely ignore this email. Your account credentials remain secure.')}
    `,
  }),

  mailVerificationTemplate: (username, verificationCode) => baseLayout({
    preheader: `Your VeraLabel verification code: ${verificationCode}`,
    heading: 'Verify Your Account',
    headingColor: COLORS.primary,
    content: `
      ${greeting(username)}
      ${paragraph('Thank you for registering with VeraLabel. To verify your email address, please enter the following 6-digit code in the signup form:')}
      ${otpBlock(verificationCode)}
      ${warningBox('This code expires in 10 minutes.')}
    `,
  }),

  withdrawalOTPTemplate: (username, otp, amount) => baseLayout({
    preheader: `Withdrawal authorization code for $${amount}`,
    heading: 'Withdrawal Authorization',
    headingColor: COLORS.success,
    content: `
      ${greeting(username)}
      ${paragraph(`A withdrawal of <strong>$${amount}</strong> was initiated from your VeraLabel wallet. To authorize this transaction, enter the code below:`)}
      ${otpBlock(otp)}
      ${warningBox('This code expires in 10 minutes. Do not share it with anyone.')}
      ${paragraph('If you did not request this withdrawal, please secure your account immediately by changing your password.')}
    `,
  }),

  // ===== PAYMENTS =====

  paymentConfirmationTemplate: (username, amount, datasetName) => baseLayout({
    preheader: `Payment of $${amount} confirmed for ${datasetName}`,
    heading: 'Payment Confirmed',
    headingColor: COLORS.success,
    content: `
      ${greeting(username)}
      ${paragraph('Your payment has been successfully processed.')}
      ${infoBox(`<strong>Amount:</strong> $${amount}<br/><strong>Dataset:</strong> ${datasetName}`, COLORS.success)}
      ${paragraph('Thank you for your purchase!')}
    `,
  }),

  paymentFailureTemplate: (username, amount, datasetName) => baseLayout({
    preheader: `Payment of $${amount} for ${datasetName} failed`,
    heading: 'Payment Failed',
    headingColor: COLORS.danger,
    content: `
      ${greeting(username)}
      ${paragraph('Unfortunately, your payment did not go through.')}
      ${infoBox(`<strong>Amount:</strong> $${amount}<br/><strong>Dataset:</strong> ${datasetName}`, COLORS.danger)}
      ${paragraph('Please check your payment method and try again, or contact our support team for assistance.')}
    `,
  }),

  // ===== ACCOUNT =====

  accountCreditedTemplate: (username, amount) => baseLayout({
    preheader: `$${amount} has been credited to your VeraLabel account`,
    heading: 'Account Credited',
    headingColor: COLORS.success,
    content: `
      ${greeting(username)}
      ${paragraph(`Your account has been credited with <strong>$${amount}</strong>.`)}
      ${infoBox('Check your balance and continue exploring datasets!', COLORS.success)}
    `,
  }),

  accountDebitedTemplate: (username, amount) => baseLayout({
    preheader: `$${amount} debited from your VeraLabel account`,
    heading: 'Account Debited',
    headingColor: COLORS.warning,
    content: `
      ${greeting(username)}
      ${paragraph(`<strong>$${amount}</strong> has been debited from your account.`)}
      ${paragraph('Thank you for using our platform!')}
    `,
  }),

  // ===== DATASET LIFECYCLE =====

  datasetApprovalTemplate: (username, datasetName) => baseLayout({
    preheader: `Your dataset "${datasetName}" has been approved`,
    heading: 'Dataset Approved',
    headingColor: COLORS.success,
    content: `
      ${greeting(username)}
      ${paragraph(`Your dataset <strong>${datasetName}</strong> has been approved and is now visible to potential buyers.`)}
      ${infoBox('Your dataset is live! Buyers can now discover and purchase it on the marketplace.', COLORS.success)}
    `,
  }),

  datasetRejectionTemplate: (username, datasetName, reason) => baseLayout({
    preheader: `Your dataset "${datasetName}" has been rejected`,
    heading: 'Dataset Rejected',
    headingColor: COLORS.danger,
    content: `
      ${greeting(username)}
      ${paragraph(`Your dataset <strong>${datasetName}</strong> has been rejected.`)}
      ${infoBox(`<strong>Reason:</strong> ${reason}`, COLORS.danger)}
      ${paragraph('Please review the feedback and make the necessary changes before resubmitting.')}
    `,
  }),

  datasetFlagTemplate: (username, datasetName, reason) => baseLayout({
    preheader: `Your dataset "${datasetName}" has been flagged`,
    heading: 'Dataset Flagged',
    headingColor: COLORS.warning,
    content: `
      ${greeting(username)}
      ${paragraph(`Your dataset <strong>${datasetName}</strong> has been flagged by our moderators.`)}
      ${infoBox(`<strong>Reason:</strong> ${reason}`, COLORS.warning)}
      ${paragraph('Please review and address the issue to restore your dataset\'s visibility.')}
    `,
  }),

  datasetUnflagTemplate: (username, datasetName) => baseLayout({
    preheader: `Your dataset "${datasetName}" has been unflagged`,
    heading: 'Dataset Unflagged',
    headingColor: COLORS.success,
    content: `
      ${greeting(username)}
      ${paragraph(`Your dataset <strong>${datasetName}</strong> has been reviewed and unflagged. It is now visible again.`)}
      ${infoBox('Your dataset is back in good standing and visible to users.', COLORS.success)}
    `,
  }),

  datasetDeletionTemplate: (username, datasetName, reason) => baseLayout({
    preheader: `Your dataset "${datasetName}" has been deleted`,
    heading: 'Dataset Deleted',
    headingColor: COLORS.danger,
    content: `
      ${greeting(username)}
      ${paragraph(`Your dataset <strong>${datasetName}</strong> has been deleted.`)}
      ${infoBox(`<strong>Reason:</strong> ${reason}`, COLORS.danger)}
      ${paragraph('If you believe this was an error, please contact our support team.')}
    `,
  }),

  datasetUpdateTemplate: (username, datasetName) => baseLayout({
    preheader: `Your dataset "${datasetName}" has been updated`,
    heading: 'Dataset Updated',
    headingColor: COLORS.primary,
    content: `
      ${greeting(username)}
      ${paragraph(`Your dataset <strong>${datasetName}</strong> has been updated successfully.`)}
    `,
  }),

  datasetPublishTemplate: (username, datasetName) => baseLayout({
    preheader: `Your dataset "${datasetName}" is now live`,
    heading: 'Dataset Published',
    headingColor: COLORS.success,
    content: `
      ${greeting(username)}
      ${paragraph(`Your dataset <strong>${datasetName}</strong> has been published and is live for users.`)}
      ${infoBox('Your dataset is now publicly available on the VeraLabel marketplace.', COLORS.success)}
    `,
  }),

  datasetUnpublishTemplate: (username, datasetName) => baseLayout({
    preheader: `Your dataset "${datasetName}" has been unpublished`,
    heading: 'Dataset Unpublished',
    headingColor: COLORS.warning,
    content: `
      ${greeting(username)}
      ${paragraph(`Your dataset <strong>${datasetName}</strong> has been unpublished and is no longer visible to users.`)}
    `,
  }),

  // ===== LABELLER PROMOTIONS =====

  promotionAdminTemplate: ({ labellerName, labellerEmail, previousTier, newTier, metrics }) => baseLayout({
    preheader: `Labeller ${labellerName} has been promoted to ${newTier}`,
    heading: '🎉 Labeller Promotion Alert',
    headingColor: COLORS.success,
    content: `
      ${paragraph('A labeller has been automatically promoted based on performance metrics:')}
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${COLORS.success};">
        <p style="margin: 0 0 8px 0; font-family: ${FONT_STACK}; font-size: 14px; color: #334155;"><strong>Labeller:</strong> ${labellerName}</p>
        <p style="margin: 0 0 8px 0; font-family: ${FONT_STACK}; font-size: 14px; color: #334155;"><strong>Email:</strong> <a href="mailto:${labellerEmail}" style="color: ${COLORS.primary}; text-decoration: none;">${labellerEmail}</a></p>
        <p style="margin: 0 0 8px 0; font-family: ${FONT_STACK}; font-size: 14px; color: #334155;"><strong>Previous Tier:</strong> <span style="color: ${COLORS.danger};">${previousTier}</span></p>
        <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 14px; color: #334155;"><strong>New Tier:</strong> <span style="color: ${COLORS.success}; font-weight: 700;">⭐ ${newTier}</span></p>
      </div>
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 12px 0; font-family: ${FONT_STACK}; font-size: 15px; font-weight: 600; color: #1e293b;">Performance Metrics</p>
        <p style="margin: 0 0 6px 0; font-family: ${FONT_STACK}; font-size: 14px; color: #334155;">• <strong>Average Quality Score:</strong> ${metrics.averageQualityScore.toFixed(2)}/5.0</p>
        <p style="margin: 0 0 6px 0; font-family: ${FONT_STACK}; font-size: 14px; color: #334155;">• <strong>Approval Rate:</strong> ${metrics.approvalRate.toFixed(2)}%</p>
        <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 14px; color: #334155;">• <strong>Tasks Completed:</strong> ${metrics.totalTasksCompleted}</p>
      </div>
      ${infoBox('<strong>Action Required:</strong> Review this promotion and the labeller\'s profile to ensure it is appropriate.', COLORS.warning)}
    `,
  }),

  promotionLabellerTemplate: (labellerName, newTier) => {
    const tierBadges = { 'Bronze': '🥉', 'Silver': '🥈', 'Gold': '🥇' };
    const tierBenefits = {
      'Bronze': 'Access to more task types and higher-paying projects',
      'Silver': 'Priority task assignments and exclusive datasets',
      'Gold': 'Premium projects, highest pay rates, and special perks',
    };

    return baseLayout({
      preheader: `Congratulations! You've been promoted to ${newTier}`,
      heading: '🎉 Congratulations! You\'ve Been Promoted!',
      headingColor: COLORS.success,
      content: `
        ${greeting(labellerName)}
        ${paragraph('We\'re thrilled to inform you that your excellent performance has earned you a promotion!')}
        <div style="text-align: center; background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #f59e0b;">
          <p style="font-size: 48px; margin: 0 0 8px 0;">${tierBadges[newTier] || '⭐'}</p>
          <p style="margin: 0; font-family: ${FONT_STACK}; font-size: 18px; font-weight: 700; color: ${COLORS.success};">You are now a <strong>${newTier}</strong> Labeller</p>
        </div>
        ${infoBox(`<strong>What This Means For You:</strong><br/>${tierBenefits[newTier] || 'Continue to unlock more opportunities as you improve!'}`, COLORS.success)}
        ${paragraph('<strong>Keep Up The Great Work!</strong> Your dedication to quality work is appreciated. Continue to maintain these high standards to unlock even more opportunities.')}
      `,
    });
  },

  // ===== CUSTOM ADMIN EMAIL =====

  customAdminEmailTemplate: (heading, bodyText, signOff) => {
    const formattedParagraphs = bodyText
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => paragraph(p))
      .join('');

    const formattedSignOff = signOff ? signOffBlock(signOff) : '';

    return baseLayout({
      preheader: bodyText.substring(0, 120).replace(/\n/g, ' '),
      heading: heading,
      headingColor: COLORS.primary,
      content: `
        ${formattedParagraphs}
        ${formattedSignOff}
      `,
    });
  },
};

export default templates;
