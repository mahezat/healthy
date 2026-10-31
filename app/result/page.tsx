import { Suspense } from "react";
import { ResultScreen } from "@/components/result-screen";

export default function ResultPage() {
  return (
    <Suspense>
      <ResultScreen />
    </Suspense>
  );
}
