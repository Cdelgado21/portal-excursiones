// netlify/functions/correo-cotizaciones.js
//
// Reemplaza al Worker de Cloudflare (correo-cotizaciones.cris-delgado21.workers.dev)
// para el envío de avisos de nueva solicitud de cotización, tanto el
// correo fijo hardcodeado de solicitud_cotizaciones.html como el dinámico
// de enviarCorreoAdmins() en topbar.js. Vive DENTRO del mismo sitio de
// Netlify (portalexcursionesdelgado.netlify.app / excursionesdelgado.com),
// así que la petición del navegador es al MISMO dominio — sin depender de
// *.workers.dev, que algunas redes/antivirus bloquean.
//
// APPS_SCRIPT_URL apunta a Code_CorreoCotizaciones.gs, bajo
// boletosexcursionesdelgado@gmail.com (11/8/2026) — reemplaza al script
// viejo "Notificación Solitud Cotización" (bajo cris.delgado21@gmail.com),
// que quedó sin autorizar correctamente y todas sus ejecuciones fallaban
// desde antes de esta migración.
//
// A diferencia del Worker viejo (que siempre devolvía 200 "OK" sin
// importar el resultado real), esta función reenvía el status y el texto
// REAL de la respuesta del Apps Script, para poder detectar fallos de
// verdad del lado del cliente.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxlnEcMjQgjseBYySGmxPz_lDk6q2CzsIfn-aemG7NzwCYmW7_0ZFDe9c95gxZv3ls8/exec";

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
