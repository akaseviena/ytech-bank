"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, Calendar, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import GlassCard from "@/components/ui/GlassCard";
import GoldButton from "@/components/ui/GoldButton";
import { PLAN_INFO, type Plan } from "@/types";

const step1Schema = z
  .object({
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Min 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const step2Schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  dateOfBirth: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

const plans = Object.values(PLAN_INFO);

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("basic");
  const [serverError, setServerError] = useState("");
  const [formData, setFormData] = useState<Partial<Step1Data & Step2Data>>({});

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  async function onStep1(data: Step1Data) {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(2);
  }

  async function onStep2(data: Step2Data) {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(3);
  }

  const [finishing, setFinishing] = useState(false);

  async function onFinish() {
    setServerError("");
    setFinishing(true);

    // Step 1: Create user + profile via server-side API (uses service role key)
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        plan: selectedPlan,
      }),
    });

    const data = await res.json() as { error?: string };

    if (!res.ok) {
      setServerError(data.error ?? "Registration failed");
      setStep(1);
      setFinishing(false);
      return;
    }

    // Step 2: Sign in the newly created user
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: formData.email!,
      password: formData.password!,
    });

    if (signInError) {
      setServerError("Account created but sign-in failed: " + signInError.message);
      setFinishing(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const stepVariants = {
    enter: { opacity: 0, x: 100 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -100 },
  };

  return (
    <div className="w-full max-w-2xl">
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
          <img src="/logo.PNG" alt="Y-tech Bank" width={40} height={40} style={{ objectFit: "contain" }} />
        </div>
        <h1 className="font-sora font-bold text-2xl gold-text">Create your account</h1>
      </motion.div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-3 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-sora font-bold transition-all duration-300 ${
                s < step
                  ? "gold-gradient text-white"
                  : s === step
                  ? "border-2 border-[#F5A623] text-[#F5A623]"
                  : "border border-[#D0D0D0] text-[#9B9B9B]"
              }`}
            >
              {s < step ? <Check className="w-4 h-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`w-12 h-0.5 transition-all duration-300 ${
                  s < step ? "gold-gradient" : "bg-[#E5E5E5]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <GlassCard>
        <div className="p-8 overflow-hidden">
          {serverError && (
            <div className="mb-4 p-3 rounded-xl bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.2)] text-[#FF3B30] text-sm font-inter">
              {serverError}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
              >
                <h2 className="font-sora font-bold text-xl text-[#1A1A1A] mb-6">
                  Account credentials
                </h2>
                <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                      <input {...form1.register("email")} type="email" placeholder="you@example.com" className={`input-field pl-10 ${form1.formState.errors.email ? "error" : ""}`} />
                    </div>
                    {form1.formState.errors.email && <p className="mt-1 text-xs text-[#FF3B30] font-inter">{form1.formState.errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                      <input {...form1.register("password")} type={showPassword ? "text" : "password"} placeholder="••••••••" className={`input-field pl-10 pr-10 ${form1.formState.errors.password ? "error" : ""}`} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B]">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {form1.formState.errors.password && <p className="mt-1 text-xs text-[#FF3B30] font-inter">{form1.formState.errors.password.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                      <input {...form1.register("confirmPassword")} type={showPassword ? "text" : "password"} placeholder="••••••••" className={`input-field pl-10 ${form1.formState.errors.confirmPassword ? "error" : ""}`} />
                    </div>
                    {form1.formState.errors.confirmPassword && <p className="mt-1 text-xs text-[#FF3B30] font-inter">{form1.formState.errors.confirmPassword.message}</p>}
                  </div>
                  <GoldButton type="submit" size="lg" className="w-full mt-2">Continue</GoldButton>
                </form>
                <p className="mt-6 text-center font-inter text-sm text-[#6B6B6B]">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-[#F5A623] hover:text-[#C8860A] transition-colors">Sign in</Link>
                </p>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
              >
                <h2 className="font-sora font-bold text-xl text-[#1A1A1A] mb-6">Personal information</h2>
                <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">First name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                        <input {...form2.register("firstName")} placeholder="John" className={`input-field pl-10 ${form2.formState.errors.firstName ? "error" : ""}`} />
                      </div>
                      {form2.formState.errors.firstName && <p className="mt-1 text-xs text-[#FF3B30] font-inter">{form2.formState.errors.firstName.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Last name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                        <input {...form2.register("lastName")} placeholder="Doe" className={`input-field pl-10 ${form2.formState.errors.lastName ? "error" : ""}`} />
                      </div>
                      {form2.formState.errors.lastName && <p className="mt-1 text-xs text-[#FF3B30] font-inter">{form2.formState.errors.lastName.message}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Date of birth <span className="text-[#9B9B9B]">(optional)</span></label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                      <input {...form2.register("dateOfBirth")} type="date" className="input-field pl-10" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <GoldButton type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>Back</GoldButton>
                    <GoldButton type="submit" size="lg" className="flex-1">Continue</GoldButton>
                  </div>
                </form>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
              >
                <h2 className="font-sora font-bold text-xl text-[#1A1A1A] mb-2">Choose your plan</h2>
                <p className="font-inter text-sm text-[#6B6B6B] mb-6">You can change this anytime in Settings.</p>
                <div className="grid grid-cols-2 gap-3 mb-6 max-h-[420px] overflow-y-auto pr-1">
                  {plans.map((plan) => (
                    <motion.button
                      key={plan.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                        selectedPlan === plan.id
                          ? "border-[#F5A623] bg-[rgba(245,166,35,0.06)] shadow-[0_0_0_3px_rgba(245,166,35,0.15)]"
                          : "border-[#F0F0F0] bg-white hover:border-[rgba(245,166,35,0.4)] hover:shadow-[0_0_0_3px_rgba(245,166,35,0.08)]"
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute top-2 right-2 text-[10px] font-sora font-bold px-2 py-0.5 rounded-full gold-gradient text-white">Popular</span>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        {plan.emoji && <span className="text-lg">{plan.emoji}</span>}
                        <div>
                          <div className="font-sora font-bold text-sm text-[#1A1A1A]">{plan.name}</div>
                          <div className={`text-xs font-inter font-semibold ${selectedPlan === plan.id ? "text-[#F5A623]" : "text-[#6B6B6B]"}`}>{plan.price}</div>
                        </div>
                        {selectedPlan === plan.id && (
                          <div className="ml-auto w-5 h-5 rounded-full gold-gradient flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <ul className="space-y-1">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs font-inter text-[#6B6B6B]">
                            <Check className={`w-3 h-3 mt-0.5 flex-shrink-0 ${selectedPlan === plan.id ? "text-[#F5A623]" : "text-[#9B9B9B]"}`} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </motion.button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <GoldButton type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(2)} disabled={finishing}>Back</GoldButton>
                  <GoldButton type="button" size="lg" className="flex-1" onClick={onFinish} loading={finishing}>Create account</GoldButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>
    </div>
  );
}
