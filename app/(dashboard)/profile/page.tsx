"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Camera, User, Mail, Phone, Calendar, CreditCard, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/ui/PageTransition";
import GlassCard from "@/components/ui/GlassCard";
import GoldButton from "@/components/ui/GoldButton";
import { useToast } from "@/components/ui/Toast";
import { getInitials, formatDate } from "@/lib/utils";
import { PLAN_INFO, type Profile } from "@/types";

const schema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ProfilePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data as Profile);
        reset({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone ?? "",
          date_of_birth: data.date_of_birth ?? "",
        });
      }
    })();
  }, [reset]);

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone || null,
      date_of_birth: data.date_of_birth || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (!error) {
      showToast("success", "Profile updated");
      router.refresh();
    } else {
      showToast("error", "Update failed", error.message);
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!profile) return;
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `avatars/${profile.id}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", profile.id);
      setProfile((prev) => prev ? { ...prev, avatar_url: publicUrl } : prev);
      showToast("success", "Avatar updated");
    }
    setUploading(false);
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[#F5A623] border-t-transparent animate-spin" />
      </div>
    );
  }

  const planInfo = PLAN_INFO[profile.plan];

  return (
    <PageTransition>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="font-bold text-2xl text-[#1A1A1A]">Profile</h1>
          <p className="font-inter text-sm text-[#6B6B6B] mt-1">Manage your personal information</p>
        </div>

        <div className="space-y-6">
          {/* Avatar */}
          <GlassCard className="p-6 flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl gold-gradient flex items-center justify-center text-white text-2xl font-sora font-bold overflow-hidden">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : getInitials(profile.first_name, profile.last_name)
                }
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl gold-gradient flex items-center justify-center shadow-[0_2px_8px_rgba(245,166,35,0.3)]"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
            </div>
            <div>
              <h2 className="font-sora font-bold text-xl text-[#1A1A1A]">{profile.first_name} {profile.last_name}</h2>
              <p className="font-inter text-sm text-[#6B6B6B]">{profile.email}</p>
              <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-sora font-bold gold-gradient text-white">{planInfo?.name ?? profile.plan}</span>
            </div>
          </GlassCard>

          {/* Edit form */}
          <GlassCard className="p-6">
            <h3 className="font-sora font-bold text-base text-[#1A1A1A] mb-5">Personal Information</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">First name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                    <input {...register("first_name")} className={`input-field pl-10 ${errors.first_name ? "error" : ""}`} />
                  </div>
                  {errors.first_name && <p className="mt-1 text-xs text-[#FF3B30]">{errors.first_name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Last name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                    <input {...register("last_name")} className={`input-field pl-10 ${errors.last_name ? "error" : ""}`} />
                  </div>
                  {errors.last_name && <p className="mt-1 text-xs text-[#FF3B30]">{errors.last_name.message}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                  <input {...register("phone")} type="tel" placeholder="+1 234 567 890" className="input-field pl-10" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Date of birth</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                  <input {...register("date_of_birth")} type="date" className="input-field pl-10" />
                </div>
              </div>
              <GoldButton type="submit" loading={isSubmitting} size="lg" className="w-full">Save changes</GoldButton>
            </form>
          </GlassCard>

          {/* Read-only info */}
          <GlassCard className="p-6">
            <h3 className="font-sora font-bold text-base text-[#1A1A1A] mb-5">Account Information</h3>
            <div className="space-y-3">
              {[
                { label: "Email", value: profile.email, icon: Mail },
                { label: "Account Number", value: profile.account_number, icon: CreditCard },
                { label: "Member since", value: formatDate(profile.created_at), icon: Calendar },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-2xl bg-[rgba(245,166,35,0.04)] border border-[rgba(245,166,35,0.1)]">
                  <Icon className="w-4 h-4 text-[#9B9B9B]" />
                  <div className="flex-1 flex justify-between">
                    <span className="font-inter text-sm text-[#6B6B6B]">{label}</span>
                    <span className="font-inter text-sm font-medium text-[#1A1A1A]">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Current plan */}
          <GlassCard gold className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-sora font-bold text-base text-[#1A1A1A]">Current Plan</h3>
              <a href="/settings" className="font-inter text-sm font-semibold text-[#F5A623] hover:text-[#C8860A] transition-colors">Change plan</a>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{planInfo?.emoji ?? "💳"}</span>
              <div>
                <p className="font-sora font-bold text-lg text-[#1A1A1A]">{planInfo?.name ?? profile.plan}</p>
                <p className="font-inter text-sm text-[#6B6B6B]">{planInfo?.price}</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </PageTransition>
  );
}
