import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("sessions/create", "routes/sessions/create.tsx"),
  route("sessions/:id", "routes/sessions/update.tsx"),
  route("sessions/:id/summary", "routes/sessions/summary.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
