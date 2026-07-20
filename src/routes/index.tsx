import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Clapperboard,
  Users,
  ShieldCheck,
  BarChart3,
  Link2,
  Search,
  ArrowRight,
  Trophy,
  Award,
  Calendar,
  Phone,
  Mail,
  Globe,
  UserCheck,
  CheckCircle,
  HelpCircle,
  FileText,
  Volume2,
  Eye,
  ThumbsUp,
  MessageSquare,
  TrendingUp,
  Heart,
  Video,
  Layers,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { usePublicContestStats } from "@/hooks/use-data";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { PlatformBadge } from "@/components/platform-badge";

export const Route = createFileRoute("/")({
  component: Landing,
});

function CountUp({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    if (end <= 0) {
      setCount(0);
      return;
    }
    const increment = Math.ceil(end / 30) || 1;
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 25);
    return () => clearInterval(timer);
  }, [value]);
  return <>{count.toLocaleString()}</>;
}

function Landing() {
  const { session, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = usePublicContestStats();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
    }
  }, [loading, session, isAdmin, navigate]);

  // Smooth scroll handler
  const handleScroll = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Navigation Bar ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="transition-opacity hover:opacity-90">
            <img
              src="/bkclogo.png"
              alt="BKC Logo"
              className="h-14 w-auto object-contain"
            />
            {/* <span className="font-display text-lg font-bold tracking-tight">
              BKC <span className="text-primary">Creator Hub</span>
            </span> */}
          </Link>
          

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => handleScroll("features")}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => handleScroll("notice")}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              Notice
            </button>
            <button
              onClick={() => handleScroll("prizes")}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              Prizes
            </button>
            <button
              onClick={() => handleScroll("rules")}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              Rules
            </button>
            <button
              onClick={() => handleScroll("timeline")}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              Timeline
            </button>
            <button
              onClick={() => handleScroll("contact")}
              className="px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              Contact
            </button>
          </nav>

          <Button asChild size="sm" className="shadow-sm">
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </header>

      {/* ── Hero Section ───────────────────────────────────── */}
      <section className="bg-grid relative overflow-hidden" aria-label="Hero">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-7 space-y-6">
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold gap-1.5 border border-border">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              BKC Video Contest 2083
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl text-foreground">
              Create. Compete.<br />
              <span className="text-gradient">Grow.</span>
            </h1>
            <h2 className="text-xl font-semibold text-muted-foreground leading-snug max-w-2xl">
              Official Content Creation Platform for Butwal Kalika Campus.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
              Showcase student achievements, campus life, and scholastic excellence. Publish your video links to sync engagement statistics in real-time, compete against other student groups, and win exciting cash rewards!
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="shadow-md">
                <Link to="/auth">
                  Join Competition <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" onClick={() => handleScroll("rules")}>
                Read Contest Rules
              </Button>
            </div>
          </div>

          {/* Right Side: Live Analytics Widget */}
          <div className="lg:col-span-5 relative mt-6 lg:mt-0">
            <div className="absolute -inset-4 rounded-3xl bg-primary/10 blur-3xl opacity-75" />
            <div className="relative rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-md shadow-glow animate-in fade-in-50 duration-500">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                    Live Standings Preview
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-semibold border-primary/30 text-primary">Live Stats</Badge>
              </div>

              {statsLoading || !stats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-16 rounded-xl bg-secondary/30 animate-pulse" />
                    <div className="h-16 rounded-xl bg-secondary/30 animate-pulse" />
                  </div>
                  <div className="h-16 rounded-xl bg-secondary/30 animate-pulse" />
                  <div className="h-16 rounded-xl bg-secondary/30 animate-pulse" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Total Views</span>
                        <Eye className="size-3.5 text-primary" />
                      </div>
                      <p className="text-xl font-bold mt-1 text-foreground font-mono">
                        <CountUp value={stats.total_views} />
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Engagement</span>
                        <TrendingUp className="size-3.5 text-accent" />
                      </div>
                      <p className="text-xl font-bold mt-1 text-foreground font-mono">
                        {stats.engagement_rate.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Leaderboard Card snippet */}
                  <div className="rounded-xl border border-border bg-secondary/10 p-3 flex gap-3 items-center">
                    <div className="size-10 shrink-0 bg-amber-500/10 rounded-lg flex items-center justify-center relative">
                      <Trophy className="size-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Top Performing Team</p>
                      <p className="text-xs font-bold truncate text-foreground mt-0.5">{stats.top_team_name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stats.top_team_views.toLocaleString()} views</p>
                    </div>
                  </div>

                  {/* Latest Video upload */}
                  <div className="rounded-xl border border-border bg-secondary/10 p-3 flex gap-3 items-center">
                    <div className="size-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center relative">
                      <Clapperboard className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Latest Upload</p>
                      <p className="text-xs font-bold truncate text-foreground mt-0.5" title={stats.latest_video.title}>
                        {stats.latest_video.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {stats.latest_video.platform && (
                          <PlatformBadge platform={stats.latest_video.platform as any} />
                        )}
                        <span className="text-[9px] text-muted-foreground">Uploaded recently</span>
                      </div>
                    </div>
                  </div>

                  {/* Views timeline mini chart */}
                  <div className="rounded-xl border border-border bg-secondary/10 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><BarChart3 className="size-3 text-success" /> Views Over Time</span>
                      <span className="text-[10px] font-mono">Last 30 entries</span>
                    </div>
                    <div className="h-12 w-full mt-1">
                      {stats.views_history.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground">Syncing metrics...</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={stats.views_history}>
                            <Line type="monotone" dataKey="views" stroke="var(--color-primary)" strokeWidth={1.5} dot={false} isAnimationActive={true} />
                          </LineChart>
                        </ResponsiveContainer>)}
                    </div>
                  </div>

                  {/* Progress Indicators */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Platform Share</span>
                      <span className="text-[10px]">Total: {stats.total_videos} items</span>
                    </div>
                    {(() => {
                      const breakdown = stats.platform_breakdown || {};
                      const total = Object.values(breakdown).reduce((sum: number, v: any) => sum + v, 0) || 1;
                      const yt = Math.round(((breakdown.youtube || 0) / total) * 100);
                      const tt = Math.round(((breakdown.tiktok || 0) / total) * 100);
                      const ig = Math.round(((breakdown.instagram || 0) / total) * 100);
                      const fb = Math.round(((breakdown.facebook || 0) / total) * 100);
                      
                      return (
                        <>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
                            {yt > 0 && <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${yt}%` }} title={`YouTube: ${yt}%`} />}
                            {tt > 0 && <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${tt}%` }} title={`TikTok: ${tt}%`} />}
                            {ig > 0 && <div className="h-full bg-pink-500 transition-all duration-500" style={{ width: `${ig}%` }} title={`Instagram: ${ig}%`} />}
                            {fb > 0 && <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${fb}%` }} title={`Facebook: ${fb}%`} />}
                          </div>
                          <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                            {yt > 0 && <span>YT: {yt}%</span>}
                            {tt > 0 && <span>TT: {tt}%</span>}
                            {ig > 0 && <span>IG: {ig}%</span>}
                            {fb > 0 && <span>FB: {fb}%</span>}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Badges footer */}
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3 mt-2 justify-between">
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border flex gap-1 items-center px-2 py-0.5">
                      <Users className="size-3 text-primary" /> {stats.total_participants} Creators
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border flex gap-1 items-center px-2 py-0.5">
                      <Layers className="size-3 text-accent" /> {stats.total_teams} Teams
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border flex gap-1 items-center px-2 py-0.5">
                      <Video className="size-3 text-success" /> {stats.total_videos} Videos
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Competition Notice Section ─────────────────────── */}
      <section id="notice" className="border-t border-border bg-card/40 py-16" aria-labelledby="notice-heading">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-3">CONTEST DETAILS</Badge>
            <h2 id="notice-heading" className="text-3xl font-bold tracking-tight">Competition Notice & Guidelines</h2>
            <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
              Official announcement parameters for the Butwal Kalika Campus Promotional Video Competition. Please review the key information cards below.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-border bg-card/60 transition-transform hover:-translate-y-1">
              <CardHeader className="p-5 pb-2">
                <Volume2 className="size-5 text-primary" />
                <CardTitle className="text-base mt-2">Contest Goal</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-xs text-muted-foreground leading-relaxed">
                Produce creative promotional videos highlighting the academic standards, modern science/computer labs, active campus life, and library facilities of Butwal Kalika Campus for the upcoming Admission Open 2083.
              </CardContent>
            </Card>

            <Card className="border border-border bg-card/60 transition-transform hover:-translate-y-1">
              <CardHeader className="p-5 pb-2">
                <Users className="size-5 text-accent" />
                <CardTitle className="text-base mt-2">Eligibility</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-xs text-muted-foreground leading-relaxed">
                Open to all active students of Butwal Kalika Campus. Participants must register in collaborative groups of 2 to 5 members. Individual entries are not allowed.
              </CardContent>
            </Card>

            <Card className="border border-border bg-card/60 transition-transform hover:-translate-y-1">
              <CardHeader className="p-5 pb-2">
                <Calendar className="size-5 text-success" />
                <CardTitle className="text-base mt-2">Key Deadlines</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-xs text-muted-foreground leading-relaxed">
                Registration & Video submission must be completed before the deadline on <strong>Bhadra 30, 2083 (September 15, 2026)</strong>. Late entries will not be processed.
              </CardContent>
            </Card>

            <Card className="border border-border bg-card/60 transition-transform hover:-translate-y-1">
              <CardHeader className="p-5 pb-2">
                <Link2 className="size-5 text-primary" />
                <CardTitle className="text-base mt-2">Posting & Sync</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-xs text-muted-foreground leading-relaxed">
                Upload your video to public channels. Register and submit URLs inside this Creator Hub platform. Views and engagement metrics will sync automatically.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Prizes Section ─────────────────────────────────── */}
      <section id="prizes" className="py-16 bg-background" aria-labelledby="prizes-heading">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="border-yellow-500/30 text-yellow-500 bg-yellow-500/5 mb-3">AWARDS</Badge>
            <h2 id="prizes-heading" className="text-3xl font-bold tracking-tight">Exciting Cash Prizes & Certificates</h2>
            <p className="mt-3 text-muted-foreground text-sm">
              Attractive rewards await the creators who deliver the best campus representation.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {/* Second Prize */}
            <Card className="border border-border bg-card/50 order-2 md:order-1 flex flex-col justify-between py-6">
              <CardHeader className="text-center p-4">
                <span className="text-4xl">🥈</span>
                <CardTitle className="text-xl mt-3 text-foreground font-display">Second Prize</CardTitle>
                <CardDescription className="text-xs">Runner Up Reward</CardDescription>
              </CardHeader>
              <CardContent className="text-center p-4">
                <p className="text-3xl font-bold text-primary">Rs. 5,000</p>
                <p className="text-xs text-muted-foreground mt-2">Plus Certificate of Achievement</p>
              </CardContent>
            </Card>

            {/* First Prize */}
            <Card className="border-2 border-primary bg-card/90 order-1 md:order-2 flex flex-col justify-between py-8 shadow-glow relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                Winner
              </div>
              <CardHeader className="text-center p-4">
                <span className="text-5xl">🥇</span>
                <CardTitle className="text-2xl mt-3 text-foreground font-display font-bold">First Prize</CardTitle>
                <CardDescription className="text-xs">Grand Champion Reward</CardDescription>
              </CardHeader>
              <CardContent className="text-center p-4">
                <p className="text-4xl font-extrabold text-primary">Rs. 7,000</p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">Plus Official Certificate of Excellence</p>
              </CardContent>
            </Card>

            {/* Third Prize */}
            <Card className="border border-border bg-card/50 order-3 md:order-3 flex flex-col justify-between py-6">
              <CardHeader className="text-center p-4">
                <span className="text-4xl">🥉</span>
                <CardTitle className="text-xl mt-3 text-foreground font-display">Third Prize</CardTitle>
                <CardDescription className="text-xs">Second Runner Up Reward</CardDescription>
              </CardHeader>
              <CardContent className="text-center p-4">
                <p className="text-3xl font-bold text-primary">Rs. 3,000</p>
                <p className="text-xs text-muted-foreground mt-2">Plus Certificate of Participation</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Rules Section ──────────────────────────────────── */}
      <section id="rules" className="border-t border-border bg-card/30 py-16" aria-labelledby="rules-heading">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="border-accent/30 text-accent bg-accent/5 mb-3">CONTEST POLICIES</Badge>
            <h2 id="rules-heading" className="text-3xl font-bold tracking-tight">Official Competition Rules</h2>
            <p className="mt-3 text-muted-foreground text-sm">
              Please review all rules carefully. Adherence to rules is required for eligibility.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
            {/* Rules Group 1 */}
            <Card className="border border-border bg-card p-6">
              <h3 className="text-lg font-bold text-foreground font-display mb-4 pb-2 border-b border-border flex items-center gap-2">
                <CheckCircle className="size-4.5 text-primary" /> Submission Rules
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Teams must register on the Creator Hub before posting video links.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Videos must be uploaded to public profiles (anonymous channels are disallowed).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>All group members must be listed under the registered team list.</span>
                </li>
              </ul>

              <h3 className="text-lg font-bold text-foreground font-display mt-8 mb-4 pb-2 border-b border-border flex items-center gap-2">
                <CheckCircle className="size-4.5 text-primary" /> Video Requirements
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Length must be between 30 seconds and 3 minutes (Shorts / Reels preferred).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Content must remain positive, academic, and respectful to Butwal Kalika Campus.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>High quality resolution of at least 1080p is highly recommended.</span>
                </li>
              </ul>
            </Card>

            {/* Rules Group 2 */}
            <Card className="border border-border bg-card p-6">
              <h3 className="text-lg font-bold text-foreground font-display mb-4 pb-2 border-b border-border flex items-center gap-2">
                <CheckCircle className="size-4.5 text-primary" /> Posting Rules & Hashtags
              </h3>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                When posting your video, you must include the following official hashtags in the description/caption:
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="default" className="text-xs">#ButwalKalikaCampus</Badge>
                <Badge variant="default" className="text-xs">#AdmissionOpen2083</Badge>
                <Badge variant="default" className="text-xs">#KalikaCampusButwal</Badge>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground mt-4">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Videos must remain public throughout the entire competition duration.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Ensure you tag the official Butwal Kalika Campus social accounts.</span>
                </li>
              </ul>

              <h3 className="text-lg font-bold text-foreground font-display mt-6 mb-4 pb-2 border-b border-border flex items-center gap-2">
                <CheckCircle className="size-4.5 text-primary" /> Evaluation Criteria
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>50% Social Metrics:</strong> Views, likes, and comments automatically calculated via the Creator Hub.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span><strong>50% Judging Board:</strong> Evaluation based on creativity, video editing, message delivery, and campus representation.</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Timeline Section ───────────────────────────────── */}
      <section id="timeline" className="py-16 bg-background" aria-labelledby="timeline-heading">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-3">ROADMAP</Badge>
            <h2 id="timeline-heading" className="text-3xl font-bold tracking-tight">Contest Timeline</h2>
            <p className="mt-3 text-muted-foreground text-sm">
              Follow the steps to secure your submission and participate in the evaluation.
            </p>
          </div>

          <div className="relative border-l border-border max-w-3xl mx-auto pl-6 space-y-8">
            {[
              { title: "Team Registration", desc: "Create an account on the BKC Creator Hub, fill in team details, and list active members." },
              { title: "Video Submission", desc: "Produce your promotional video, upload it to public platforms with official hashtags, and submit links inside Creator Hub." },
              { title: "Contest Posting & Sync", desc: "Share your video publicly to boost engagement. Monitor automated views and likes refreshes on your group page." },
              { title: "Evaluation Phase", desc: "Our board of judges evaluates entries alongside the computed social media engagement statistics." },
              { title: "Winner Announcement", desc: "Cash prizes and certificates are awarded to the top three student creator groups at a campus ceremony." },
            ].map((step, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-9.5 top-0.5 grid size-7 place-items-center rounded-full bg-secondary border border-border text-xs font-bold text-foreground">
                  {i + 1}
                </span>
                <h3 className="font-display font-semibold text-foreground text-base">{step.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact Section ────────────────────────────────── */}
      <section id="contact" className="border-t border-border bg-card/40 py-16" aria-labelledby="contact-heading">
        <div className="mx-auto max-w-4xl px-4">
          <Card className="border border-border bg-card/90 p-8 shadow-glow">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">GET IN TOUCH</Badge>
                <h2 id="contact-heading" className="text-2xl font-bold tracking-tight font-display">Contact Campus Office</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Have questions about the video requirements, prizes, or evaluations? Contact the Campus Admission & Student Activities Committee.
                </p>
                <div className="space-y-3 pt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 text-primary" />
                    <span>+977-71-543534, +977-71-546115</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-primary" />
                    <span>info@btlkalikacampus.edu.np</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="size-4 text-primary" />
                    <a href="https://btlkalikacampus.edu.np" target="_blank" rel="noopener noreferrer" className="hover:underline">
                      btlkalikacampus.edu.np
                    </a>
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-secondary/20 p-5 rounded-xl border border-border/50">
                <h3 className="text-sm font-semibold text-foreground">Location & Coordinator</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong>Butwal Kalika Campus (BKC)</strong><br />
                  Butwal-10, Rupandehi, Lumbini Province, Nepal
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border">
                  <strong>Contest coordinator:</strong><br />
                  Student Welfare Division & IT Administration
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2.5">
                <img
                  src="/bkclogo.png"
                  alt="BKC Logo"
                  className="size-8 rounded-full object-contain bg-white p-0.5"
                />
                <span className="font-display font-bold tracking-tight">
                  BKC <span className="text-primary">Creator Hub</span>
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                Official collaborative video content management platform for Butwal Kalika Campus students. Build your team, promote your campus, and track progress.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Quick Links</h3>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li><button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-primary cursor-pointer">Home</button></li>
                <li><button onClick={() => handleScroll("features")} className="hover:text-primary cursor-pointer">Features</button></li>
                <li><button onClick={() => handleScroll("notice")} className="hover:text-primary cursor-pointer">Notice</button></li>
                <li><button onClick={() => handleScroll("rules")} className="hover:text-primary cursor-pointer">Contest Rules</button></li>
                <li><Link to="/auth" className="hover:text-primary">Sign In / Register</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Campus Portal</h3>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                Learn more about our academic programs, admissions, and upcoming notices.
              </p>
              <a
                href="https://btlkalikacampus.edu.np"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Visit official campus portal <ArrowRight className="size-3" />
              </a>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Butwal Kalika Campus (BKC). All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
