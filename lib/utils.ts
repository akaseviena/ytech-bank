import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: string = "EUR"
): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: string): string {
  return format(new Date(date), "MMM d, yyyy · HH:mm");
}

export function formatRelativeTime(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function maskCardNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

export function generateCardExpiry(createdAt: string): string {
  const date = new Date(createdAt);
  date.setFullYear(date.getFullYear() + 4);
  return format(date, "MM/yy");
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
