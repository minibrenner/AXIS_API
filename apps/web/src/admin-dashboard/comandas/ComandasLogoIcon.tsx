import type { SVGProps } from "react";

type ComandasLogoIconProps = Omit<
  SVGProps<SVGSVGElement>,
  "width" | "height" | "viewBox"
> & {
  size?: number;
};

/**
 * Compact monogram inspired by the comandas logo shared by the user.
 * Uses currentColor so it adapts to the sidebar theme.
 */
function ComandasLogoIcon({ size = 18, ...rest }: ComandasLogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path
        d="M48 17.5C43.2 12.7 37.3 10.5 31.5 10.5
           C18.1 10.5 7 21.6 7 35
           C7 48.4 18.1 59.5 31.5 59.5
           C37.3 59.5 43.2 57.3 48 52.5"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default ComandasLogoIcon;
