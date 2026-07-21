// netlify/functions/comprobante-correo.js
//
// Reemplaza al Worker de Cloudflare para el envío del comprobante por correo.
// Esta función vive DENTRO del mismo sitio de Netlify
// (portalexcursionesdelgado.netlify.app / excursionesdelgado.com), así que
// cuando detalle_reserva.html la llama, es una petición al MISMO dominio —
// no hay problema de CORS, y no depende de dominios externos como
// *.workers.dev que algunas redes de oficina bloquean por reglas genéricas
// de seguridad.
//
// Su único trabajo es recibir la petición del navegador y reenviarla tal
// cual al Apps Script que realmente envía el correo con el PDF adjunto.

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzkTFaDh6_qukeYPDGpNpODbcv6J2z7HyjXec6v3FbRkho9VIfMN1yZ14NDeJLuCLL3fg/exec";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Método no permitido, usa POST." })
    };
  }

  try {
    const respuestaAppsScript = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: event.body,
      redirect: "follow"
    });

    const texto = await respuestaAppsScript.text();

    return {
      statusCode: respuestaAppsScript.status,
      headers: { "Content-Type": "application/json" },
      body: texto
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message || String(error) })
    };
  }
};
