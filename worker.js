export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let path = url.pathname;

    if (path === "/") {
      path = "/index.html";
    }

    try {
      const asset = await env.ASSETS.fetch(new Request(`https://fakehost${path}`, request));
      if (asset.status === 404) {
        return new Response("Archivo no encontrado", { status: 404 });
      }
      return asset;
    } catch (err) {
      return new Response("Error al cargar el recurso", { status: 500 });
    }
  },
};
