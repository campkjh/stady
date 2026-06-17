export default function AdminReportsPage() {
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, color: "#111827", fontSize: 26, fontWeight: 900 }}>신고 관리</h1>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", padding: 20 }}>
        <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>커뮤니티 신고 접수와 처리 상태를 관리하는 메뉴입니다. 신고 API가 연결되면 접수/처리/보류 상태를 이 화면에서 관리합니다.</p>
      </div>
    </section>
  );
}
