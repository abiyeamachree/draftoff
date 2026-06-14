"use client";

import { use } from "react";
import { ResultsView } from "@/components/ResultsView";

export default function ResultsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return <ResultsView code={code} />;
}
