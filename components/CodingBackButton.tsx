"use client";

import { Button } from "@/components/ui/button";

export function CodingBackButton() {
  return (
    <Button
      variant="outline"
      className="border-white/15 text-white hover:bg-white/10"
      onClick={() => {
        window.location.assign("/");
      }}
    >
      Back to dashboard
    </Button>
  );
}
