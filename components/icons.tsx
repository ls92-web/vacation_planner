"use client";

import {
  Compass,
  Route,
  Sparkles,
  Sparkle,
  Star,
  Clock,
  Ticket,
  MapPin,
  Calendar,
  Footprints,
  Car,
  TrainFront,
  Plane,
  Ship,
  Heart,
  Plus,
  Check,
  ChevronDown,
  X,
  Trash2,
  GripVertical,
  SlidersHorizontal,
  Info,
  Download,
  Building,
  Building2,
  Home,
  Umbrella,
  BedDouble,
  TriangleAlert,
  Moon,
  Search,
  ArrowRight,
  CreditCard,
  Fish,
  FlaskConical,
  Landmark,
  Sun,
  Zap,
  Send,
  User,
  Train,
  Map,
  type LucideIcon,
} from "lucide-react";

import type { AccomType, TransportMode } from "@/lib/types";

export {
  Compass,
  Route,
  Sparkles,
  Sparkle,
  Star,
  Clock,
  Ticket,
  MapPin,
  Calendar,
  Footprints,
  Car,
  TrainFront,
  Plane,
  Ship,
  Heart,
  Plus,
  Check,
  ChevronDown,
  X,
  Trash2,
  GripVertical,
  SlidersHorizontal,
  Info,
  Download,
  Building,
  Building2,
  Home,
  Umbrella,
  BedDouble,
  TriangleAlert,
  Moon,
  Search,
  ArrowRight,
  CreditCard,
  Fish,
  FlaskConical,
  Landmark,
  Sun,
  Zap,
  Send,
  User,
  Train,
  Map,
};

export const ACCOM_ICONS: Record<AccomType, LucideIcon> = {
  Hotel: Building,
  Apartment: Building2,
  Airbnb: Home,
  Resort: Umbrella,
  Other: BedDouble,
};

export const MODE_ICONS: Record<TransportMode, LucideIcon> = {
  Drive: Car,
  Train: TrainFront,
  Flight: Plane,
  Ferry: Ship,
};

// Day-theme banner icons (replacing the prototype's decorative emoji).
export const DAY_ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  fish: Fish,
  flask: FlaskConical,
};

export const PACE_ICONS: Record<string, LucideIcon> = {
  sun: Sun,
  walk: Footprints,
  zap: Zap,
};

// Travel-mode glyph used in schedule "travel to next" rows.
export const TRAVEL_ICONS: Record<string, LucideIcon> = {
  Walk: Footprints,
  Metro: Train,
  Taxi: Car,
  Drive: Car,
};
