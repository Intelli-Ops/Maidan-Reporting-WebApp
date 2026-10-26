/// <reference types="vite/client" />

// vite/client already declares ImportMetaEnv with a `[key: string]: any`
// index signature, so these would type-check without this file — but as
// `any`. Declaring them explicitly merges into that interface and gives
// each one a real type, so a typo like VITE_API_BASE_UR is a string that
// can't be used, not silent `any`.
interface ImportMetaEnv {
  /** Absolute origin of the deployed API, e.g. https://api.maidan.pk/api.
   *  Unset in development — see the fallback in src/api/client.ts. */
  readonly VITE_API_BASE_URL?: string;
  /** Mirrors the backend's REQUIRE_COMPANY_EMAIL. The two must agree or
   *  the register form accepts an address the API then rejects. */
  readonly VITE_REQUIRE_COMPANY_EMAIL?: string;
  /** Turns on the MSW mock handlers. Guarded by import.meta.env.DEV in
   *  main.tsx, so it cannot activate in a production build. */
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
