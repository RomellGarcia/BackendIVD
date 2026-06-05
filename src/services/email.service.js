// Brevo (antes Sendinblue) — SDK oficial
// npm install @getbrevo/brevo
import * as Brevo from '@getbrevo/brevo'

const apiInstance = new Brevo.TransactionalEmailsApi()
apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
)

const DEFAULT_SENDER = {
  email: process.env.EMAIL_FROM || 'noreply@ivd.mx',
  name:  process.env.EMAIL_NAME || 'Instituto Veracruzano del Deporte'
}

// Enviar email genérico
export const sendEmail = async ({ to, subject, htmlContent }) => {
  const email = new Brevo.SendSmtpEmail()
  email.sender  = DEFAULT_SENDER
  email.to      = [{ email: to }]
  email.subject = subject
  email.htmlContent = htmlContent

  await apiInstance.sendTransacEmail(email)
}

// Email de bienvenida al registrarse
export const sendWelcomeEmail = async ({ to, nombre }) => {
  await sendEmail({
    to,
    subject: 'Bienvenido al IVD',
    htmlContent: `
      <h2>¡Hola, ${nombre}!</h2>
      <p>Tu cuenta en el Instituto Veracruzano del Deporte ha sido creada exitosamente.</p>
      <p>Ya puedes iniciar sesión y explorar los eventos disponibles.</p>
    `
  })
}

// Email de notificación cuando una solicitud de club es aceptada
export const sendSolicitudAceptadaEmail = async ({ to, nombre, clubNombre }) => {
  await sendEmail({
    to,
    subject: `Tu solicitud al club ${clubNombre} fue aceptada`,
    htmlContent: `
      <h2>¡Buenas noticias, ${nombre}!</h2>
      <p>Tu solicitud para unirte al club <strong>${clubNombre}</strong> ha sido <strong>aceptada</strong>.</p>
      <p>Ya formas parte del club. ¡Mucho éxito!</p>
    `
  })
}

// Email de notificación cuando una solicitud es rechazada
export const sendSolicitudRechazadaEmail = async ({ to, nombre, clubNombre }) => {
  await sendEmail({
    to,
    subject: `Tu solicitud al club ${clubNombre} fue rechazada`,
    htmlContent: `
      <h2>Hola, ${nombre}</h2>
      <p>Lamentablemente tu solicitud para unirte al club <strong>${clubNombre}</strong> fue <strong>rechazada</strong>.</p>
      <p>Puedes intentar con otro club o contactar directamente con el administrador.</p>
    `
  })
}