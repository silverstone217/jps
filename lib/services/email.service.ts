import { BrevoClient } from "@getbrevo/brevo";

import {
  BREVO_API_KEY,
  BREVO_SENDER_EMAIL,
  BREVO_SENDER_NAME,
} from "@/utils/envVariables";

if (!BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY is not defined");
}

if (!BREVO_SENDER_EMAIL) {
  throw new Error("BREVO_SENDER_EMAIL is not defined");
}

const brevo = new BrevoClient({
  apiKey: BREVO_API_KEY,
});

export class EmailService {
  static async sendTemporaryPassword(params: {
    email: string;
    name?: string;
    temporaryPassword: string;
  }): Promise<void> {
    try {
      await brevo.transactionalEmails.sendTransacEmail({
        sender: {
          name: BREVO_SENDER_NAME || "Jardin Pro",
          email: BREVO_SENDER_EMAIL,
        },

        to: [
          {
            email: params.email,
            name: params.name,
          },
        ],

        subject: "Votre nouveau mot de passe - Jardin Pro",

        htmlContent: `
          <!DOCTYPE html>
          <html lang="fr">
            <head>
              <meta charset="UTF-8" />
              <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
              />
              <title>Votre nouveau mot de passe</title>
            </head>

            <body
              style="
                margin: 0;
                padding: 0;
                background-color: #f5f5f5;
                font-family: Arial, sans-serif;
                color: #333333;
              "
            >
              <div
                style="
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 40px 20px;
                "
              >
                <div
                  style="
                    background-color: #ffffff;
                    border-radius: 16px;
                    padding: 32px;
                  "
                >
                  <h1
                    style="
                      margin: 0 0 20px;
                      color: #2D5A27;
                      font-size: 24px;
                    "
                  >
                    Jardin Pro
                  </h1>

                  <p style="font-size: 16px; line-height: 1.6;">
                    Bonjour${params.name ? ` ${params.name}` : ""},
                  </p>

                  <p style="font-size: 16px; line-height: 1.6;">
                    Votre demande de réinitialisation du mot de passe
                    a bien été prise en compte.
                  </p>

                  <p style="font-size: 16px; line-height: 1.6;">
                    Voici votre nouveau mot de passe temporaire :
                  </p>

                  <div
                    style="
                      margin: 24px 0;
                      padding: 18px;
                      border-radius: 12px;
                      background-color: #f5f5f5;
                      text-align: center;
                    "
                  >
                    <span
                      style="
                        font-size: 28px;
                        font-weight: bold;
                        letter-spacing: 4px;
                        color: #2D5A27;
                      "
                    >
                      ${params.temporaryPassword}
                    </span>
                  </div>

                  <p
                    style="
                      font-size: 15px;
                      line-height: 1.6;
                      color: #666666;
                    "
                  >
                    Utilisez votre numéro de téléphone et ce mot de
                    passe pour vous connecter à Jardin Pro.
                  </p>

                  <p
                    style="
                      font-size: 15px;
                      line-height: 1.6;
                      color: #666666;
                    "
                  >
                    Pour votre sécurité, vous devrez modifier ce mot
                    de passe depuis les paramètres de votre compte.
                  </p>

                  <p
                    style="
                      margin-top: 28px;
                      font-size: 13px;
                      line-height: 1.5;
                      color: #999999;
                    "
                  >
                    Si vous n'êtes pas à l'origine de cette demande,
                    veuillez contacter votre responsable.
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,

        textContent: `
Jardin Pro

Bonjour${params.name ? ` ${params.name}` : ""},

Votre demande de réinitialisation du mot de passe a bien été prise en compte.

Votre nouveau mot de passe temporaire est :

${params.temporaryPassword}

Utilisez votre numéro de téléphone et ce mot de passe pour vous connecter à Jardin Pro.

Pour votre sécurité, vous devrez modifier ce mot de passe depuis les paramètres de votre compte.

Si vous n'êtes pas à l'origine de cette demande, veuillez contacter votre responsable.
        `.trim(),
      });
    } catch (error) {
      console.error("Erreur envoi email Brevo:", error);

      throw new Error("EMAIL_SEND_FAILED");
    }
  }
}

export default EmailService;
