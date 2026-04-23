import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { getCodingPlatformUrl } from "@/lib/coding-platform";

export const metadata: Metadata = {
  title: "Coding practice",
  description: "LeetCode-style coding challenges",
};

export default function CodingPage() {
  const codingUrl = getCodingPlatformUrl();

  return (
    <section className="flex flex-col gap-4 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Coding challenges</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
      <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-sm min-h-[calc(100vh-14rem)] w-full">
        <iframe
          title="Coding platform"
          src={codingUrl}
          className="w-full h-[calc(100vh-14rem)] min-h-[480px] border-0 bg-background"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </section>
  );
}