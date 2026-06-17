export default function AdminCommentsPage() {
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, color: "#111827", fontSize: 26, fontWeight: 900 }}>댓글 관리</h1>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", padding: 20 }}>
        <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>커뮤니티 댓글 관리 화면입니다. 댓글 데이터가 생성되면 이 메뉴에서 노출/비노출 처리 흐름을 확장할 수 있습니다.</p>
      </div>
    </section>
  );
}
