import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SenFoot — Football sénégalais en direct",
    short_name: "SenFoot",
    description: "Scores en direct, résultats, classements et actualités du football sénégalais.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#00853F",
    lang: "fr",
    categories: ["sports", "news"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Matchs en direct", url: "/matchs?vue=direct" },
      { name: "Classement Ligue 1", url: "/competitions/ligue-1" },
    ],
  };
}
