import { AppShell } from "@/components/app-shell";

export default function TutorLayout({ children }: LayoutProps<"/tutor">) {
  return <AppShell role="tutor">{children}</AppShell>;
}
