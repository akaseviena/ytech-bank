"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import GlassCard from "@/components/ui/GlassCard";
import GoldButton from "@/components/ui/GoldButton";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState("");
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    setSent(true);
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
          style={{ border: "1.5px solid rgba(245,166,35,0.5)", background: "rgba(255,255,255,0.9)" }}
        >
          <img src="/logo.PNG" alt="Y-tech" width={40} height={40} style={{ objectFit: "contain" }} />
        </div>
        <h1 className="font-bold text-2xl gold-text">Y-tech</h1>
        <p className="text-sm text-[#6B6B6B] mt-1">Reset your password</p>
      </motion.div>

      <GlassCard>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-8"
        >
          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-4xl mb-4">📬</div>
              <h2 className="font-bold text-xl text-[#1A1A1A] mb-3">Check your email</h2>
              <p className="text-sm text-[#6B6B6B] font-inter leading-relaxed">
                If an account exists for that address, you&apos;ll receive a password reset link shortly.
              </p>
              <p className="mt-6 text-center font-inter text-sm text-[#6B6B6B]">
                <Link href="/login" className="font-semibold text-[#F5A623] hover:text-[#C8860A] transition-colors">
                  Back to login
                </Link>
              </p>
            </motion.div>
          ) : (
            <>
              <h2 className="font-bold text-xl text-[#1A1A1A] mb-2">Forgot password?</h2>
              <p className="text-sm text-[#6B6B6B] font-inter mb-6">
                Enter your email and we&apos;ll send you a reset link.
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
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                    <input
                      {...register("email")}
                      type="email"
                      placeholder="you@example.com"
                      className={`input-field pl-10 ${errors.email ? "error" : ""}`}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-xs text-[#FF3B30] font-inter">{errors.email.message}</p>
                  )}
                </div>

                <GoldButton
                  type="submit"
                  loading={isSubmitting}
                  size="lg"
                  className="w-full mt-2"
                >
                  Send reset link
                </GoldButton>
              </form>

              <p className="mt-6 text-center font-inter text-sm text-[#6B6B6B]">
                Remember your password?{" "}
                <Link href="/login" className="font-semibold text-[#F5A623] hover:text-[#C8860A] transition-colors">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </GlassCard>
    </div>
  );
}
