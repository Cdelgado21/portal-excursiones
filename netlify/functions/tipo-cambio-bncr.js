// netlify/functions/tipo-cambio-bncr.js
//
// Consulta el tipo de cambio de VENTA del Banco Nacional de Costa Rica.
//
// CAMBIO DE FUENTE (14/9/2026): antes se leía directo de la página oficial
// del BCCR (gee.bccr.fi.cr/.../frmConsultaTCVentanilla.aspx), pero esa
// página empezó a devolver error 404 a cualquier petición automatizada
// (aunque seguía funcionando perfecto para cualquiera que la visitara desde
// un navegador normal) — es un patrón típico de sitios de bancos/gobierno
// que bloquean pedidos que no traen pinta de venir de un navegador real.
// Se probó agregar cabeceras de navegador (User-Agent, Accept, etc.) y
// aun así seguía fallando, así que se cambió a esta fuente alternativa:
// tipodecambio.info, un sitio que publica los MISMOS datos (toma la
// información de las mismas entidades autorizadas que reporta el BCCR),
// pero en una página simple que sí responde bien a peticiones automáticas.
//
// URL fuente: https://www.tipodecambio.info/ventanilla.php?lang=es
//
// ADVERTENCIA IMPORTANTE: esto sigue funcionando leyendo el HTML de una
// página pensada para personas, no una API pensada para consumirse por
// código — si ese sitio cambia de diseño en el futuro, esta función puede
// dejar de encontrar la fila del Banco Nacional y empezar a fallar. Si eso
// pasa, hay que volver a revisar cómo quedó la página y ajustar la
// búsqueda de texto de acá abajo (o buscar otra fuente alternativa).

exports.handler = async function () {
  try {
    const url = "https://www.tipodecambio.info/ventanilla.php?lang=es";
    const respuesta = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-CR,es;q=0.9,en;q=0.8"
      }
    });

    if (!respuesta.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `tipodecambio.info respondió con error (HTTP ${respuesta.status}) al consultar el tipo de cambio.` })
      };
    }

    const html = await respuesta.text();

    // Convierte todo el HTML a texto plano (sin etiquetas), para no
    // depender de la estructura exacta de la tabla — así, aunque cambien
    // el diseño visual, mientras el texto "Banco Nacional de Costa Rica"
    // siga apareciendo seguido de los dos montos, esto sigue funcionando.
    const texto = html
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ");

    // Busca "Banco Nacional de Costa Rica" seguido de dos montos — en esta
    // fuente vienen con el símbolo ₡ y punto decimal (ej. "₡440.00" y
    // "₡454.00"), a diferencia del formato con coma que usaba la página
    // del BCCR. El primero es Compra, el segundo es Venta, en ese orden.
    const coincidencia = texto.match(/Banco Nacional de Costa Rica[^\d]*?₡?\s*([\d]{1,3}[.,]\d{2})[^\d]*?₡?\s*([\d]{1,3}[.,]\d{2})/i);

    if (!coincidencia) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "No se pudo encontrar la fila de Banco Nacional en tipodecambio.info — puede que hayan cambiado el formato de esa página." })
      };
    }

    const compra = parseFloat(coincidencia[1].replace(",", "."));
    const venta = parseFloat(coincidencia[2].replace(",", "."));

    if (isNaN(compra) || isNaN(venta) || venta <= 0) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "El dato encontrado no parece un tipo de cambio válido." })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        compra,
        venta,
        fuente: "tipodecambio.info (datos de entidades autorizadas por el BCCR) — Banco Nacional de Costa Rica",
        consultadoEl: new Date().toISOString()
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || String(error) }) };
  }
};
