import { cn } from "@/lib/ui";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
    secondary: "bg-muted text-foreground hover:bg-border",
    ghost: "bg-transparent text-foreground hover:bg-muted",
    danger: "bg-danger text-white shadow-sm hover:opacity-90"
  };
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-[transform,opacity,background-color] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}
