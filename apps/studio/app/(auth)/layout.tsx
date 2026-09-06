export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <div className="h-dvh max-h-dvh overflow-hidden">{children}</div>;
}
