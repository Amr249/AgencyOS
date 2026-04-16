"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isAr = locale === "ar";
  const formDir = isAr ? "rtl" : "ltr";

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
    <div
      className="flex min-h-screen flex-row"
      dir="ltr"
      lang={locale}
    >

      {/* Left dark panel — 60% */}
      <div className="relative hidden min-h-screen overflow-hidden bg-black md:flex md:w-[60%]">

        {/* Bokeh light streaks — positioned at bottom, varying heights */}
        {[
          { color: "#a4fe19", height: "70%", left: "2%",  w: "w-14", opacity: 0.55, blur: "blur-md"  },
          { color: "#a4fe19", height: "60%", left: "8%",  w: "w-12", opacity: 0.40, blur: "blur-md"  },
          { color: "#ffffff", height: "55%", left: "14%", w: "w-12", opacity: 0.30, blur: "blur-lg"  },
          { color: "#ffffff", height: "45%", left: "20%", w: "w-12", opacity: 0.22, blur: "blur-lg"  },
          { color: "#a4fe19", height: "35%", left: "26%", w: "w-10", opacity: 0.15, blur: "blur-lg"  },
          { color: "#f0f0f0", height: "25%", left: "32%", w: "w-10", opacity: 0.08, blur: "blur-xl"  },
        ].map((s, i) => (
          <div
            key={i}
            className={`pointer-events-none absolute bottom-0 z-2 ${s.w} ${s.blur}`}
            style={{
              left: s.left,
              height: s.height,
              opacity: s.opacity,
              background: `linear-gradient(to top, ${s.color}, transparent)`,
            }}
          />
        ))}

        {/* Bottom glow blobs */}
        <div className="absolute -bottom-16 -left-10 z-1 h-64 w-96 rounded-full bg-[#a4fe19] opacity-40 blur-[100px]" />
        <div className="absolute -bottom-10 left-12 z-1 h-48 w-72 rounded-full bg-white opacity-20 blur-[80px]" />

        {/* Top fade to black */}
        <div className="pointer-events-none absolute inset-0 z-3 bg-linear-to-t from-transparent via-transparent to-black/90" />

        {/* Tagline */}
        <div className="relative z-5 mt-auto p-10 lg:p-14" dir={isAr ? "rtl" : "ltr"}>
          <h1 className="max-w-md text-2xl font-medium leading-tight tracking-tight text-white lg:text-3xl xl:text-4xl">
            {t("tagline")}
          </h1>
        </div>
      </div>

      {/* Right form panel — 40% */}
      <div
        className="flex w-full flex-col justify-center bg-white px-6 py-12 md:w-[40%] md:px-12 lg:px-16"
        dir={formDir}
        lang={locale}
      >
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4">
              <Image
                src="/Logo3.png"
                alt="AgencyOS"
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
            <h2 className="mb-1 text-3xl font-medium tracking-tight text-neutral-900">
              {t("getStarted")}
            </h2>
            <p className="text-sm text-neutral-500">
              {t("pleaseSignIn")}
            </p>
          </div>

          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
            spellCheck={false}
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-start text-sm text-neutral-700"
              >
                {t("email")}
              </label>
              <input
                type="email"
                id="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-black outline-none transition-colors focus:border-[#c8f542] focus:ring-1 focus:ring-[#c8f542]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-start text-sm text-neutral-700"
              >
                {t("password")}
              </label>
              {/* LTR wrapper so the visibility toggle stays on the correct side while the form is RTL. */}
              <div className="relative" dir="ltr">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  autoComplete="current-password"
                  placeholder={t("passwordPlaceholder")}
                  className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pe-10 ps-3 text-sm text-black outline-none transition-colors focus:border-[#c8f542] focus:ring-1 focus:ring-[#c8f542]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-700"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-start text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#c8f542] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#b8e532] disabled:opacity-60"
            >
              {loading ? t("signingIn") : t("loginButton")}
            </button>
          </form>

          <div
            className="mt-8 flex items-center justify-between gap-4"
            dir={formDir}
          >
            <LanguageToggle />
            <p className="text-xs text-neutral-400">
              AgencyOS © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
