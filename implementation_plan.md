# Implementation Plan — Complete Admin Management System

This plan details the steps to implement a complete role-based Admin Management System in the **group-reels** platform, building on top of existing components, authentication, and layouts.

## User Review Required

> [!IMPORTANT]
> - This plan utilizes the existing Supabase client directly for CRUD operations on `groups` and `video_links` since the existing Row Level Security (RLS) policies already grant full permissions to users with the `admin` role.
> - A new server function `updateUserAccount` will be added in `src/lib/admin.functions.ts` to allow admins to edit username, email, and team name. This is because editing auth email requires service role capabilities.
> - Server-side pagination is implemented by querying the Supabase database using `.range(from, to)` on the client.

## Proposed Changes

### Component Navigation & Auth Redirection

#### [MODIFY] [auth.tsx](file:///c:/Users/USER/Desktop/group-reels/src/routes/auth.tsx)
- Modify the post-login/registration redirect logic to dynamically route `admin` users to `/admin` and regular users to `/dashboard`.
- Remove manual `navigate({ to: "/dashboard" })` calls from `handleLogin`, `handleRegister`, and `handleGoogle`, letting the react-reactive `useEffect` handle redirection.

#### [MODIFY] [app-layout.tsx](file:///c:/Users/USER/Desktop/group-reels/src/components/app-layout.tsx)
- Add a new `NavItem` to the Admin header navigation bar pointing to `/admin/video-links` ("Videos").

---

### Backend / Server Functions

#### [MODIFY] [admin.functions.ts](file:///c:/Users/USER/Desktop/group-reels/src/lib/admin.functions.ts)
- Add a new server function `updateUserAccount` which validates admin permissions, updates the user's email in `auth.users` via `supabaseAdmin.auth.admin.updateUserById`, and then updates the user's details (username, email, team_name) in the `profiles` table.

---

### Admin Dashboard (Overview)

#### [MODIFY] [admin.index.tsx](file:///c:/Users/USER/Desktop/group-reels/src/routes/_authenticated/admin.index.tsx)
- Add "Total Users" stat counter to the main summary stats cards using `profiles.length`.
- Change layout grid to `lg:grid-cols-5` or adjust columns to fit: Total Users, Groups, Total Video Links, Invalid Links, and Top Platform.
- Add an action link card pointing to the new `/admin/video-links` management page.

---

### Admin Pages & Tables with Server-Side Pagination

#### [MODIFY] [admin.users.tsx](file:///c:/Users/USER/Desktop/group-reels/src/routes/_authenticated/admin.users.tsx)
- Re-architect table query to use server-side pagination with Supabase `.range(start, end)` and `.select('*', { count: 'exact' })`.
- Add an edit dialog enabling admins to edit a user's details (username, email, team name) using the new `updateUserAccount` server function.

#### [MODIFY] [admin.groups.tsx](file:///c:/Users/USER/Desktop/group-reels/src/routes/_authenticated/admin.groups.tsx)
- Re-architect table query to use server-side pagination, sorting, and search via Supabase range queries.
- Add an edit dialog enabling admins to edit group details: Team Name, members list (dynamic text inputs), and all social links (Instagram, TikTok, YouTube, Facebook, LinkedIn, Website).

#### [NEW] [admin.video-links.tsx](file:///c:/Users/USER/Desktop/group-reels/src/routes/_authenticated/admin.video-links.tsx)
- Create a new admin view for all video links in the platform.
- Implement server-side pagination, text search (title/URL), and filtering (Platform, Status).
- Display video link details: Title, URL, Platform, Status, Parent Team Name, Sync Status, and Sync Error.
- Add Actions:
  - **Edit**: Edit Title, URL, Platform, and Status.
  - **Delete**: Remove the video link.
  - **Refresh**: Force-refresh video metrics using the existing `syncVideoAnalytics` server function.
  - **Open**: External link to open the video.

---

## Database Changes
No database schema or RLS policy updates are necessary. We verified that the existing RLS policies already grant the `admin` role full CRUD permissions:
- `Profiles` table: `public.has_role(auth.uid(), 'admin')` allows view, insert, update, and delete.
- `Groups` table: `public.has_role(auth.uid(), 'admin')` allows select, update, delete.
- `Video links` table: `public.has_role(auth.uid(), 'admin')` allows select, insert, update, delete.
- `User roles` table: `public.has_role(auth.uid(), 'admin')` allows select, insert, update, delete.

---

## Verification Plan

### Automated Checks
- Verify compilation of the project with `npm run build` after adding routes.
- Verify that TanStack Router dynamically updates the routes and regenerates `src/routeTree.gen.ts`.

### Manual Verification
1. **Login Redirect**: Log in as a regular user (should go to `/dashboard`) and as an admin user (should go to `/admin`).
2. **Dashboard Overview**: Check if the Admin index page displays Total Users, Total Groups, Total Videos, Total Views, Likes, and Comments.
3. **User Management**:
   - Verify search and page navigation.
   - Verify changing user roles (user to admin and vice versa).
   - Edit user name, email, and team name; confirm they update.
4. **Group Management**:
   - Verify disabling/enabling a group.
   - Edit a group (change team name, members list, social links); verify details update.
5. **Video Links Management**:
   - Open `/admin/video-links` and verify list fetches.
   - Edit video link details (title, status, etc.).
   - Verify deleting a video link.
   - Run manual sync on a YouTube link and check if views/likes/comments metrics load and are written to historical tables.
