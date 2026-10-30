import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { en } from "./en";
import { ko } from "./ko";
import {
  LANG_STORAGE_KEY,
  initialLang,
  readStoredLang,
  tr,
  writeStoredLang,
} from "./index";

function keyPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.keys(obj).flatMap((k) =>
    keyPaths((obj as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k),
  );
}

function placeholderMap(obj: unknown, prefix = ""): Record<string, string[]> {
  if (typeof obj !== "string") return {};
  const names = [...obj.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  return names.length > 0 ? { [prefix]: names } : {};
}

function allPlaceholders(obj: unknown, prefix = ""): Record<string, string[]> {
  if (typeof obj === "string") return placeholderMap(obj, prefix);
  if (typeof obj !== "object" || obj === null) return {};
  return Object.keys(obj).reduce<Record<string, string[]>>((acc, k) => {
    Object.assign(
      acc,
      allPlaceholders((obj as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k),
    );
    return acc;
  }, {});
}

describe("message catalogs", () => {
  it("ko exposes exactly the same keys as en", () => {
    expect(keyPaths(ko).sort()).toEqual(keyPaths(en).sort());
  });

  it("ko templates use the same placeholders as en", () => {
    expect(allPlaceholders(ko)).toEqual(allPlaceholders(en));
  });

  it("ko actually translates the UI text", () => {
    expect(ko.sections.systemInfo).not.toBe(en.sections.systemInfo);
    expect(ko.header.title).not.toBe(en.header.title);
  });
});

describe("tr()", () => {
  it("fills placeholders", () => {
    expect(tr("Showing {shown} of {total}", { shown: 10, total: 42 })).toBe(
      "Showing 10 of 42",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(tr("Failed: {error}", {})).toBe("Failed: {error}");
  });
});

describe("language persistence", () => {
  const originalLanguage = navigator.language;

  function setNavigatorLanguage(value: string) {
    Object.defineProperty(navigator, "language", { value, configurable: true });
  }

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    setNavigatorLanguage(originalLanguage);
  });

  it("stores and reads back a valid language", () => {
    writeStoredLang("ko");
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe("ko");
    expect(readStoredLang()).toBe("ko");
  });

  it("ignores an invalid stored value", () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, "fr");
    expect(readStoredLang()).toBeNull();
  });

  it("initialLang prefers the stored language over the browser locale", () => {
    setNavigatorLanguage("ko-KR");
    window.localStorage.setItem(LANG_STORAGE_KEY, "en");
    expect(initialLang()).toBe("en");
  });

  it("initialLang falls back to the browser locale when nothing is stored", () => {
    setNavigatorLanguage("ko-KR");
    expect(initialLang()).toBe("ko");
    setNavigatorLanguage("en-US");
    expect(initialLang()).toBe("en");
  });
});
