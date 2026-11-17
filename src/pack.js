import pack from "../packs/pt-PT.json" with { type: "json" };
import locale from "../locales/pt-PT.json" with { type: "json" };

// The builder replaces this module per locale; direct engine tests use PT-PT.
export { pack, locale };
export const survivalArchives = {};
