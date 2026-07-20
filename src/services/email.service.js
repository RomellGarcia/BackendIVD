// Nodemailer con Gmail (cuenta con contraseña de aplicación)
// npm install nodemailer
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  }
})

const DEFAULT_SENDER = {
  name: process.env.EMAIL_NAME || 'Instituto Veracruzano del Deporte',
  address: process.env.EMAIL_USER,
}

// Enviar email genérico
export const sendEmail = async ({ to, subject, htmlContent }) => {
  await transporter.sendMail({
    from: DEFAULT_SENDER,
    to,
    subject,
    html: htmlContent,
  })
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

// Email con el código de recuperación de contraseña
export const sendPasswordResetEmail = async ({ to, nombre, codigo }) => {
  await sendEmail({
    to,
    subject: 'Código para recuperar tu contraseña — IVD',
    htmlContent: `
      <h2>Hola${nombre ? ', ' + nombre : ''}</h2>
      <p>Recibimos una solicitud para restablecer tu contraseña. Usa este código para continuar:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #800020;">${codigo}</p>
      <p>Si tú no solicitaste esto, puedes ignorar este correo — tu contraseña no cambiará.</p>
    `
  })
}

// Reemplaza estas dos funciones en tu email.service.js (o el archivo donde
// vivan sendConvocatoriaCanceladaEmail / sendEventoCanceladoEmail). Mismo
// nombre, mismos parámetros — solo cambia el HTML.

const wrapperEmailIVD = ({ tituloEtiqueta, nombre, cuerpoHtml }) => `
  <div style="background-color:#e4e4e5; padding:32px 16px; font-family: Arial, Helvetica, sans-serif;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 12px rgba(128,0,32,0.12);">

      <div style="background-color:#800020; padding:24px 28px;">
        <p style="margin:0; color:rgba(255,255,255,0.7); font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;">
          Instituto Veracruzano del Deporte
        </p>
        <p style="margin:6px 0 0; color:#ffffff; font-size:13px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">
          ${tituloEtiqueta}
        </p>
      </div>

      <div style="padding:28px;">
        <h2 style="margin:0 0 16px; color:#2B1E1E; font-size:20px;">Hola, ${nombre}</h2>
        ${cuerpoHtml}
      </div>

      <div style="padding:16px 28px; background-color:#faf7f8; border-top:1px solid rgba(128,0,32,0.12);">
        <p style="margin:0; color:#7A4069; font-size:11px;">
          Este es un correo automático del sistema de gestión de eventos del IVD. Si tienes dudas, contacta directamente al Instituto.
        </p>
      </div>
    </div>
  </div>
`;

// Email cuando se cancela una convocatoria específica
export const sendConvocatoriaCanceladaEmail = async ({ to, nombre, disciplina, categoria, eventoTitulo }) => {
  await sendEmail({
    to,
    subject: `Convocatoria cancelada: ${disciplina} - ${categoria}`,
    htmlContent: wrapperEmailIVD({
      tituloEtiqueta: 'Convocatoria cancelada',
      nombre,
      cuerpoHtml: `
        <p style="margin:0 0 14px; color:#2B1E1E; font-size:14.5px; line-height:1.6;">
          Te informamos que la convocatoria fue <strong style="color:#800020;">cancelada</strong> por el administrador.
        </p>

        <div style="background-color:#faf2f4; border-left:4px solid #800020; border-radius:6px; padding:14px 16px; margin:0 0 18px;">
          <p style="margin:0 0 4px; font-size:13px; color:#7A4069; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Convocatoria</p>
          <p style="margin:0; font-size:15px; color:#2B1E1E; font-weight:700;">${disciplina} — ${categoria}</p>
          <p style="margin:6px 0 0; font-size:13px; color:#7A4069;">Evento: ${eventoTitulo}</p>
        </div>

        <p style="margin:0; color:#2B1E1E; font-size:14.5px; line-height:1.6;">
          Tu inscripción correspondiente fue dada de baja automáticamente — no necesitas hacer nada más.
        </p>
      `,
    }),
  });
};

// Email cuando se cancela un evento completo
export const sendEventoCanceladoEmail = async ({ to, nombre, eventoTitulo }) => {
  await sendEmail({
    to,
    subject: `Evento cancelado: ${eventoTitulo}`,
    htmlContent: wrapperEmailIVD({
      tituloEtiqueta: 'Evento cancelado',
      nombre,
      cuerpoHtml: `
        <p style="margin:0 0 14px; color:#2B1E1E; font-size:14.5px; line-height:1.6;">
          Te informamos que el siguiente evento fue <strong style="color:#800020;">cancelado</strong> por el administrador.
        </p>

        <div style="background-color:#faf2f4; border-left:4px solid #800020; border-radius:6px; padding:14px 16px; margin:0 0 18px;">
          <p style="margin:0; font-size:15px; color:#2B1E1E; font-weight:700;">${eventoTitulo}</p>
        </div>

        <p style="margin:0; color:#2B1E1E; font-size:14.5px; line-height:1.6;">
          Todas las inscripciones asociadas a este evento fueron dadas de baja automáticamente — no necesitas hacer nada más.
        </p>
      `,
    }),
  });
};

// Agrega estas dos funciones a tu email.service.js, junto a las que ya
// tienes (usan el mismo wrapperEmailIVD que las de atleta, si ya aplicaste
// el rediseño anterior; si no, usa tu wrapper actual).

const listaAtletasHtml = (atletas) => `
  <ul style="margin:0; padding-left:18px; color:#2B1E1E; font-size:14px; line-height:1.8;">
    ${atletas.map((nombre) => `<li>${nombre}</li>`).join('')}
  </ul>
`;

// Email al club cuando se cancela una convocatoria específica — lista solo
// los atletas de ESE club que estaban inscritos en ella.
export const sendConvocatoriaCanceladaClubEmail = async ({ to, clubNombre, disciplina, categoria, eventoTitulo, atletas }) => {
  await sendEmail({
    to,
    subject: `Convocatoria cancelada: ${disciplina} - ${categoria}`,
    htmlContent: wrapperEmailIVD({
      tituloEtiqueta: 'Convocatoria cancelada',
      nombre: clubNombre,
      cuerpoHtml: `
        <p style="margin:0 0 14px; color:#2B1E1E; font-size:14.5px; line-height:1.6;">
          Te informamos que la convocatoria fue <strong style="color:#800020;">cancelada</strong> por el administrador.
        </p>

        <div style="background-color:#faf2f4; border-left:4px solid #800020; border-radius:6px; padding:14px 16px; margin:0 0 18px;">
          <p style="margin:0 0 4px; font-size:13px; color:#7A4069; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Convocatoria</p>
          <p style="margin:0; font-size:15px; color:#2B1E1E; font-weight:700;">${disciplina} — ${categoria}</p>
          <p style="margin:6px 0 0; font-size:13px; color:#7A4069;">Evento: ${eventoTitulo}</p>
        </div>

        <p style="margin:0 0 8px; color:#2B1E1E; font-size:14.5px; line-height:1.6;">
          Los siguientes atletas de tu club estaban inscritos y fueron dados de baja automáticamente:
        </p>
        ${listaAtletasHtml(atletas)}
      `,
    }),
  });
};

// Email al club cuando se cancela un evento completo — lista todos los
// atletas de ESE club inscritos en cualquiera de sus convocatorias.
export const sendEventoCanceladoClubEmail = async ({ to, clubNombre, eventoTitulo, atletas }) => {
  await sendEmail({
    to,
    subject: `Evento cancelado: ${eventoTitulo}`,
    htmlContent: wrapperEmailIVD({
      tituloEtiqueta: 'Evento cancelado',
      nombre: clubNombre,
      cuerpoHtml: `
        <p style="margin:0 0 14px; color:#2B1E1E; font-size:14.5px; line-height:1.6;">
          Te informamos que el siguiente evento fue <strong style="color:#800020;">cancelado</strong> por el administrador.
        </p>

        <div style="background-color:#faf2f4; border-left:4px solid #800020; border-radius:6px; padding:14px 16px; margin:0 0 18px;">
          <p style="margin:0; font-size:15px; color:#2B1E1E; font-weight:700;">${eventoTitulo}</p>
        </div>

        <p style="margin:0 0 8px; color:#2B1E1E; font-size:14.5px; line-height:1.6;">
          Los siguientes atletas de tu club estaban inscritos y fueron dados de baja automáticamente:
        </p>
        ${listaAtletasHtml(atletas)}
      `,
    }),
  });
};