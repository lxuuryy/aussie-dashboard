import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-muted p-4 border-r">
      <h2 className="text-lg font-semibold mb-4">Dashboard</h2>
      <nav className="space-y-2">
        <Button variant="ghost" className="w-full justify-start" asChild>
          <Link href="/dashboard">Overview</Link>
        </Button>
        <Button variant="ghost" className="w-full justify-start" asChild>
          <Link href="/dashboard/analytics">Analytics</Link>
        </Button>
        <Button variant="ghost" className="w-full justify-start" asChild>
          <Link href="/dashboard/settings">Settings</Link>
        </Button>
      </nav>
    </aside>
  );
}