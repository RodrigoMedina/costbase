import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

export { type ClassValue } from "clsx";

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "title-h1", "title-h2", "title-h3", "title-h4", "title-h5", "title-h6",
            "label-xl", "label-lg", "label-md", "label-sm", "label-xs",
            "paragraph-xl", "paragraph-lg", "paragraph-md", "paragraph-sm", "paragraph-xs",
            "subheading-md", "subheading-sm", "subheading-xs", "subheading-2xs",
            "doc-label", "doc-paragraph",
          ],
        },
      ],
    },
  },
});

export function cn(...classes: ClassValue[]) {
  return customTwMerge(clsx(...classes));
}
