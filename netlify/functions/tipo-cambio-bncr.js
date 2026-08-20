// netlify/functions/tipo-cambio-bncr.js
//
// Consulta el tipo de cambio de VENTA del Banco Nacional de Costa Rica,
// tomado de la página pública y oficial del Banco Central de Costa Rica
// (BCCR) — "Tipo de Cambio de Ventanilla", que publica el tipo de cada
// banco/entidad autorizada, no solo el de referencia del BCCR.
//
// Se usa esta página en vez del Servicio Web de Indicadores Económicos del
// BCCR porque ese otro requiere registrarse con correo y token — esta
// página es pública, no necesita autenticación.
//
// URL fuente: https://gee.bccr.fi.cr/IndicadoresEconomicos/Cuadros/frmConsultaTCVentanilla.aspx
//
// ADVERTENCIA IMPORTANTE: esto funciona leyendo el HTML de una página del
// BCCR, no una API pensada para consumirse por código — si el BCCR cambia
// el diseño de esa página en el futuro, esta función puede dejar de
// encontrar la fila del Banco Nacional y empezar a fallar. Si eso pasa,
// hay que volver a revisar cómo quedó la página y ajustar la búsqueda de
// texto de acá abajo.

exports.handler = async function () {
  try {
    const url = "https://gee.bccr.fi.cr/IndicadoresEconomicos/Cuadros/frmConsultaTCVentanilla.aspx";
    const respuesta = await fetch(url);

    if (!respuesta.ok) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `El BCCR respondió con error (HTTP ${respuesta.status}) al consultar el tipo de cambio.` })
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

    // Busca "Banco Nacional de Costa Rica" seguido de dos montos con coma
    // decimal (formato costarricense, ej. "444,00" y "458,00") — el
    // primero es Compra, el segundo es Venta, en ese orden en la tabla.
    const coincidencia = texto.match(/Banco Nacional de Costa Rica\s*([\d]{1,3}[.,]\d{2})\s*([\d]{1,3}[.,]\d{2})/i);

    if (!coincidencia) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "No se pudo encontrar la fila de Banco Nacional en la página del BCCR — puede que hayan cambiado el formato de esa página." })
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
        fuente: "BCCR — Tipo de Cambio de Ventanilla, Banco Nacional de Costa Rica",
        consultadoEl: new Date().toISOString()
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || String(error) }) };
  }
};
