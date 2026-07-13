import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Clapperboard,
  Users,
  ShieldCheck,
  BarChart3,
  Link2,
  Search,
  ArrowRight,
} from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

const FEATURES = [
  {
    icon: Users,
    title: "Team groups",
    desc: "Register your team, list members, and keep every social profile in one place.",
  },
  {
    icon: Link2,
    title: "Video links",
    desc: "Add YouTube, TikTok, Instagram, Facebook & more with automatic platform detection.",
  },
  {
    icon: ShieldCheck,
    title: "URL validation",
    desc: "Every link is checked for format and matched to a known platform instantly.",
  },
  {
    icon: BarChart3,
    title: "Admin analytics",
    desc: "Charts for platform distribution, videos per group, and overall activity.",
  },
  {
    icon: Search,
    title: "Search & filter",
    desc: "Find any video by team, platform, or status in seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    desc: "Members manage their own group; admins get full control over everything.",
  },
];

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Clapperboard className="size-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Reel<span className="text-primary">Hub</span>
          </span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="bg-grid">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Collaborative video content management
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
              Every team's <span className="text-gradient">video</span>, organized.
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              ReelHub gives student teams one home for their social profiles and
              video links — with validation, search, and a powerful admin
              dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Get started <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">I have an account</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-primary/20 blur-3xl" />
            <img
              src={heroImg}
              alt="ReelHub dashboard preview showing video thumbnails and analytics charts"
              className="relative rounded-2xl border border-border shadow-glow"
              width={1280}
              height={960}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">Everything your team needs</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Built for creative student teams and the admins who keep them on track.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <h2 className="text-3xl font-bold">Ready to organize your reels?</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Create your team group and start adding video links in minutes.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/auth">
              Create your account <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ReelHub. A college project demo.
        </div>
      </footer>
    </div>
  );
}
