"use client";

import { ResultsView } from "@/components/ResultsView";

export default function ResultsPage({ params }: { params: { code: string } }) {
  return <ResultsView code={params.code.toUpperCase()} />;
}
