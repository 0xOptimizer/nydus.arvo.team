import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/auth";
import TopBar from "@/components/TopBar";
import DashboardSidebar from "@/components/DashboardSidebar";
import { SidebarProvider } from "@/context/SidebarContext";

export const metadata: Metadata = {
  title: "Nydus | Arvo",
  description: "Arvo's Deployment Manager",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className="h-full flex flex-col bg-background text-foreground antialiased dark overflow-hidden">
        {!session ? (
          <div className="h-full overflow-auto">
            {children}
          </div>
        ) : (
          <>
            <SidebarProvider>
              <div className="flex flex-col h-screen overflow-hidden bg-background">
                <div className="flex-none">
                  <TopBar />
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                  <DashboardSidebar />
                  <main className="flex-1 overflow-y-auto p-8 w-full overflow-x-hidden">
                    {children}
                  </main>
                </div>

              </div>
            </SidebarProvider>
          </>
        )}
      </body>
    </html>
  );
}