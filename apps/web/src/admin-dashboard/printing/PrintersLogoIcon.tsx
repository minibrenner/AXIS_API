import type { SVGProps } from "react";

interface Props extends SVGProps<SVGSVGElement> {
  size?: number;
}

function PrintersLogoIcon({ size = 24, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M7 9V4.5h10V9" />
      <rect x={4} y={9} width={16} height={7} rx={2.2} />
      <path d="M7 16v3.5h10V16" />
      <circle cx={17.5} cy={11.5} r={0.75} fill="currentColor" stroke="none" />
    </svg>
  );
}

export default PrintersLogoIcon;
