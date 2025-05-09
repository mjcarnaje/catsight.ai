declare module "react-blurhash" {
  import { FC } from "react";

  interface BlurhashProps {
    hash: string;
    width?: number | string;
    height?: number | string;
    resolutionX?: number;
    resolutionY?: number;
    punch?: number;
    style?: React.CSSProperties;
    className?: string;
  }

  export const Blurhash: FC<BlurhashProps>;
}
