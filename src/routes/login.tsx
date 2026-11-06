import { createFileRoute } from "@tanstack/react-router";
import { RobotHero, settings } from "@/components/ui/robot-hero";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    return {
      redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Terminal Login — Global Maritime Port Monitor" },
      {
        name: "description",
        content: "Sign in to the Global Maritime AIS Operations Console with 3D Robot Sentry.",
      },
    ],
  }),
  component: LoginPage,
});

export default function LoginPage(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#070b13]">
      <RobotHero {...s} />
    </div>
  );
}
