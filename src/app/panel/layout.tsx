import { GuardiaPanel } from "@/componentes/panel/GuardiaPanel";

export const metadata = { title: "Panel", robots: { index: false, follow: false } };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <GuardiaPanel>{children}</GuardiaPanel>;
}
