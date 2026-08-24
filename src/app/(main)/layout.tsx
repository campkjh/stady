import BottomNav from "@/components/BottomNav";
import PageTransition from "@/components/PageTransition";
import TimerPinger from "@/components/TimerPinger";
import PageViewTracker from "@/components/PageViewTracker";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="min-h-screen main-content-wrap" style={{ paddingBottom: "calc(82px + env(safe-area-inset-bottom, 0px))", width: "100%", overflowX: "clip" }}>
        <div className="app-shell">
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
      <BottomNav />
      <TimerPinger />
      <PageViewTracker />
    </>
  );
}
