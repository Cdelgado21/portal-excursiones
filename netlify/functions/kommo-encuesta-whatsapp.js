// netlify/functions/kommo-encuesta-whatsapp.js
//
// Busca en Kommo el Lead asociado a un número de teléfono y le agrega la
// etiqueta "Encuesta Pendiente" — un Salesbot armado DENTRO de Kommo
// (configuración manual, no código) detecta esa etiqueta y manda el
// mensaje de WhatsApp real, porque el token de la API de CRM no puede
// mandar mensajes directo a un WhatsApp conectado como dispositivo
// adicional (solo a través del Salesbot).
//
// Variables de entorno necesarias en Netlify (Site settings → Environment
// variables) — NUNCA hardcodeadas acá:
//   KOMMO_SUBDOMAIN      → "crisdelgado21" (sin ".kommo.com")
//   KOMMO_ACCESS_TOKEN   → el token de larga duración generado en
//                           Kommo → Ajustes → Integraciones → tu
//                           integración → "Llaves y alcances"

const ETIQUETA_ENCUESTA = "Encuesta Pendiente";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Método no permitido, usa POST." }) };
  }

  const subdominio = process.env.KOMMO_SUBDOMAIN;
  const token = process.env.KOMMO_ACCESS_TOKEN;

  if (!subdominio || !token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Faltan las variables de entorno KOMMO_SUBDOMAIN o KOMMO_ACCESS_TOKEN en Netlify." })
    };
  }

  try {
    const { telefono } = JSON.parse(event.body || "{}");
    if (!telefono) {
      return { statusCode: 400, body: JSON.stringify({ error: "Falta el teléfono." }) };
    }

    const baseUrl = `https://${subdominio}.kommo.com/api/v4`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    // Busca el Lead por teléfono — Kommo también busca dentro de los
    // contactos vinculados al Lead, así que un teléfono guardado en el
    // Contacto igual encuentra el Lead asociado.
    const respuestaBusqueda = await fetch(
      `${baseUrl}/leads?query=${encodeURIComponent(telefono)}&with=contacts`,
      { headers }
    );
    const resultadoBusqueda = await respuestaBusqueda.json();

    const leads = resultadoBusqueda?._embedded?.leads || [];
    if (leads.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `No se encontró ningún Lead en Kommo con el teléfono ${telefono}.` })
      };
    }

    // Si hay varios Leads para el mismo número (ej. varias reservas a lo
    // largo del tiempo), se marca el primero que devuelve Kommo.
    const lead = leads[0];
    const tagsActuales = lead._embedded?.tags || [];
    const yaTieneEtiqueta = tagsActuales.some(t => t.name === ETIQUETA_ENCUESTA);

    if (!yaTieneEtiqueta) {
      // Al actualizar _embedded.tags, Kommo REEMPLAZA la lista completa —
      // por eso se manda la lista existente + la nueva, no solo la nueva.
      const nuevasTags = [...tagsActuales.map(t => ({ id: t.id })), { name: ETIQUETA_ENCUESTA }];

      const respuestaActualizacion = await fetch(`${baseUrl}/leads/${lead.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ _embedded: { tags: nuevasTags } })
      });

      if (!respuestaActualizacion.ok) {
        const errorKommo = await respuestaActualizacion.json().catch(() => ({}));
        return {
          statusCode: 502,
          body: JSON.stringify({ error: `Kommo rechazó la actualización del Lead: ${JSON.stringify(errorKommo)}` })
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, leadId: lead.id, yaEstabaMarcado: yaTieneEtiqueta })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || String(error) }) };
  }
};
