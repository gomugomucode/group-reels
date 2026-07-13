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
    title: "Team Collaboration",
    desc: "Register your team, list members, and keep every social profile in one place.",
  },
  {
    icon: Link2,
    title: "Video Link Management",
    desc: "Add YouTube, TikTok, Instagram, Facebook & more with automatic platform detection.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Authentication",
    desc: "Role-based access keeps your data safe — members manage their group, admins control everything.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    desc: "Charts for platform distribution, videos per group, and overall activity.",
  },
  {
    icon: Search,
    title: "Smart Search & Filter",
    desc: "Find any video by team, platform, or status in seconds.",
  },
  {
    icon: Clapperboard,
    title: "Built for BKC Students",
    desc: "Designed around academic media projects and creative teams at Butwal Kalika Campus.",
  },
];

function Landing() {
  const { session, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
    }
  }, [loading, session, isAdmin, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Clapperboard className="size-5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            BKC <span className="text-primary">Creator Hub</span>
          </span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="bg-grid" aria-label="Hero">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Official Platform — Butwal Kalika Campus
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
              Empowering Student{" "}
              <span className="text-gradient">Content Creators</span>{" "}
              at BKC
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Create, organize, collaborate, and analyze your social media video content
              in one professional platform designed exclusively for Butwal Kalika Campus students.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Get Started <ArrowRight className="ml-1 size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#features">Explore Features</a>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-primary/20 blur-3xl" aria-hidden="true" />
            <img
              src={heroImg}
              alt="BKC Creator Hub dashboard preview showing team video management and analytics"
              className="relative rounded-2xl border border-border shadow-glow"
              width={1280}
              height={960}
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* ── About ──────────────────────────────────────────── */}
      <section className="border-t border-border bg-card/50" aria-labelledby="about-heading">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 id="about-heading" className="text-3xl font-bold">About BKC Creator Hub</h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              The BKC Creator Hub is a collaborative digital platform developed for students
              of <strong>Butwal Kalika Campus</strong> to manage, organize, and monitor their
              social media content across multiple platforms. Whether you're creating educational
              videos, promotional campaigns, campus event coverage, or creative media projects,
              this platform helps teams collaborate efficiently while tracking performance and engagement.
            </p>
            <a
              href="https://btlkalikacampus.edu.np"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm text-primary underline underline-offset-4 hover:text-primary/80"
              aria-label="Visit Butwal Kalika Campus official website"
            >
              btlkalikacampus.edu.np ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-center text-3xl font-bold">Everything Your Team Needs</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Built for creative BKC student teams and the admins who keep them on track.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why Choose ─────────────────────────────────────── */}
      <section className="border-t border-border bg-card/50" aria-labelledby="why-heading">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="why-heading" className="text-center text-3xl font-bold">Why Choose BKC Creator Hub?</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
            A purpose-built platform for academic content creators at Butwal Kalika Campus.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { emoji: "🗂️", title: "Centralized Management", desc: "All your team's video links and social profiles in one organized hub." },
              { emoji: "🤝", title: "Easy Collaboration", desc: "Add members, assign roles, and work seamlessly within your group." },
              { emoji: "📈", title: "Performance Analytics", desc: "Track platform spread and content activity with real-time charts." },
              { emoji: "🔐", title: "Secure Access", desc: "Role-based authentication keeps your data safe and access controlled." },
              { emoji: "⚡", title: "Modern Dashboard", desc: "A clean, fast, and intuitive dashboard built for student workflows." },
              { emoji: "🎓", title: "Academic-First Design", desc: "Designed around the needs of campus media teams and course projects at BKC." },
            ].map(({ emoji, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary"
              >
                <span className="text-3xl" role="img" aria-label={title}>{emoji}</span>
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Statistics ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-label="Platform statistics">
        <div className="grid gap-8 rounded-3xl border border-border bg-card p-10 text-center sm:grid-cols-2 lg:grid-cols-4">
          {[
            { value: "50+", label: "Student Teams" },
            { value: "500+", label: "Videos Managed" },
            { value: "6+", label: "Platforms Supported" },
            { value: "200+", label: "Active Collaborations" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-4xl font-bold text-primary">{value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-20" aria-label="Call to action">
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <h2 className="text-3xl font-bold">Start Collaborating Today</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Join the official Butwal Kalika Campus Creator Hub and manage your
            team's content with confidence.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/auth">
              Sign Up <ArrowRight className="ml-1 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Clapperboard className="size-4" aria-hidden="true" />
                </span>
                <span className="font-display font-bold tracking-tight">
                  BKC <span className="text-primary">Creator Hub</span>
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Official collaborative video content management platform for
                Butwal Kalika Campus students.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Contact
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Butwal-10, Rupandehi, Nepal</li>
                <li>
                  <a
                    href="https://btlkalikacampus.edu.np"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary"
                  >
                    btlkalikacampus.edu.np
                  </a>
                </li>
                <li>
                  <a href="mailto:info@btlkalikacampus.edu.np" className="hover:text-primary">
                    info@btlkalikacampus.edu.np
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Quick Links
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/auth" className="hover:text-primary">Sign In</Link></li>
                <li><Link to="/auth" className="hover:text-primary">Create Account</Link></li>
                <li>
                  <a
                    href="https://btlkalikacampus.edu.np"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary"
                  >
                    Campus Website
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Butwal Kalika Campus (BKC). All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
