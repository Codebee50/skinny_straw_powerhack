import type { Metadata } from "next";
import { AdvancedDashboard } from "@/components/advanced/AdvancedDashboard";

export const metadata: Metadata = {
  title: "Moses South · NY grid congestion",
  description: "Moses South interface flow out of the North Country, and how it moves with zonal congestion.",
};

export default function AdvancedPage() {
  return <AdvancedDashboard />;
}
