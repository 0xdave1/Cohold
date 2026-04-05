"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/hooks/use-auth";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api/errors";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoholdLogo } from "@/components/auth/CoholdLogo";
import { auth } from "@/components/auth/auth-styles";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function Eye({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);
    try {
      const res = await login.mutateAsync(values);
      if (!res.success) setError(res.error ?? "Unable to login. Please try again.");
    } catch (e: unknown) {
      if (getApiErrorCode(e) === "OTP_NOT_VERIFIED") {
        router.push(
          `/auth/verify-otp?email=${encodeURIComponent(values.email)}&purpose=signup`,
        );
        return;
      }
      setError(
        getApiErrorMessage(
          e,
          "Unable to login. Check your email and password, and ensure the backend is running.",
        ),
      );
    }
  };

  return (
    <main className={auth.card}>
      <p className={auth.pageTitle}>login</p>
      <div className="mt-6 flex flex-col items-center text-center">
        <CoholdLogo className="mb-4" />
        <h1 className={auth.heading}>Welcome back to Cohold</h1>
        <p className={"mt-2 " + auth.body}>Enter your details below to login to your account</p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <div className="space-y-1.5">
          <label className={auth.label}>Email address</label>
          <input type="email" placeholder="doe@mail.com" className={auth.input} {...form.register("email")} />
          {form.formState.errors.email && <p className={auth.error}>{form.formState.errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className={auth.label}>Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              className={auth.input + " " + auth.inputWithIcon}
              {...form.register("password")}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-auth-body hover:text-auth-heading" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {form.formState.errors.password && <p className={auth.error}>{form.formState.errors.password.message}</p>}
          <div className="text-right">
            <Link href="/forgot-password" className={"text-sm " + auth.link}>Forgot password?</Link>
          </div>
        </div>
        {error && <div className={auth.errorBox}>{error}</div>}
        <button type="submit" disabled={login.isPending} className={auth.btnPrimary}>
          {login.isPending ? "Logging in..." : "Login"}
        </button>
      </form>
      <p className={"mt-6 " + auth.footerText}>
        Don&apos;t have an account? <Link href="/signup" className={auth.link}>Create account</Link>
      </p>
    </main>
  );
}