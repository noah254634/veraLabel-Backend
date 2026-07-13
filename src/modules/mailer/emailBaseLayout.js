/**
 * Shared base HTML layout for all VeraLabel emails.
 *
 * Uses table-based structure for maximum compatibility across
 * Gmail, Outlook, Apple Mail, and mobile clients.
 *
 * Every template should call baseLayout({ preheader, heading, content })
 * and only supply its unique inner content.
 */

const BRAND = {
  name: 'VeraLabel',
  tagline: 'AI Data Labelling Platform',
  supportEmail: 'support@veralabel.dev',
  year: new Date().getFullYear(),
};

const COLORS = {
  primary:       '#4f46e5',
  primaryDark:   '#3730a3',
  success:       '#10b981',
  danger:        '#ef4444',
  warning:       '#f59e0b',
  neutralBg:     '#f4f4f7',
  cardBg:        '#ffffff',
  textPrimary:   '#1e293b',
  textSecondary: '#64748b',
  textMuted:     '#94a3b8',
  border:        '#e2e8f0',
  borderLight:   '#f1f5f9',
};

const FONT_STACK = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * @param {Object} options
 * @param {string} [options.preheader]    - Hidden preview text for inbox
 * @param {string}  options.heading       - Email card heading
 * @param {string} [options.headingColor] - Accent color for heading (default: primary)
 * @param {string}  options.content       - Inner HTML body content
 * @returns {string} Complete HTML email document
 */
const baseLayout = ({ preheader = '', heading, headingColor, content }) => {
  const accentColor = headingColor || COLORS.primary;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${heading}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-padding { padding: 20px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.neutralBg}; font-family: ${FONT_STACK}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">

  ${preheader ? `<span style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all;">${preheader}</span>` : ''}

  <!-- Outer wrapper table -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${COLORS.neutralBg};">
    <tr>
      <td style="padding: 40px 16px;">

        <!-- Email container -->
        <table class="email-container" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="max-width: 600px; margin: 0 auto;">

          <!-- HEADER -->
          <tr>
            <td style="padding: 28px 32px; text-align: center; background-color: ${COLORS.primary}; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-family: ${FONT_STACK}; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; line-height: 1.2;">
                ${BRAND.name}
              </h1>
              <p style="margin: 6px 0 0 0; font-family: ${FONT_STACK}; font-size: 12px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.15em; font-weight: 500;">
                ${BRAND.tagline}
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td class="email-padding" style="padding: 36px 32px; background-color: ${COLORS.cardBg}; border-left: 1px solid ${COLORS.border}; border-right: 1px solid ${COLORS.border};">

              <!-- Heading -->
              <h2 style="margin: 0 0 4px 0; font-family: ${FONT_STACK}; font-size: 22px; font-weight: 700; color: ${accentColor}; line-height: 1.3;">
                ${heading}
              </h2>

              <!-- Divider -->
              <div style="height: 3px; width: 48px; background-color: ${accentColor}; border-radius: 2px; margin: 12px 0 24px 0;"></div>

              <!-- Content slot -->
              ${content}

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding: 24px 32px; background-color: ${COLORS.borderLight}; border-radius: 0 0 12px 12px; border: 1px solid ${COLORS.border}; border-top: none; text-align: center;">
              <p style="margin: 0 0 6px 0; font-family: ${FONT_STACK}; font-size: 12px; color: ${COLORS.textMuted}; line-height: 1.5;">
                &copy; ${BRAND.year} ${BRAND.name} &middot;
                <a href="mailto:${BRAND.supportEmail}" style="color: ${COLORS.primary}; text-decoration: none;">${BRAND.supportEmail}</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->

</body>
</html>`;
};

export { baseLayout, COLORS, FONT_STACK, BRAND };
export default baseLayout;
