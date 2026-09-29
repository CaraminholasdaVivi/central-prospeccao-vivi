import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Central de Prospecção Vivi",
  description: "Central pessoal de organização e acompanhamento da prospecção educacional.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
