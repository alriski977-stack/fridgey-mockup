import Sidebar from "@/components/Sidebar";

export default function MainLayout({ children }) {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}