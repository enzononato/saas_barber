import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Santos Studios",
    short_name: "Santos",
    description: "Painel administrativo da Barbearia Santos Studios",
    start_url: "/gstsantos/agenda",
    display: "standalone",
    background_color: "#0B0B0B",
    theme_color: "#C9A84C",
    orientation: "portrait",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/icons/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
