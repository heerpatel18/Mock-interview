/** Base URL for the Vite coding app (leetc/coding-platform). Override in .env.local for production. */
export function getCodingPlatformUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CODING_PLATFORM_URL ?? "http://localhost:5176"
  );
}