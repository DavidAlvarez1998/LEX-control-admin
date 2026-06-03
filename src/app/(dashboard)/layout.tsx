import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { FeedbackProvider } from "@/components/feedback";
import { AuthGuard } from "@/components/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <FeedbackProvider>
        <div className="flex h-screen overflow-hidden bg-slate-50">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </FeedbackProvider>
    </AuthGuard>
  );
}
