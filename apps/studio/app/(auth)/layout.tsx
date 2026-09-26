export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <div className="h-full overflow-hidden">{children}</div>;
}
