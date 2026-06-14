"use client";

import { use } from "react";
import { LobbyRoom } from "@/components/LobbyRoom";

export default function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return <LobbyRoom code={code} />;
}
