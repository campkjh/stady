import { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: "var(--c-bg-soft)" }}>
      <aside style={{ background: "var(--c-inverse-4)", padding: 20 }}>
        <AdminSidebar />
      </aside>
      <main style={{ minWidth: 0, padding: 24 }}>{children}</main>
    </div>
  );
}
