"use client";

import { LobbyRoom } from "@/components/LobbyRoom";

export default function LobbyPage({ params }: { params: { code: string } }) {
  return <LobbyRoom code={params.code.toUpperCase()} />;
}
