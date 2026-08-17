// netlify/functions/kommo-encuesta-whatsapp.js
//
// Busca en Kommo el Lead asociado a un número de teléfono y lo MUEVE a la
// etapa "Encuesta Pendiente" dentro de su mismo pipeline — un Salesbot
// armado DENTRO de Kommo (configuración manual, no código) detecta ese
// cambio de etapa y manda el mensaje de WhatsApp real.
//
// NOTA (14/8/2026): originalmente esto iba a hacerse con una ETIQUETA, pero
// el disparador de Salesbot "cuando se añade una etiqueta" es una función
// Pro de Kommo (de pago) — se cambió a "mover a una etapa del pipeline",
// que sí está disponible en el plan actual, sin costo extra.
//
// Variables de entorno necesarias en Netlify (Site settings → Environment
// variables) — NUNCA hardcodeadas acá:
//   KOMMO_SUBDOMAIN      → "crisdelgado21" (sin ".kommo.com")
//   KOMMO_ACCESS_TOKEN   → el token de larga duración generado en
//                           Kommo → Ajustes → Integraciones → tu
//                           integración → "Llaves y alcances"

const NOMBRE_ETAPA_ENCUESTA = "Encuesta Pendiente";

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
    const { telefono, nombreTitular } = JSON.parse(event.body || "{}");
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

    // Busca, dentro del pipeline al que pertenece ESTE lead, la etapa
    // llamada "Encuesta Pendiente" — se resuelve el ID dinámicamente en
    // cada llamada (en vez de guardarlo fijo) para no romperse si alguien
    // reordena o recrea las etapas más adelante.
    const respuestaPipeline = await fetch(`${baseUrl}/leads/pipelines/${lead.pipeline_id}`, { headers });
    const dataPipeline = await respuestaPipeline.json();
    const etapas = dataPipeline?._embedded?.statuses || [];
    const etapaEncuesta = etapas.find(
      s => (s.name || "").trim().toLowerCase() === NOMBRE_ETAPA_ENCUESTA.toLowerCase()
    );

    if (!etapaEncuesta) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: `No existe una etapa llamada "${NOMBRE_ETAPA_ENCUESTA}" en el pipeline de este Lead (${dataPipeline?.name || lead.pipeline_id}). Creala en Kommo con ese nombre exacto.`
        })
      };
    }

    if (lead.status_id === etapaEncuesta.id) {
      // Ya estaba en esa etapa — igual actualiza el nombre por si cambió,
      // pero no hace falta mover nada ni disparar el bot de nuevo.
      if (nombreTitular) {
        await fetch(`${baseUrl}/leads/${lead.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ name: nombreTitular })
        });
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true, leadId: lead.id, yaEstabaEnEtapa: true }) };
    }

    // NUEVO (17/8/2026): antes de mover el Lead (lo que dispara el
    // Salesbot), se actualiza también su NOMBRE con el nombreTitular real
    // de la reserva — así, si adentro de Kommo el mensaje usa la variable
    // "Nombre del lead", sale el nombre correcto que capturó el sistema,
    // en vez de lo que el cliente haya puesto (o no puesto) en WhatsApp.
    const datosActualizacion = { status_id: etapaEncuesta.id };
    if (nombreTitular) datosActualizacion.name = nombreTitular;

    const respuestaActualizacion = await fetch(`${baseUrl}/leads/${lead.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(datosActualizacion)
    });

    if (!respuestaActualizacion.ok) {
      const errorKommo = await respuestaActualizacion.json().catch(() => ({}));
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Kommo rechazó mover el Lead: ${JSON.stringify(errorKommo)}` })
      };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, leadId: lead.id, yaEstabaEnEtapa: false }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || String(error) }) };
  }
};
