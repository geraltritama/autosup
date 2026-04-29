import { RecaptchaProvider } from "@/components/auth/recaptcha-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <RecaptchaProvider>{children}</RecaptchaProvider>;
}
