"use client";

import { DraftRoom } from "@/components/DraftRoom";

export default function DraftPage({ params }: { params: { code: string } }) {
  return <DraftRoom code={params.code.toUpperCase()} />;
}
