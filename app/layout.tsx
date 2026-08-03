// 文件路径: app/layout.tsx (或 src/app/layout.tsx)
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // 👈 1. 导入 Inter 字体
import Navbar from "@/components/Navbar"; // 确保你的导航栏导入路径正确

// 2. 配置 Inter 字体
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LifeOS",
  description: "Your personal operating system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      {/* 3. 将 className 换成 inter.className */}
      <body className={inter.className}>
        <Navbar />
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}