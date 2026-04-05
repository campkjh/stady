import BottomNav from "@/components/BottomNav";
import PageTransition from "@/components/PageTransition";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="min-h-screen" style={{ paddingBottom: "calc(82px + env(safe-area-inset-bottom, 0px))", width: "100%", overflowX: "hidden" }}>
        <PageTransition>{children}</PageTransition>
      </div>
      <BottomNav />
    </>
  );
}
