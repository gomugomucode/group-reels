# Collaborative Video Content Management System

A web app where student teams register, create a group, add social + video links, and see analytics — with an admin who has full control and a dashboard of charts.

## Stack mapping (your spec → this platform)

Your spec assumed React + Express + Postgres + Prisma + JWT. This platform gives the same capabilities natively, so I'll map it rather than run a separate Express server:

| Your choice | Built here as | Why |
|---|---|---|
| React + Vite | TanStack Start (React 19, SSR) | Native to this stack |
| Tailwind + charts | Tailwind v4 + Recharts | Already configured |
| Express REST API | TanStack server functions + `/api/*` routes | Typed RPC, same endpoints |
| PostgreSQL + Prisma | Lovable Cloud Postgres (Supabase) + SQL migrations | Managed, no setup |
| JWT + bcrypt middleware | Lovable Cloud Auth + Row-Level Security | Auth handled + DB-enforced permissions |

Everything relational, analytics-friendly, and scalable — matching your goals. Permission checks live in RLS policies (DB level) **and** UI guards, which is stronger than app-only middleware.

## Roles & access

- **Team member**: register (email/password), create one group, full CRUD on *their own* group, its social links, and its video links; view their own analytics; search their content.
- **Admin**: full CRUD on all users, groups, video links; validate links; view global analytics dashboard.
- Roles stored in a dedicated `user_roles` table (never on the profile) with a `has_role()` security-definer function — the secure pattern that avoids privilege escalation.

## Data model

```text
profiles      id(=auth uid) · username · email · team_name · member_names[] · created_at
user_roles    id · user_id → auth.users · role(app_role: admin|user)
groups        id · team_name · member_names[] · team_leader · created_by → auth.users
              instagram · tiktok · facebook · youtube · linkedin · website · disabled
              created_at · updated_at
video_links   id · group_id → groups · url · platform(enum) · status(enum)
              title · created_at · updated_at
analytics     group_id → groups · total_views · platform_breakdown(jsonb) · last_updated
```
- `platform` enum: youtube, facebook, instagram, tiktok, vimeo, other
- `status` enum: valid, invalid, pending
- Registration captures team_name + member_names on the profile; the group is created in a separate step after registration (per your requirement).
- Every table gets GRANTs + RLS policies: owners manage their rows via `created_by = auth.uid()`; admins bypass via `has_role(auth.uid(),'admin')`.

## Endpoints (server functions / API routes)

```text
Auth        handled by Lovable Cloud Auth (register, login, logout, session)
Profile     getMyProfile · updateMyProfile
Groups      listGroups · getGroup · createGroup · updateGroup · deleteGroup
VideoLinks  listVideoLinks · createVideoLink · updateVideoLink · deleteVideoLink · validateLink
Users(admin)listUsers · updateUser · deleteUser · setUserRole
Analytics   getGlobalAnalytics · getGroupAnalytics · getPlatformBreakdown
```
Each mutating function checks the caller's identity/role server-side before writing.

## Features (covers your minimum 6)

1. **Auth** — email/password + Google sign-in, protected routes via `_authenticated` layout.
2. **Group CRUD** — members manage own group; admin manages all.
3. **VideoLink CRUD** — with platform auto-detection from URL.
4. **URL validation** — Zod format check + platform-pattern match; sets status valid/invalid/pending.
5. **Admin dashboard** — stat cards (users, groups, videos, invalid links, total views, top platform) + Recharts pie (platform distribution), bar (videos by platform), bar (views per group).
6. **Search & filter** — by team/member name, platform, status.
7. **Notifications** — toasts for success/error, plus friendly error boundaries.

## Routes / wireframes

```text
/                     landing + register/login CTA
/auth                 login + register (team name, member names)
/dashboard            member: my group summary, analytics, quick links
/groups/new           create group (only if none yet)
/groups/$id           group page: info, social links, video list, add/edit video
/admin                admin dashboard (cards + charts)
/admin/groups         all groups table (search/filter, edit, disable, delete)
/admin/users          user management (edit, reset, delete, set role)
```

```text
Admin Dashboard                          Group Page
┌───────────────────────────┐           ┌──────────────────────────┐
│ Users  Groups  Videos      │           │ Team A · members · leader│
│ Invalid  Views  TopPlatform│           │ IG  TikTok  FB  YT  Site │
├───────────────────────────┤           ├──────────────────────────┤
│ [Pie: platform] [Bar: cnt]│           │ Videos      [+ Add video]│
│ [Bar: views per group]     │           │ • yt link   valid  ✎ 🗑  │
├───────────────────────────┤           │ • tiktok    invalid ✎ 🗑 │
│ Recent groups (search/flt) │           ├──────────────────────────┤
└───────────────────────────┘           │ Analytics: views/platform│
                                         └──────────────────────────┘
```

## Data flow

```text
Browser (React/TanStack) ──▶ server functions (auth + role check)
        ▲                              │
        │ toasts/queries               ▼
   TanStack Query ◀──── Lovable Cloud Postgres (RLS enforced)
                         profiles · groups · video_links · analytics · user_roles
```

## Build order (MVP first)

1. Enable Lovable Cloud; migration for enums, tables, GRANTs, RLS, `has_role()`, and a signup trigger creating profile + default `user` role.
2. Design system in `src/styles.css` (distinct, non-generic theme) + shared layout/header reflecting session state.
3. Auth page (register with team/member fields) + `_authenticated` gate + session-aware nav.
4. Group create + group page with social links and VideoLink CRUD + Zod URL validation.
5. Member dashboard + search/filter.
6. Admin dashboard with Recharts + admin groups/users management.
7. sitemap.xml, robots.txt, real head metadata; verify build + a browser smoke test.

## Notes on your extras

- **Analytics views**: real view counts require platform APIs (YouTube/TikTok) with keys — out of MVP scope. I'll seed/compute analytics from link data (counts, platform breakdown, invalid links) and structure the `analytics` table so real ingestion can be added later.
- **Deployment**: publishing is one click here (Lovable hosting) — no separate Render/Vercel/Neon wiring needed, though the schema stays portable.

Approve and I'll start with Cloud + the schema, then build the MVP through to the admin dashboard.