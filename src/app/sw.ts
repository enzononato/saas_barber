import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Tiles/glyphs/sprites do mapa (Carto/MapLibre) vão direto à rede.
    // O cache cross-origin padrão do Serwist limita a 32 entradas, o que faz
    // o mapa (dezenas de requisições) ficar em thrashing e não renderizar.
    {
      matcher: ({ url }) =>
        url.hostname.endsWith("cartocdn.com") ||
        url.hostname.endsWith("basemaps.cartocdn.com"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// --- Push notifications ---

type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

self.addEventListener("push", (event: PushEvent) => {
  let data: PushPayload = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() ?? "" };
  }

  const title = data.title ?? "Santos Studios";
  const options: NotificationOptions = {
    body: data.body ?? "Você tem uma nova notificação",
    icon: "/icons/192",
    badge: "/icons/192",
    tag: data.tag,
    data: { url: data.url ?? "/gstsantos/agenda" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string } | null)?.url ?? "/gstsantos/agenda";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Tenta focar uma janela já aberta na URL alvo
      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.pathname.startsWith(targetUrl) && "focus" in client) {
            return (client as WindowClient).focus();
          }
        } catch {
          // ignore URL parse errors
        }
      }
      // Senão, abre nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
