import {
  AppWindow, Briefcase, Calculator, ShieldCheck, Building2, Calendar, ChartColumn, CreditCard, FileText, Gift, Layers, LayoutDashboard,
  LifeBuoy, MousePointerClick, Network, PenLine, Plug, RefreshCw, ShoppingBag, Smartphone, Code, User, Users, Workflow,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  app: AppWindow, briefcase: Briefcase, building: Building2, calendar: Calendar, chart: ChartColumn, card: CreditCard,
  form: FileText, gift: Gift, layers: Layers, dash: LayoutDashboard, buoy: LifeBuoy, pointer: MousePointerClick,
  network: Network, pen: PenLine, plug: Plug, refresh: RefreshCw, bag: ShoppingBag, phone: Smartphone, code: Code,
  calc: Calculator, shield: ShieldCheck, user: User, users: Users, flow: Workflow,
};

/** Decorative icon by name (Lucide, heavier stroke to match the brand). Falls back to a layers icon. */
export function Icon({ name, className }: { name?: string | null; className?: string }) {
  const C = (name && icons[name]) || Layers;
  return <C aria-hidden className={className} strokeWidth={2.5} />;
}
