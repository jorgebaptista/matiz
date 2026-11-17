import { locale } from "./pack.js";

/** Format a validated message with named values and optional cardinal plurals. */
export function translate(key, values = {}) {
  const message = locale.strings[key];
  const template = typeof message === "string" ? message
    : message[new Intl.PluralRules(locale.locale).select(values.count)] ?? message.other;
  return template.replace(/\{([a-zA-Z]+)\}/g, (_, name) => values[name]);
}

export const storageKey = `matiz.${locale.locale}.v1`;
