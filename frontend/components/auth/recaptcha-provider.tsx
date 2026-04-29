"use client";

import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

export function RecaptchaProvider({ children }: { children: React.ReactNode }) {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={SITE_KEY}>
      {children}
    </GoogleReCaptchaProvider>
  );
}
