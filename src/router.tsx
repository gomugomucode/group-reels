import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 1000 * 60 * 5, // 5 minutes
    defaultPreloadDelay: 0, // start preloading immediately
  });
  console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("Publishable Key:", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

  return router;
};
