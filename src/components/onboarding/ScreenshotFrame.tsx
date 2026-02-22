import { cn } from "@/lib/utils";

interface ScreenshotFrameProps {
  src: string;
  alt: string;
  className?: string;
}

export function ScreenshotFrame({
  src,
  alt,
  className,
}: ScreenshotFrameProps) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-foreground/5",
        className,
      )}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-border" />
          <div className="h-3 w-3 rounded-full bg-border" />
          <div className="h-3 w-3 rounded-full bg-border" />
        </div>
        <div className="mx-auto flex h-7 w-64 items-center justify-center rounded-md bg-background px-3">
          <span className="text-xs text-muted-foreground">app.nursely.io</span>
        </div>
        <div className="w-[54px]" />
      </div>

      {/* Screenshot image */}
      <div className="relative aspect-[16/10] w-full">
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover object-top"
        />
      </div>
    </div>
  );
}
