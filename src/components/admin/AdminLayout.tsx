import { ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: "#F9FAFB" }}>
      <aside style={{ background: "#1E1F23", padding: 20 }}>
        <AdminSidebar />
      </aside>
      <main style={{ minWidth: 0, padding: 24 }}>{children}</main>
    </div>
  );
}
