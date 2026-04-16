"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { Eye, EyeOff, Monitor, Moon, Sun, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  updateMyAvatar,
  updateMyEmail,
  updateMyName,
  updateMyPassword,
  updateMyThemePreference,
  type MyAccount,
} from "@/actions/account";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialAccount: MyAccount;
  isMember: boolean;
};

function initialsFromName(name: string) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "?";
}

function errorMessage(code: string): string {
  switch (code) {
    case "email_exists":
      return "هذا البريد الإلكتروني مستخدم بالفعل.";
    case "wrong_current_password":
      return "كلمة المرور الحالية غير صحيحة.";
    case "validation":
      return "تأكد من صحة البيانات (الحد الأدنى لكلمة المرور 8 أحرف).";
    case "unauthorized":
      return "الجلسة انتهت، يرجى تسجيل الدخول من جديد.";
    case "not_found":
      return "لم يتم العثور على الحساب.";
    default:
      return "حدث خطأ غير متوقع.";
  }
}

export function AccountSettingsForm({ initialAccount, isMember: _isMember }: Props) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const { theme, setTheme } = useTheme();

  const [account, setAccount] = React.useState<MyAccount>(initialAccount);
  const [displayName, setDisplayName] = React.useState(initialAccount.name);
  const [savingName, setSavingName] = React.useState(false);
  const [email, setEmail] = React.useState(initialAccount.email);
  const [savingEmail, setSavingEmail] = React.useState(false);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmNewPassword, setConfirmNewPassword] = React.useState("");
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [savingPassword, setSavingPassword] = React.useState(false);

  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialAccount.themePreference && initialAccount.themePreference !== theme) {
      setTheme(initialAccount.themePreference);
    }
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error("الاسم مطلوب.");
      return;
    }
    setSavingName(true);
    try {
      const res = await updateMyName({ name: trimmed });
      if (res.ok) {
        toast.success("تم تحديث الاسم.");
        setAccount((prev) => ({ ...prev, name: trimmed }));
        setDisplayName(trimmed);
        await updateSession({ user: { name: trimmed } });
        router.refresh();
      } else {
        toast.error(errorMessage(res.error));
      }
    } finally {
      setSavingName(false);
    }
  }

  async function onSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("البريد الإلكتروني مطلوب.");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await updateMyEmail({ email: trimmed });
      if (res.ok) {
        toast.success("تم تحديث البريد الإلكتروني.");
        setAccount((prev) => ({ ...prev, email: trimmed }));
        await updateSession({ user: { email: trimmed } });
        router.refresh();
      } else {
        toast.error(errorMessage(res.error));
      }
    } finally {
      setSavingEmail(false);
    }
  }

  async function onSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("كلمتا المرور غير متطابقتين.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await updateMyPassword({
        currentPassword,
        newPassword,
      });
      if (res.ok) {
        toast.success("تم تحديث كلمة المرور.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        toast.error(errorMessage(res.error));
      }
    } finally {
      setSavingPassword(false);
    }
  }

  async function onUploadAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("scope", "team-avatar");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploaded = (await uploadRes.json()) as { url?: string; error?: string };
      if (!uploadRes.ok || !uploaded.url) {
        toast.error(uploaded.error ?? "تعذّر رفع الصورة.");
        return;
      }
      const res = await updateMyAvatar({ avatarUrl: uploaded.url });
      if (res.ok) {
        toast.success("تم تحديث الصورة الشخصية.");
        setAccount((prev) => ({ ...prev, avatarUrl: uploaded.url ?? null }));
        await updateSession({
          user: {
            avatarUrl: uploaded.url ?? null,
            image: uploaded.url ?? undefined,
          },
        });
        router.refresh();
      } else {
        toast.error(errorMessage(res.error));
      }
    } catch (e) {
      console.error(e);
      toast.error("تعذّر رفع الصورة.");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function onRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      const res = await updateMyAvatar({ avatarUrl: null });
      if (res.ok) {
        toast.success("تمت إزالة الصورة الشخصية.");
        setAccount((prev) => ({ ...prev, avatarUrl: null }));
        await updateSession({
          user: { avatarUrl: null, image: undefined },
        });
        router.refresh();
      } else {
        toast.error(errorMessage(res.error));
      }
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onSelectTheme(value: "light" | "dark" | "system") {
    setTheme(value);
    setAccount((prev) => ({ ...prev, themePreference: value }));
    const res = await updateMyThemePreference({ theme: value });
    if (!res.ok) {
      toast.error(errorMessage(res.error));
    }
  }

  const currentTheme = (theme ?? account.themePreference ?? "system") as "light" | "dark" | "system";

  const themeOptions: { value: "light" | "dark" | "system"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "light", label: "فاتح", icon: Sun },
    { value: "dark", label: "داكن", icon: Moon },
    { value: "system", label: "تلقائي", icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">الصورة الشخصية</CardTitle>
          <CardDescription>اختر صورة لعرضها في لوحة التحكم.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={account.avatarUrl ?? undefined} alt={account.name} />
              <AvatarFallback className="text-lg">{initialsFromName(account.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onUploadAvatar(file);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Upload className="ms-0 me-2 h-4 w-4" />
                {uploadingAvatar ? "جارٍ الحفظ…" : "رفع صورة"}
              </Button>
              {account.avatarUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingAvatar}
                  onClick={() => void onRemoveAvatar()}
                >
                  <X className="ms-0 me-2 h-4 w-4" />
                  إزالة
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">الاسم</CardTitle>
          <CardDescription>يظهر في لوحة التحكم والإشعارات.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-name">الاسم الكامل</Label>
              <Input
                id="account-name"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={savingName || displayName.trim() === account.name.trim()}
            >
              {savingName ? "جارٍ الحفظ…" : "حفظ الاسم"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">البريد الإلكتروني</CardTitle>
          <CardDescription>يُستخدم لتسجيل الدخول.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSaveEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-email">البريد الإلكتروني</Label>
              <Input
                id="account-email"
                type="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={savingEmail || email.trim().toLowerCase() === account.email.toLowerCase()}>
              {savingEmail ? "جارٍ الحفظ…" : "حفظ البريد"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">كلمة المرور</CardTitle>
          <CardDescription>
            لتغيير كلمة المرور يجب إدخال كلمة المرور الحالية. اضغط على أيقونة العين لإظهار الكلمة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSavePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">كلمة المرور الحالية</Label>
              <div className="relative" dir="ltr">
                <Input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
                  aria-label={showCurrent ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  title={showCurrent ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
              <div className="relative" dir="ltr">
                <Input
                  id="new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
                  aria-label={showNew ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  title={showNew ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">تأكيد كلمة المرور الجديدة</Label>
              <div className="relative" dir="ltr">
                <Input
                  id="confirm-new-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
                  aria-label={showConfirm ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  title={showConfirm ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? "جارٍ الحفظ…" : "تحديث كلمة المرور"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">مظهر النظام</CardTitle>
          <CardDescription>اختر الوضع الذي يناسبك.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {themeOptions.map(({ value, label, icon: Icon }) => {
              const selected = currentTheme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => void onSelectTheme(value)}
                  className={`flex w-28 cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
