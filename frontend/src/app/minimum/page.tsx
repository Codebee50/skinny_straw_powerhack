import type { Metadata } from "next";
import { MinimumDashboard } from "@/components/minimum/MinimumDashboard";

export const metadata: Metadata = {
  title: "Where · NY grid congestion",
  description: "Which New York zones pay the most for electricity, and where congestion raises prices.",
};

export default function MinimumPage() {
  return <MinimumDashboard />;
}
