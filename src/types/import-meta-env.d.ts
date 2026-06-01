/** Linked realmorphism package uses Vite-style import.meta.env when typechecked by Next. */
interface ImportMeta {
  readonly env?: {
    readonly BASE_URL?: string;
  };
}
