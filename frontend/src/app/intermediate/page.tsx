import type { Metadata } from "next";
import { IntermediateDashboard } from "@/components/intermediate/IntermediateDashboard";

export const metadata: Metadata = {
  title: "When · NY grid congestion",
  description: "When New York grid congestion is heaviest: by month, season, hour of day, weekday and worst days.",
};

export default function IntermediatePage() {
  return <IntermediateDashboard />;
}
