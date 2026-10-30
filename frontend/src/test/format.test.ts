import { describe, expect, it } from "vitest";
import { fmtBytes, fmtDuration, fmtPercent, fmtRate } from "../format";

// The dashboard must never render "NaN%"/"NaN B"/"NaNm NaNs": a malformed
// timestamp upstream reaches the formatters as NaN, and the contract for
// anything non-finite is the same em-dash placeholder as for null.

describe("fmtBytes", () => {
  it("formats human units with sensible precision", () => {
    expect(fmtBytes(0)).toBe("0.00 B");
    expect(fmtBytes(1536)).toBe("1.50 KB");
    expect(fmtBytes(1024 ** 3)).toBe("1.00 GB");
  });

  it("renders nullish and non-finite values as the placeholder", () => {
    expect(fmtBytes(null)).toBe("—");
    expect(fmtBytes(undefined)).toBe("—");
    expect(fmtBytes(NaN)).toBe("—");
    expect(fmtBytes(Infinity)).toBe("—");
    expect(fmtBytes(-Infinity)).toBe("—");
  });
});

describe("fmtRate", () => {
  it("appends /s to the byte formatting", () => {
    expect(fmtRate(500)).toBe("500 B/s");
  });

  it("never renders a NaN rate", () => {
    expect(fmtRate(NaN)).toBe("—");
    expect(fmtRate(null)).toBe("—");
    expect(fmtRate(undefined)).toBe("—");
  });
});

describe("fmtPercent", () => {
  it("formats with one decimal", () => {
    expect(fmtPercent(42.5)).toBe("42.5%");
    expect(fmtPercent(0)).toBe("0.0%");
  });

  it("never renders a NaN percent", () => {
    expect(fmtPercent(NaN)).toBe("—");
    expect(fmtPercent(Infinity)).toBe("—");
    expect(fmtPercent(null)).toBe("—");
  });
});

describe("fmtDuration", () => {
  it("formats h/m/s and d/h/m spans", () => {
    expect(fmtDuration(3661)).toBe("1h 1m");
    expect(fmtDuration(90900)).toBe("1d 1h 15m");
    expect(fmtDuration(95)).toBe("1m 35s");
  });

  it("uses localized unit labels", () => {
    expect(
      fmtDuration(3661, { days: "일", hours: "시간", minutes: "분", seconds: "초" }),
    ).toBe("1시간 1분");
  });

  it("renders nullish, non-finite, and negative durations as the placeholder", () => {
    expect(fmtDuration(null)).toBe("—");
    expect(fmtDuration(undefined)).toBe("—");
    expect(fmtDuration(NaN)).toBe("—"); // e.g. Date.parse(bad boot_time) → NaN
    expect(fmtDuration(-5)).toBe("—");
  });
});
