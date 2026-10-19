import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Next Steps.IO",
    short_name: "Next Steps",
    description: "Voice-first life-transition coach with Peaches.",
    start_url: "/home",
    display: "standalone",
    background_color: "#9fb59b",
    theme_color: "#9fb59b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
