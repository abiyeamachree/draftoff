"use client";

import { use } from "react";
import { DraftRoom } from "@/components/DraftRoom";

export default function DraftPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return <DraftRoom code={code} />;
}
