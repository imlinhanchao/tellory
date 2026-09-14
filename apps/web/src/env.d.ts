/// <reference types="vite/client" />
declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}
