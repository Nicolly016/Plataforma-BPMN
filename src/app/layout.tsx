import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Processos BPMN",
    template: "%s · Processos BPMN",
  },
  description: "Modelagem, documentação e gerenciamento de processos em BPMN 2.0.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
