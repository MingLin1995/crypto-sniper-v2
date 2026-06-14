"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push("/profile");
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-zinc-950">
      <div className="text-zinc-400 animate-pulse text-sm">正在跳轉...</div>
    </div>
  );
}
