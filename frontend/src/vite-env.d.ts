/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ODOO_BASE_URL?: string;
  readonly VITE_ODOO_DB?: string;
  readonly VITE_ODOO_LOGIN?: string;
  readonly VITE_ODOO_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
