import { cn } from "@/utils/format";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 border text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5" : "h-9 px-3",
        variant === "primary" && "border-blue-800 bg-blue-800 text-white hover:bg-blue-900",
        variant === "secondary" && "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
        variant === "ghost" && "border-transparent bg-transparent text-zinc-700 hover:bg-zinc-100",
        variant === "danger" && "border-red-700 bg-red-700 text-white hover:bg-red-800",
        className,
      )}
      {...props}
    />
  );
}
