// Categorical series colors are slots 1-3 of a validated palette
// (CVD-safe on the dark card surface #151a23, all >= 3:1 contrast).
// Status colors are reserved roles, always paired with an icon + label.
export const SERIES = {
  cpu: "#3987e5",
  memory: "#d95926",
  gpu: "#199e70",
} as const;

export const CHART = {
  grid: "#262d3b",
  axis: "#3a4354",
  muted: "#8b93a3",
  ink: "#f0efec",
  tooltipBg: "#1c2331",
} as const;

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
} as const;
