"use strict";

const nodemailer = require("nodemailer");

// ─── Transporter (Singleton) ────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── HTML-Template-Hülle ───────────────────────────────────────────────────

function buildHtmlTemplate(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SchützenHub</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a365d;padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;background-color:#ffffff;border-radius:6px;display:inline-block;line-height:36px;text-align:center;font-size:20px;">🎯</div>
                <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;vertical-align:middle;margin-left:10px;">SchützenHub</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#718096;">
                Diese E-Mail wurde automatisch von <strong>SchützenHub</strong> versandt.
              </p>
              <p style="margin:0;font-size:12px;color:#a0aec0;">
                Bitte antworte nicht auf diese E-Mail &nbsp;·&nbsp;
                <a href="${process.env.FRONTEND_URL || "https://schuetzenhub.de"}" style="color:#1a365d;text-decoration:none;">schuetzenhub.de</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Hilfsfunktion: E-Mail senden ─────────────────────────────────────────

async function sendMail({ to, subject, html, text }) {
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"SchützenHub" <noreply@schuetzenhub.de>',
    to,
    subject,
    html,
    text,
  });
  console.log(`[EmailService] Gesendet an ${to} — MessageId: ${info.messageId}`);
  return info;
}

// ─── CTA-Button ────────────────────────────────────────────────────────────

function ctaButton(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td style="border-radius:6px;background-color:#1a365d;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

// ─── Textstil-Helfer ───────────────────────────────────────────────────────

const h1 = (text) => `<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1a202c;">${text}</h1>`;
const p = (text) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a5568;">${text}</p>`;
const small = (text) => `<p style="margin:24px 0 0;font-size:13px;color:#a0aec0;">${text}</p>`;
const divider = () => `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;

// ─── Öffentliche Funktionen ────────────────────────────────────────────────

/**
 * Willkommens-E-Mail nach erfolgreicher Registrierung.
 * @param {string} to - E-Mail-Adresse des Empfängers
 * @param {string} firstName - Vorname des neuen Mitglieds
 */
async function sendWelcomeEmail(to, firstName) {
  const name = firstName || "dort";
  const body = `
    ${h1(`Willkommen bei SchützenHub, ${name}! 🎯`)}
    ${p("Deine Registrierung war erfolgreich. Deine Mitgliedsanfrage wurde an den Vereinsadministrator weitergeleitet und wird in Kürze geprüft.")}
    ${p("Sobald dein Konto freigegeben wird, erhältst du eine weitere Benachrichtigung.")}
    ${ctaButton("Zum Login", `${process.env.FRONTEND_URL || "https://schuetzenhub.de"}/auth`)}
    ${divider()}
    ${small("Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.")}
  `;
  await sendMail({
    to,
    subject: "Willkommen bei SchützenHub – Registrierung erfolgreich",
    html: buildHtmlTemplate(body),
    text: `Hallo ${name},\n\ndeine Registrierung war erfolgreich. Deine Mitgliedsanfrage wurde an den Vereinsadministrator weitergeleitet.\n\nLogin: ${process.env.FRONTEND_URL || "https://schuetzenhub.de"}/auth`,
  });
}

/**
 * Passwort-Reset-E-Mail.
 * @param {string} to - E-Mail-Adresse des Empfängers
 * @param {string} firstName - Vorname (kann leer sein)
 * @param {string} resetUrl - Vollständiger Reset-Link
 */
async function sendPasswordResetEmail(to, firstName, resetUrl) {
  const name = firstName || "dort";
  const body = `
    ${h1("Passwort zurücksetzen")}
    ${p(`Hallo${name !== "dort" ? ` ${name}` : ""},`)}
    ${p("wir haben eine Anfrage erhalten, das Passwort für deinen SchützenHub-Account zurückzusetzen. Klicke auf den folgenden Button, um ein neues Passwort zu vergeben:")}
    ${ctaButton("Passwort zurücksetzen", resetUrl)}
    ${divider()}
    ${p('<strong>Dieser Link ist 1 Stunde gültig.</strong>')}
    ${small("Falls du keine Passwort-Zurücksetzung angefordert hast, ignoriere diese E-Mail. Dein Passwort bleibt unverändert.")}
  `;
  await sendMail({
    to,
    subject: "SchützenHub – Passwort zurücksetzen",
    html: buildHtmlTemplate(body),
    text: `Passwort zurücksetzen\n\nKlicke auf diesen Link (gültig für 1 Stunde):\n${resetUrl}\n\nFalls du keine Anfrage gestellt hast, ignoriere diese E-Mail.`,
  });
}

/**
 * E-Mail-Verifizierungs-E-Mail.
 * @param {string} to - E-Mail-Adresse des Empfängers
 * @param {string} firstName - Vorname
 * @param {string} verifyUrl - Vollständiger Verifikations-Link
 */
async function sendVerificationEmail(to, firstName, verifyUrl) {
  const name = firstName || "dort";
  const body = `
    ${h1("E-Mail-Adresse bestätigen")}
    ${p(`Hallo ${name},`)}
    ${p("bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Button klickst:")}
    ${ctaButton("E-Mail bestätigen", verifyUrl)}
    ${divider()}
    ${p('<strong>Dieser Link ist 24 Stunden gültig.</strong>')}
    ${small("Falls du kein Konto bei SchützenHub erstellt hast, ignoriere diese E-Mail.")}
  `;
  await sendMail({
    to,
    subject: "SchützenHub – E-Mail-Adresse bestätigen",
    html: buildHtmlTemplate(body),
    text: `E-Mail bestätigen\n\nKlicke auf diesen Link:\n${verifyUrl}`,
  });
}

/**
 * Generische Benachrichtigungs-E-Mail (z. B. für Plattform-Events).
 * @param {string} to - E-Mail-Adresse des Empfängers
 * @param {string} subject - Betreff
 * @param {string} message - Nachrichtentext (HTML erlaubt)
 * @param {string} [ctaUrl] - Optionaler CTA-Link
 * @param {string} [ctaText] - Optionaler CTA-Button-Text
 */
async function sendNotificationEmail(to, subject, message, ctaUrl, ctaText) {
  const body = `
    ${h1(subject)}
    ${p(message)}
    ${ctaUrl && ctaText ? ctaButton(ctaText, ctaUrl) : ""}
    ${divider()}
    ${small('Du erhältst diese E-Mail, weil Benachrichtigungen per E-Mail für deinen Account aktiviert sind.')}
  `;
  await sendMail({
    to,
    subject: `SchützenHub – ${subject}`,
    html: buildHtmlTemplate(body),
    text: `${subject}\n\n${message}${ctaUrl ? `\n\n${ctaUrl}` : ""}`,
  });
}

/**
 * Bestätigungs-E-Mail: Mitgliedschaft wurde genehmigt.
 * @param {string} to - E-Mail-Adresse des Mitglieds
 * @param {string} firstName - Vorname
 * @param {string} clubName - Name des Vereins
 */
async function sendMembershipApprovedEmail(to, firstName, clubName) {
  const name = firstName || "dort";
  const club = clubName || "deinem Verein";
  const body = `
    ${h1("Mitgliedschaft genehmigt 🎉")}
    ${p(`Hallo ${name},`)}
    ${p(`freue dich – deine Mitgliedsanfrage bei <strong>${club}</strong> wurde genehmigt! Du kannst dich jetzt vollständig im SchützenHub-Portal anmelden und alle Funktionen nutzen.`)}
    ${ctaButton("Jetzt einloggen", `${process.env.FRONTEND_URL || "https://schuetzenhub.de"}/auth`)}
    ${divider()}
    ${small("Willkommen im Verein!")}
  `;
  await sendMail({
    to,
    subject: `SchützenHub – Mitgliedschaft bei ${club} genehmigt`,
    html: buildHtmlTemplate(body),
    text: `Hallo ${name},\n\ndeine Mitgliedschaft bei ${club} wurde genehmigt!\n\nZum Login: ${process.env.FRONTEND_URL || "https://schuetzenhub.de"}/auth`,
  });
}

/**
 * Ablehnungs-E-Mail: Mitgliedschaftsanfrage wurde abgelehnt.
 * @param {string} to - E-Mail-Adresse des Mitglieds
 * @param {string} firstName - Vorname
 * @param {string} clubName - Name des Vereins
 */
async function sendMembershipRejectedEmail(to, firstName, clubName) {
  const name = firstName || "dort";
  const club = clubName || "dem Verein";
  const body = `
    ${h1("Mitgliedsanfrage nicht angenommen")}
    ${p(`Hallo ${name},`)}
    ${p(`deine Mitgliedsanfrage bei <strong>${club}</strong> wurde leider nicht angenommen. Bitte wende dich direkt an den Vereinsadministrator, falls du Fragen dazu hast.`)}
    ${divider()}
    ${small("Du erhältst diese E-Mail als Benachrichtigung über den Status deiner Anfrage.")}
  `;
  await sendMail({
    to,
    subject: `SchützenHub – Mitgliedsanfrage bei ${club}`,
    html: buildHtmlTemplate(body),
    text: `Hallo ${name},\n\ndeine Mitgliedsanfrage bei ${club} wurde leider nicht angenommen.\n\nBitte wende dich bei Fragen direkt an den Vereinsadministrator.`,
  });
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendNotificationEmail,
  sendMembershipApprovedEmail,
  sendMembershipRejectedEmail,
};
