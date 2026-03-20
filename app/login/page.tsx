"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const formDir = locale === "ar" ? "rtl" : "ltr";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(t("invalidCredentials"));
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen flex-row" dir="ltr">
      <div className="relative hidden min-h-screen w-0 overflow-hidden md:flex md:w-[60%]">
        <Image
          src="/Logo3-3D.png"
          alt=""
          fill
          className="object-cover"
          priority
          sizes="60vw"
        />
      </div>

      <div
        className="flex w-full flex-col justify-center bg-white px-6 py-12 md:w-[40%] md:px-10"
        dir={formDir}
      >
        <div className="mx-auto w-full max-w-sm space-y-6 text-center">
          <div className="flex justify-center">
            <Image
              src="/Logo1.png"
              alt="AgencyOS"
              width={100}
              height={40}
              className="h-auto w-[100px] object-contain"
              priority
            />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("welcomeBack")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("pleaseSignIn")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">
                {t("email")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border bg-background text-start"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                {t("password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-border bg-background ps-10 text-start"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  title={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-start text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-black font-medium text-white hover:bg-gray-900"
              disabled={loading}
            >
              {loading ? t("signingIn") : t("loginButton")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
