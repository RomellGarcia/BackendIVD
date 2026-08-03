const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

const DEFAULT_SENDER = {
  name: process.env.EMAIL_FROM_NAME || 'Instituto Veracruzano del Deporte',
  email: process.env.EMAIL_FROM_EMAIL,
}

// Enviar email genérico
export const sendEmail = async ({ to, subject, htmlContent }) => {
  const destinatarios = Array.isArray(to) ? to : [to]

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: DEFAULT_SENDER,
      to: destinatarios.map((email) => ({ email })),
      subject,
      htmlContent,
    }),
  })

  if (!response.ok) {
    const detalle = await response.json().catch(() => ({}))
    console.error('Error al enviar correo con Brevo:', detalle)
    throw new Error(detalle.message || 'No se pudo enviar el correo')
  }
}

// Plantilla visual única para todos los correos del sistema
const PALETA = {
  burgundy: '#800020',
  burgundyDark: '#5C0017',
  purple: '#7A4069',
  ink: '#2B1E1E',
  cream: '#F4EFE9',
  verde: '#1D6F42',
  verdeSoft: '#EAF6EF',
  rojoSoft: '#FBEEF0',
}

const wrapperEmailIVD = ({ emoji = '📣', tituloEtiqueta, nombre, cuerpoHtml, acento = PALETA.burgundy }) => `
  <div style="background-color:${PALETA.cream}; padding:40px 16px; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
    <div style="max-width:540px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 8px 28px rgba(128,0,32,0.14);">

      <div style="background:linear-gradient(135deg, ${PALETA.burgundy} 0%, ${PALETA.burgundyDark} 100%); padding:30px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <p style="margin:0; color:rgba(255,255,255,0.65); font-size:10.5px; font-weight:700; letter-spacing:2px; text-transform:uppercase;">
                Instituto Veracruzano del Deporte
              </p>
            </td>
            <td align="right">
              <div style="display:inline-block; width:38px; height:38px; line-height:38px; text-align:center; background:rgba(255,255,255,0.14); border-radius:50%; font-size:18px;">
                ${emoji}
              </div>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0; color:#ffffff; font-size:16px; font-weight:800;">
          ${tituloEtiqueta}
        </p>
      </div>

      <div style="padding:32px;">
        <p style="margin:0 0 18px; color:${PALETA.ink}; font-size:19px; font-weight:800;">Hola, ${nombre}</p>
        ${cuerpoHtml}
      </div>

      <div style="padding:18px 32px; background-color:${PALETA.cream}; border-top:3px solid ${acento};">
        <p style="margin:0; color:${PALETA.purple}; font-size:11px; line-height:1.5;">
          Este es un correo automático del sistema de gestión deportiva del IVD. No respondas a este mensaje directamente; si tienes dudas, contacta al Instituto.
        </p>
      </div>
    </div>
  </div>
`;

const destacado = ({ label, lineas, acento = PALETA.burgundy, bg = PALETA.rojoSoft }) => `
  <div style="background-color:${bg}; border-left:4px solid ${acento}; border-radius:8px; padding:16px 18px; margin:0 0 20px;">
    ${label ? `<p style="margin:0 0 5px; font-size:12px; color:${PALETA.purple}; font-weight:800; text-transform:uppercase; letter-spacing:0.6px;">${label}</p>` : ''}
    ${lineas.map((l, i) => `<p style="margin:${i === 0 ? '0' : '5px 0 0'}; font-size:${i === 0 ? '15.5px' : '13px'}; color:${PALETA.ink}; font-weight:${i === 0 ? '700' : '400'};">${l}</p>`).join('')}
  </div>
`;

const parrafo = (texto) => `<p style="margin:0 0 16px; color:${PALETA.ink}; font-size:14.5px; line-height:1.65;">${texto}</p>`;

const listaAtletasHtml = (atletas) => `
  <ul style="margin:0 0 4px; padding-left:20px; color:${PALETA.ink}; font-size:14px; line-height:1.9;">
    ${atletas.map((nombre) => `<li>${nombre}</li>`).join('')}
  </ul>
`;

// Cuenta / acceso
export const sendPasswordResetEmail = async ({ to, nombre, codigo }) => {
  await sendEmail({
    to,
    subject: 'Código para recuperar tu contraseña — IVD',
    htmlContent: wrapperEmailIVD({
      emoji: '🔑', tituloEtiqueta: 'Recuperar contraseña', nombre: nombre || '',
      cuerpoHtml: `
        ${parrafo('Recibimos una solicitud para restablecer tu contraseña. Usa este código para continuar:')}
        <p style="text-align:center; margin:0 0 16px;">
          <span style="display:inline-block; font-size:30px; font-weight:800; letter-spacing:6px; color:${PALETA.burgundy}; background:${PALETA.cream}; padding:12px 22px; border-radius:10px;">${codigo}</span>
        </p>
        ${parrafo('Si tú no solicitaste esto, ignora este correo — tu contraseña no cambiará.')}
      `,
    }),
  })
}


// Club — solicitudes / invitaciones (lado ATLETA)
export const sendSolicitudAceptadaEmail = async ({ to, nombre, clubNombre }) => {
  await sendEmail({
    to,
    subject: `Tu solicitud al club ${clubNombre} fue aceptada`,
    htmlContent: wrapperEmailIVD({
      emoji: '✅', tituloEtiqueta: 'Solicitud aceptada', nombre, acento: PALETA.verde,
      cuerpoHtml: `
        ${parrafo(`¡Buenas noticias! Tu solicitud para unirte al club <strong>${clubNombre}</strong> fue <strong style="color:${PALETA.verde};">aceptada</strong>.`)}
        ${parrafo('Ya formas parte del club. ¡Mucho éxito en tu próxima competencia!')}
      `,
    }),
  })
}

export const sendSolicitudRechazadaEmail = async ({ to, nombre, clubNombre }) => {
  await sendEmail({
    to,
    subject: `Tu solicitud al club ${clubNombre} fue rechazada`,
    htmlContent: wrapperEmailIVD({
      emoji: '✖️', tituloEtiqueta: 'Solicitud rechazada', nombre,
      cuerpoHtml: `
        ${parrafo(`Lamentablemente tu solicitud para unirte al club <strong>${clubNombre}</strong> fue <strong style="color:${PALETA.burgundy};">rechazada</strong>.`)}
        ${parrafo('Puedes intentar con otro club o contactar directamente al administrador para más información.')}
      `,
    }),
  })
}

export const sendInvitacionClubEmail = async ({ to, nombre, clubNombre }) => {
  await sendEmail({
    to,
    subject: `${clubNombre} te invitó a unirte`,
    htmlContent: wrapperEmailIVD({
      emoji: '🤝', tituloEtiqueta: 'Invitación de club', nombre,
      cuerpoHtml: `
        ${parrafo(`El club <strong>${clubNombre}</strong> te envió una invitación para unirte a su plantilla.`)}
        ${parrafo('Inicia sesión en la plataforma del IVD para aceptar o rechazar la invitación.')}
      `,
    }),
  })
}

// Al atleta, cuando se queda sin club (lo sacan o él mismo se independiza y queda confirmado)
export const sendSalidaClubEmail = async ({ to, nombre, clubNombre }) => {
  await sendEmail({
    to,
    subject: `Ya no perteneces al club ${clubNombre}`,
    htmlContent: wrapperEmailIVD({
      emoji: '👋', tituloEtiqueta: 'Salida de club', nombre,
      cuerpoHtml: `
        ${parrafo(`Te informamos que ya no perteneces al club <strong>${clubNombre}</strong>.`)}
        ${parrafo('Si esto no fue lo que esperabas, contacta directamente al club o al administrador del sistema.')}
      `,
    }),
  })
}


// Club — el lado del CLUB de las mismas solicitudes/invitaciones
export const sendSolicitudRecibidaClubEmail = async ({ to, clubNombre, atletaNombre }) => {
  await sendEmail({
    to,
    subject: `${atletaNombre} solicitó unirse a tu club`,
    htmlContent: wrapperEmailIVD({
      emoji: '📨', tituloEtiqueta: 'Nueva solicitud', nombre: clubNombre,
      cuerpoHtml: `
        ${parrafo(`El atleta <strong>${atletaNombre}</strong> solicitó unirse a tu club.`)}
        ${parrafo('Inicia sesión en la plataforma para revisar la solicitud y aceptarla o rechazarla.')}
      `,
    }),
  })
}

// Mismo criterio, para cuando quien solicita unirse es un entrenador.
export const sendSolicitudEntrenadorRecibidaClubEmail = async ({ to, clubNombre, entrenadorNombre }) => {
  await sendEmail({
    to,
    subject: `${entrenadorNombre} solicitó unirse a tu club`,
    htmlContent: wrapperEmailIVD({
      emoji: '📨', tituloEtiqueta: 'Nueva solicitud', nombre: clubNombre,
      cuerpoHtml: `
        ${parrafo(`El entrenador <strong>${entrenadorNombre}</strong> solicitó unirse a tu club.`)}
        ${parrafo('Inicia sesión en la plataforma para revisar la solicitud y aceptarla o rechazarla.')}
      `,
    }),
  })
}

export const sendInvitacionAceptadaClubEmail = async ({ to, clubNombre, atletaNombre }) => {
  await sendEmail({
    to,
    subject: `${atletaNombre} aceptó tu invitación`,
    htmlContent: wrapperEmailIVD({
      emoji: '✅', tituloEtiqueta: 'Invitación aceptada', nombre: clubNombre, acento: PALETA.verde,
      cuerpoHtml: parrafo(`El atleta <strong>${atletaNombre}</strong> aceptó tu invitación y ya forma parte de tu club.`),
    }),
  })
}

// Mismo criterio, para cuando el atleta rechaza la invitación.
export const sendInvitacionRechazadaClubEmail = async ({ to, clubNombre, atletaNombre }) => {
  await sendEmail({
    to,
    subject: `${atletaNombre} rechazó tu invitación`,
    htmlContent: wrapperEmailIVD({
      emoji: '✖️', tituloEtiqueta: 'Invitación rechazada', nombre: clubNombre,
      cuerpoHtml: parrafo(`El atleta <strong>${atletaNombre}</strong> rechazó tu invitación para unirse al club.`),
    }),
  })
}

// Mismo criterio, para cuando quien acepta la invitación es un entrenador.
export const sendInvitacionEntrenadorAceptadaClubEmail = async ({ to, clubNombre, entrenadorNombre }) => {
  await sendEmail({
    to,
    subject: `${entrenadorNombre} aceptó tu invitación`,
    htmlContent: wrapperEmailIVD({
      emoji: '✅', tituloEtiqueta: 'Invitación aceptada', nombre: clubNombre, acento: PALETA.verde,
      cuerpoHtml: parrafo(`El entrenador <strong>${entrenadorNombre}</strong> aceptó tu invitación y ya forma parte de tu club.`),
    }),
  })
}

// Mismo criterio, para cuando el entrenador rechaza la invitación.
export const sendInvitacionEntrenadorRechazadaClubEmail = async ({ to, clubNombre, entrenadorNombre }) => {
  await sendEmail({
    to,
    subject: `${entrenadorNombre} rechazó tu invitación`,
    htmlContent: wrapperEmailIVD({
      emoji: '✖️', tituloEtiqueta: 'Invitación rechazada', nombre: clubNombre,
      cuerpoHtml: parrafo(`El entrenador <strong>${entrenadorNombre}</strong> rechazó tu invitación para unirse al club.`),
    }),
  })
}

export const sendAtletaSalioClubEmail = async ({ to, clubNombre, atletaNombre }) => {
  await sendEmail({
    to,
    subject: `${atletaNombre} salió de tu club`,
    htmlContent: wrapperEmailIVD({
      emoji: '👋', tituloEtiqueta: 'Atleta dado de baja', nombre: clubNombre,
      cuerpoHtml: parrafo(`El atleta <strong>${atletaNombre}</strong> ya no forma parte de tu club.`),
    }),
  })
}

// Mismo criterio, para cuando quien sale (o es expulsado) es un entrenador.
export const sendEntrenadorSalioClubEmail = async ({ to, clubNombre, entrenadorNombre }) => {
  await sendEmail({
    to,
    subject: `${entrenadorNombre} salió de tu club`,
    htmlContent: wrapperEmailIVD({
      emoji: '👋', tituloEtiqueta: 'Entrenador dado de baja', nombre: clubNombre,
      cuerpoHtml: parrafo(`El entrenador <strong>${entrenadorNombre}</strong> ya no forma parte de tu club.`),
    }),
  })
}


// Cancelaciones — lado ATLETA
export const sendConvocatoriaCanceladaEmail = async ({ to, nombre, disciplina, categoria, eventoTitulo }) => {
  await sendEmail({
    to,
    subject: `Convocatoria cancelada: ${disciplina} - ${categoria}`,
    htmlContent: wrapperEmailIVD({
      emoji: '🚫', tituloEtiqueta: 'Convocatoria cancelada', nombre,
      cuerpoHtml: `
        ${parrafo(`Te informamos que la convocatoria fue <strong style="color:${PALETA.burgundy};">cancelada</strong> por el administrador.`)}
        ${destacado({ label: 'Convocatoria', lineas: [`${disciplina} — ${categoria}`, `Evento: ${eventoTitulo}`] })}
        ${parrafo('Tu inscripción correspondiente fue dada de baja automáticamente — no necesitas hacer nada más.')}
      `,
    }),
  });
};

export const sendEventoCanceladoEmail = async ({ to, nombre, eventoTitulo }) => {
  await sendEmail({
    to,
    subject: `Evento cancelado: ${eventoTitulo}`,
    htmlContent: wrapperEmailIVD({
      emoji: '🚫', tituloEtiqueta: 'Evento cancelado', nombre,
      cuerpoHtml: `
        ${parrafo(`Te informamos que el siguiente evento fue <strong style="color:${PALETA.burgundy};">cancelado</strong> por el administrador.`)}
        ${destacado({ label: null, lineas: [eventoTitulo] })}
        ${parrafo('Todas las inscripciones asociadas a este evento fueron dadas de baja automáticamente — no necesitas hacer nada más.')}
      `,
    }),
  });
};

// Cancelaciones — lado CLUB (lista los atletas propios afectados)
export const sendConvocatoriaCanceladaClubEmail = async ({ to, clubNombre, disciplina, categoria, eventoTitulo, atletas }) => {
  await sendEmail({
    to,
    subject: `Convocatoria cancelada: ${disciplina} - ${categoria}`,
    htmlContent: wrapperEmailIVD({
      emoji: '🚫', tituloEtiqueta: 'Convocatoria cancelada', nombre: clubNombre,
      cuerpoHtml: `
        ${parrafo(`Te informamos que la convocatoria fue <strong style="color:${PALETA.burgundy};">cancelada</strong> por el administrador.`)}
        ${destacado({ label: 'Convocatoria', lineas: [`${disciplina} — ${categoria}`, `Evento: ${eventoTitulo}`] })}
        ${parrafo('Los siguientes atletas de tu club estaban inscritos y fueron dados de baja automáticamente:')}
        ${listaAtletasHtml(atletas)}
      `,
    }),
  });
};

export const sendEventoCanceladoClubEmail = async ({ to, clubNombre, eventoTitulo, atletas }) => {
  await sendEmail({
    to,
    subject: `Evento cancelado: ${eventoTitulo}`,
    htmlContent: wrapperEmailIVD({
      emoji: '🚫', tituloEtiqueta: 'Evento cancelado', nombre: clubNombre,
      cuerpoHtml: `
        ${parrafo(`Te informamos que el siguiente evento fue <strong style="color:${PALETA.burgundy};">cancelado</strong> por el administrador.`)}
        ${destacado({ label: null, lineas: [eventoTitulo] })}
        ${parrafo('Los siguientes atletas de tu club estaban inscritos y fueron dados de baja automáticamente:')}
        ${listaAtletasHtml(atletas)}
      `,
    }),
  });
};


// Finalización — lado ATLETA
export const sendConvocatoriaFinalizadaEmail = async ({ to, nombre, disciplina, categoria, eventoTitulo }) => {
  await sendEmail({
    to,
    subject: `Convocatoria finalizada: ${disciplina} - ${categoria}`,
    htmlContent: wrapperEmailIVD({
      emoji: '🏁', tituloEtiqueta: 'Convocatoria finalizada', nombre,
      cuerpoHtml: `
        ${parrafo('La convocatoria en la que participaste ha <strong>finalizado</strong>.')}
        ${destacado({ label: 'Convocatoria', lineas: [`${disciplina} — ${categoria}`, `Evento: ${eventoTitulo}`], acento: PALETA.purple, bg: PALETA.cream })}
      `,
    }),
  });
};

export const sendEventoFinalizadoEmail = async ({ to, nombre, eventoTitulo }) => {
  await sendEmail({
    to,
    subject: `Evento finalizado: ${eventoTitulo}`,
    htmlContent: wrapperEmailIVD({
      emoji: '🏁', tituloEtiqueta: 'Evento finalizado', nombre,
      cuerpoHtml: `
        ${parrafo('El siguiente evento en el que participaste ha <strong>finalizado</strong>.')}
        ${destacado({ label: null, lineas: [eventoTitulo], acento: PALETA.purple, bg: PALETA.cream })}
      `,
    }),
  });
};

// Finalización — lado CLUB (lista los atletas propios que participaron)
export const sendConvocatoriaFinalizadaClubEmail = async ({ to, clubNombre, disciplina, categoria, eventoTitulo, atletas }) => {
  await sendEmail({
    to,
    subject: `Convocatoria finalizada: ${disciplina} - ${categoria}`,
    htmlContent: wrapperEmailIVD({
      emoji: '🏁', tituloEtiqueta: 'Convocatoria finalizada', nombre: clubNombre,
      cuerpoHtml: `
        ${parrafo('La siguiente convocatoria, en la que participaron atletas de tu club, ha <strong>finalizado</strong>.')}
        ${destacado({ label: 'Convocatoria', lineas: [`${disciplina} — ${categoria}`, `Evento: ${eventoTitulo}`], acento: PALETA.purple, bg: PALETA.cream })}
        ${parrafo('Atletas de tu club que participaron:')}
        ${listaAtletasHtml(atletas)}
      `,
    }),
  });
};

export const sendEventoFinalizadoClubEmail = async ({ to, clubNombre, eventoTitulo, atletas }) => {
  await sendEmail({
    to,
    subject: `Evento finalizado: ${eventoTitulo}`,
    htmlContent: wrapperEmailIVD({
      emoji: '🏁', tituloEtiqueta: 'Evento finalizado', nombre: clubNombre,
      cuerpoHtml: `
        ${parrafo('El siguiente evento, en el que participaron atletas de tu club, ha <strong>finalizado</strong>.')}
        ${destacado({ label: null, lineas: [eventoTitulo], acento: PALETA.purple, bg: PALETA.cream })}
        ${parrafo('Atletas de tu club que participaron:')}
        ${listaAtletasHtml(atletas)}
      `,
    }),
  });
};


// Resultados publicados — ATLETA y CLUB
export const sendResultadosPublicadosEmail = async ({ to, nombre, disciplina, categoria, eventoTitulo }) => {
  await sendEmail({
    to,
    subject: `Ya están los resultados: ${disciplina} - ${categoria}`,
    htmlContent: wrapperEmailIVD({
      emoji: '🏆', tituloEtiqueta: 'Resultados publicados', nombre, acento: PALETA.verde,
      cuerpoHtml: `
        ${parrafo('Ya se publicaron los resultados oficiales de la convocatoria en la que participaste.')}
        ${destacado({ label: 'Convocatoria', lineas: [`${disciplina} — ${categoria}`, `Evento: ${eventoTitulo}`], acento: PALETA.verde, bg: PALETA.verdeSoft })}
        ${parrafo('Inicia sesión en la plataforma para ver tu lugar y descargar el Excel de resultados.')}
      `,
    }),
  });
};

export const sendResultadosPublicadosClubEmail = async ({ to, clubNombre, disciplina, categoria, eventoTitulo, atletas }) => {
  await sendEmail({
    to,
    subject: `Ya están los resultados: ${disciplina} - ${categoria}`,
    htmlContent: wrapperEmailIVD({
      emoji: '🏆', tituloEtiqueta: 'Resultados publicados', nombre: clubNombre, acento: PALETA.verde,
      cuerpoHtml: `
        ${parrafo('Ya se publicaron los resultados oficiales de una convocatoria en la que participaron atletas de tu club.')}
        ${destacado({ label: 'Convocatoria', lineas: [`${disciplina} — ${categoria}`, `Evento: ${eventoTitulo}`], acento: PALETA.verde, bg: PALETA.verdeSoft })}
        ${parrafo('Resultados publicados para:')}
        ${listaAtletasHtml(atletas)}
      `,
    }),
  });
};