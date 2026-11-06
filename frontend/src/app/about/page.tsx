import type { Metadata } from "next";
import { AboutContent } from "@/components/AboutContent";

export const metadata: Metadata = {
  title: "About · NY grid congestion",
  description: "The question, data, method, tech stack and limits behind the NY grid congestion dashboard.",
};

export default function AboutPage() {
  return <AboutContent />;
}
