// netlify/functions/factura-correo.js
//
// Reemplaza al Worker de Cloudflare (proxy-correo.cris-delgado21.workers.dev)
// para el envío de la FACTURA por correo. Mismo patrón que
// comprobante-correo.js: esta función vive DENTRO del mismo sitio de Netlify
// (portalexcursionesdelgado.netlify.app / excursionesdelgado.com), así que
// cuando facturacion.html la llama, es una petición al MISMO dominio — no
// hay problema de CORS, y no depende de dominios externos como
// *.workers.dev que algunas redes de oficina bloquean por reglas genéricas
// de seguridad (confirmado: el Worker de Cloudflare daba ERR_CONNECTION_RESET
// incluso visitándolo directo, sin pasar por el sistema — bloqueo de red,
// no del código).
//
// Su único trabajo es recibir la petición del navegador y reenviarla tal
// cual al Apps Script que realmente envía el correo con el PDF adjunto.
//
// NUEVO: URL de la Apps Script de FACTURAS (distinta a la del comprobante de
// reserva) — esta es la implementación ACTIVA confirmada en "Administrar
// implementaciones" (la anterior, que tenía el Worker de Cloudflare, ya
// estaba vencida — por eso nunca aparecía ninguna ejecución en Apps Script).
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNt-dygU6QPyttyIaAT9tQQNyXGGG3xOe_WLxZfBAhLX75-RmitCKWoGXyt2qMIFrnPQ/exec";

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
