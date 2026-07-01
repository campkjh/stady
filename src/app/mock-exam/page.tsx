import Link from "next/link";
import BackHeader from "@/components/BackHeader";
import { listMockExams } from "@/lib/mockExam";

export const dynamic = "force-dynamic";

export default async function MockExamListPage() {
  const exams = await listMockExams(true);

  return (
    <div style={{ width: "100%", minHeight: "100vh", backgroundColor: "#fff" }}>
      <BackHeader title="모의고사" />
      <p style={{ padding: "12px 20px 0", margin: 0, fontSize: 13, color: "#8A909C" }}>
        태블릿에서 애플펜슬로 필기하며 풀어보세요. 펜 · 형광펜 · OCR 지원.
      </p>
      {exams.length === 0 ? (
        <p style={{ padding: "40px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
          등록된 모의고사가 없습니다.
        </p>
      ) : (
        <div style={{ padding: "16px 16px 40px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
          {exams.map((ex) => (
            <Link
              key={ex.id}
              href={`/mock-exam/${ex.id}`}
              className="hover-lift"
              style={{ textDecoration: "none", display: "block" }}
            >
              <div style={{ aspectRatio: "3 / 4", borderRadius: 14, overflow: "hidden", border: "1px solid #EEF0F3", background: "#F3F4F6", boxShadow: "0 4px 14px rgba(15,23,42,0.06)" }}>
                {ex.imageUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ex.imageUrls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#B0B8C1", fontSize: 30 }}>📄</div>
                )}
              </div>
              <p style={{ margin: "8px 2px 0", fontSize: 14, fontWeight: 700, color: "#191F28", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.title}</p>
              <p style={{ margin: "2px 2px 0", fontSize: 12, color: "#8A909C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ex.subtitle || `${ex.imageUrls.length}페이지`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
