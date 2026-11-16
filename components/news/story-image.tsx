import Image from "next/image";
import type { Image as Img } from "@/lib/types";

/**
 * Fixed aspect-ratio box: space is reserved before the image loads (no layout
 * shift), and the editor-chosen focal point keeps the subject in every crop.
 */
export function StoryImage({
  image,
  sizes,
  ratio = "16/9",
  preload = false,
  className = "",
  fill = false,
}: {
  image: Img;
  sizes: string;
  ratio?: "16/9" | "4/3" | "1/1" | "3/2";
  preload?: boolean;
  className?: string;
  /** Fill the parent's box (which then sets the size) instead of keeping the ratio. */
  fill?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${fill ? "h-full w-full" : ""} ${className}`} style={fill ? undefined : { aspectRatio: ratio }}>
      <Image
        src={image.url}
        alt={image.alt}
        fill
        sizes={sizes}
        preload={preload}
        loading={preload ? "eager" : "lazy"}
        quality={70}
        style={{ objectFit: "cover", objectPosition: `${image.focalX}% ${image.focalY}%` }}
      />
    </div>
  );
}
