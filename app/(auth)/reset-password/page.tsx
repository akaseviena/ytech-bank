"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import GlassCard from "@/components/ui/GlassCard";
import GoldButton from "@/components/ui/GoldButton";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState("");
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const supabase = createClient();

    // Check if there's already a valid recovery session (e.g. page reload after event fired)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
      } else if (event === "SIGNED_OUT" || (!session && !ready)) {
        // No recovery session arrived — link is invalid or expired
        setInvalidLink(true);
      }
    });

    // If no event fires within 3 seconds, treat as invalid link
    const timeout = setTimeout(() => {
      setInvalidLink((prev) => {
        if (!ready) return true;
        return prev;
      });
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(data: FormData) {
    setServerError("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setServerError(error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center mb-8"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ border: "1.5px solid rgba(245,200,0,0.5)", background: "rgba(255,255,255,0.9)" }}
        >
          <img src="/logo.PNG" alt="Y-tech" width={40} height={40} style={{ objectFit: "contain" }} />
        </div>
        <h1 className="font-bold text-2xl gold-text">Y-tech</h1>
        <p className="text-sm text-[#6B6B6B] mt-1">Set a new password</p>
      </motion.div>

      <GlassCard>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-8"
        >
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-4xl mb-4">✅</div>
              <h2 className="font-bold text-xl text-[#1A1A1A] mb-3">Password updated!</h2>
              <p className="text-sm text-[#6B6B6B] font-inter">Redirecting you to login…</p>
            </motion.div>
          ) : invalidLink && !ready ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-4xl mb-4">🔗</div>
              <h2 className="font-bold text-xl text-[#1A1A1A] mb-3">Link expired or invalid</h2>
              <p className="text-sm text-[#6B6B6B] font-inter leading-relaxed mb-6">
                This password reset link has expired or is invalid. Reset links are single-use and expire after a short time.
              </p>
              <Link
                href="/forgot-password"
                className="inline-block font-semibold text-sm text-[#F5C800] hover:text-[#EFC000] transition-colors"
              >
                Request a new reset link →
              </Link>
            </motion.div>
          ) : !ready ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-[#F5C800] border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              <h2 className="font-bold text-xl text-[#1A1A1A] mb-2">New password</h2>
              <p className="text-sm text-[#6B6B6B] font-inter mb-6">
                Choose a strong password with at least 8 characters.
              </p>

              {serverError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4 p-3 rounded-xl bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.2)] text-[#FF3B30] text-sm font-inter"
                >
                  {serverError}
                </motion.div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                    <input
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className={`input-field pl-10 pr-10 ${errors.password ? "error" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-[#FF3B30] font-inter">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                    <input
                      {...register("confirm")}
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      className={`input-field pl-10 pr-10 ${errors.confirm ? "error" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirm && (
                    <p className="mt-1 text-xs text-[#FF3B30] font-inter">{errors.confirm.message}</p>
                  )}
                </div>

                <GoldButton
                  type="submit"
                  loading={isSubmitting}
                  size="lg"
                  className="w-full mt-2"
                >
                  Update password
                </GoldButton>
              </form>
            </>
          )}
        </motion.div>
      </GlassCard>
    </div>
  );
}
