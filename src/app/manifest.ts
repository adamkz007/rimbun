import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rimbun — Clinic OS",
    short_name: "Rimbun",
    description:
      "Calm, modern clinic management for general practice teams, with a clerking workspace built for real consultations.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F7F8F5",
    theme_color: "#12382A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
