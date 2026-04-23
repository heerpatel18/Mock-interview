"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/actions/auth.action";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Button 
      onClick={handleLogout}
      variant="outline"
      className="btn-secondary"
    >
      Logout
    </Button>
  );
}
