import { Suspense } from "react";
import Onboarding from "./Onboarding";

export default function StartPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
