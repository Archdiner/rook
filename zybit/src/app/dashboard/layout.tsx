export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#FAFAF8] font-sans selection:bg-[#111] selection:text-[#FAFAF8]">
      {children}
    </div>
  );
}
