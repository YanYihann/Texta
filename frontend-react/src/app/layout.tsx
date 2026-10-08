import type { Metadata } from "next";
import "../../../public/workspace.css";
import "../../../public/controls.css";
import "../../../public/vocabulary.css";
import "../../../public/legal.css";
import "../../../public/billing.css";
import "./globals.css";
import { TextaProvider } from "@/components/texta/provider";

export const metadata: Metadata = {
  title: { default: "Texta · 登录", template: "Texta · %s" },
  description: "把英语词汇变成双语学习文章，阅读、理解并复习你的目标词汇。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{let p=localStorage.getItem('texta_theme_preference')||'light';document.documentElement.dataset.theme=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p}catch{}`,
          }}
        />
      </head>
      <body>
        <TextaProvider>{children}</TextaProvider>
      </body>
    </html>
  );
}
