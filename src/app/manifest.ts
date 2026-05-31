import type { MetadataRoute } from "next";

// Web App Manifest (PWA)。ホーム画面追加と standalone 起動を有効化する。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Topos — 場の重力をつくるSNS",
    short_name: "Topos",
    description:
      "フォロワー数ではなく、場への寄与で評価される実験的SNS。澱む発言は重力で沈み、流れを作る発言が浮かぶ。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f3ee",
    theme_color: "#2f7d79",
    lang: "ja",
    categories: ["social", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
