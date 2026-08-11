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
// A diferencia del Worker viejo (que siempre devolvía 200 "OK" sin
// importar el resultado real), esta función reenvía el status y el texto
// REAL de la respuesta del Apps Script, para poder detectar fallos de
// verdad del lado del cliente.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzhl4MboE_QEQySeRSdwaA4ycbdCv1BtV4Z_c0ggXTAVAfPei2ToyYNLjaweUcDkJ6A/exec";

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
