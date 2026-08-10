// Mirrors next.config.mjs's `basePath`. Client components using a raw
// fetch() (rather than next/link or next/navigation, which handle this
// automatically) need this prefix themselves.
export const BASE_PATH = "/dashboard";
