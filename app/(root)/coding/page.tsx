import type { Metadata } from "next";
import { getCodingPlatformUrl } from "@/lib/coding-platform";
import { CodingBackButton } from "@/components/CodingBackButton";

export const metadata: Metadata = {
  title: "Coding practice",
  description: "LeetCode-style coding challenges",
};

export default function CodingPage() {
  const codingUrl = getCodingPlatformUrl();

  return (
    <section className="flex min-h-[calc(100vh-7rem)] w-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-2 backdrop-blur">
        <span className="text-sm text-gray-300">Coding Environment</span>

        <CodingBackButton />
      </div>

      <div className="flex-1 w-full overflow-hidden">
        <iframe
          title="Coding platform"
          src={codingUrl}
          className="h-full min-h-[720px] w-full border-0"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </section>
  );
}
