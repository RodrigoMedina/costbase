import { createTV } from "tailwind-variants";

export type { VariantProps, ClassValue } from "tailwind-variants";
export const tv = createTV({
  twMergeConfig: { extend: { classGroups: { "font-size": [{ text: ["label-sm"] }] } } },
});
