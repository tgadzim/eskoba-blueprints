import { db } from "../firebase/config.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function accessValueAllows(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function accessValueDenies(value) {
  return value === false || String(value).toLowerCase() === "false";
}

export async function getUserSubscription(userId) {
  try {
    const snapshot = await getDoc(doc(db, "users", userId));
    const data = snapshot.exists() ? snapshot.data() : {};
    const expiry = toDate(data.subscriptionExpiry);
    const status = String(data.subscriptionStatus || "").toLowerCase();
    const normalizedRole = String(data.role || "").toLowerCase();
    const isAdmin = normalizedRole === "admin" || normalizedRole === "superadmin";
    const expiryIsFuture = Boolean(expiry && expiry.getTime() > Date.now());
    const expired = status === "expired" || Boolean(expiry && !expiryIsFuture);
    const active = status === "active" && expiryIsFuture;

    return {
      profile: data,
      status: data.subscriptionStatus || "",
      plan: data.subscriptionPlan || "",
      expiry,
      access: data.access && typeof data.access === "object" ? data.access : null,
      isAdmin,
      active,
      expired
    };
  } catch (error) {
    console.warn("Unable to load subscription access; preserving existing access:", error);
    return {
      profile: {},
      status: "",
      plan: "",
      expiry: null,
      access: null,
      isAdmin: false,
      active: false,
      expired: false
    };
  }
}

export function canAccessModule(subscription, moduleId) {
  if (subscription.isAdmin) return true;
  return subscription.active && accessValueAllows(subscription.access?.[moduleId]);
}

export function getModuleLockMessage(subscription, moduleId) {
  if (subscription.isAdmin) return "";
  if (subscription.expired) return "Subscription expired";
  if (!subscription.active) return "Upgrade required";
  if (accessValueDenies(subscription.access?.[moduleId])) return "No access";
  return "Upgrade required";
}

export function withModuleAccess(modules, subscription) {
  return modules.map((module) => ({
    ...module,
    accessible: module.accessEligible && canAccessModule(subscription, module.id),
    subscriptionExpired: subscription.expired,
    lockMessage: module.comingSoon ? "Coming soon" : getModuleLockMessage(subscription, module.id)
  }));
}

export function formatSubscriptionExpiry(expiry) {
  if (!expiry) return "";
  return expiry.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
