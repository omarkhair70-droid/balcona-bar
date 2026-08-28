"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  CreditCard,
  Languages,
  MessageCircle,
  Minus,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
  Utensils,
  WalletCards,
  X
} from "lucide-react";
import { useState, type ReactNode } from "react";

type Locale = "en" | "ar";
type View = "menu" | "order" | "service" | "bill";
type OrderState = "draft" | "submitted" | "accepted" | "preparing" | "ready" | "served";
type BillState = "idle" | "requested" | "presented" | "paying" | "paid" | "unknown";

type MenuItem = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: number;
  category: "coffee" | "cold" | "dessert" | "food";
  featured?: boolean;
  available?: boolean;
  visual: "latte" | "matcha" | "cake" | "burger" | "croissant" | "coffee";
};

type CartItem = {
  item: MenuItem;
  quantity: number;
  modifier?: string;
};

const menuItems: MenuItem[] = [
  {
    id: "spanish-latte",
    nameEn: "Spanish Latte",
    nameAr: "سبانيش لاتيه",
    descriptionEn: "Espresso, silky milk, balanced sweetness.",
    descriptionAr: "إسبريسو، لبن ناعم، حلاوة متوازنة.",
    price: 95,
    category: "coffee",
    featured: true,
    visual: "latte"
  },
  {
    id: "iced-matcha",
    nameEn: "Iced Matcha",
    nameAr: "آيس ماتشا",
    descriptionEn: "Ceremonial matcha, milk, ice.",
    descriptionAr: "ماتشا، لبن، ثلج.",
    price: 110,
    category: "cold",
    featured: true,
    visual: "matcha"
  },
  {
    id: "basque",
    nameEn: "Basque Cheesecake",
    nameAr: "باسك تشيزكيك",
    descriptionEn: "Burnt top, soft center, served chilled.",
    descriptionAr: "سطح محمّر، قلب طري، يقدم بارد.",
    price: 135,
    category: "dessert",
    featured: true,
    available: false,
    visual: "cake"
  },
  {
    id: "burger",
    nameEn: "Balcona Burger",
    nameAr: "برجر بلكونة",
    descriptionEn: "Beef, cheddar, house sauce, brioche.",
    descriptionAr: "لحم، شيدر، صوص بلكونة، خبز بريوش.",
    price: 185,
    category: "food",
    visual: "burger"
  },
  {
    id: "croissant",
    nameEn: "Butter Croissant",
    nameAr: "كرواسون زبدة",
    descriptionEn: "Flaky, warm, baked for the session.",
    descriptionAr: "هش ودافئ، مخبوز للجلسة.",
    price: 75,
    category: "food",
    visual: "croissant"
  },
  {
    id: "flat-white",
    nameEn: "Flat White",
    nameAr: "فلات وايت",
    descriptionEn: "Double espresso with velvety microfoam.",
    descriptionAr: "دبل إسبريسو مع فوم ناعم.",
    price: 90,
    category: "coffee",
    visual: "coffee"
  }
];

function L(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function itemName(locale: Locale, item: MenuItem) {
  return locale === "ar" ? item.nameAr : item.nameEn;
}

function itemDescription(locale: Locale, item: MenuItem) {
  return locale === "ar" ? item.descriptionAr : item.descriptionEn;
}

function money(value: number) {
  return `${value} EGP`;
}

function ProductVisual({ kind, compact = false }: { kind: MenuItem["visual"]; compact?: boolean }) {
  const iconClass = compact ? "size-5" : "size-9";
  const visual =
    kind === "latte" || kind === "coffee" ? <Coffee className={iconClass} /> :
    kind === "cake" ? <Sparkles className={iconClass} /> :
    kind === "burger" ? <Utensils className={iconClass} /> :
    kind === "croissant" ? <Utensils className={iconClass} /> :
    <Coffee className={iconClass} />;

  const gradient =
    kind === "matcha"
      ? "from-[#A4B77A] via-[#D5D8B1] to-[#EAE2D5]"
      : kind === "cake"
        ? "from-[#B77A62] via-[#D9B7A1] to-[#F0DED1]"
        : kind === "burger"
          ? "from-[#8F5C3E] via-[#C28B5A] to-[#E6C095]"
          : kind === "croissant"
            ? "from-[#C78945] via-[#E6BA77] to-[#F2D7A8]"
            : "from-[#6D4936] via-[#B9815B] to-[#E3C09B]";

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} ${compact ? "size-12 rounded-xl" : "aspect-[4/3] w-full rounded-[22px]"}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(255,255,255,.6),transparent_24%),radial-gradient(circle_at_18%_80%,rgba(70,35,18,.18),transparent_36%)]" />
      <div className="absolute inset-0 flex items-center justify-center text-[#3D2B21]/70">
        {visual}
      </div>
    </div>
  );
}

function SessionHeader({
  locale,
  onLocale
}: {
  locale: Locale;
  onLocale: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E8DFD5] bg-[#FFF9F2]/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-md items-center justify-between gap-3 px-4">
        <div>
          <p className="text-sm font-black tracking-[-0.02em] text-[#2B211B]">Balcona</p>
          <p className="text-[10px] font-semibold text-[#8B776A]">
            {L(locale, "Balkona Main · Table T12", "بلكونة الرئيسي · ترابيزة T12")}
          </p>
        </div>
        <button
          type="button"
          onClick={onLocale}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-[#DED3C8] bg-white px-3 text-xs font-bold text-[#5A493E]"
        >
          <Languages className="size-3.5" />
          {locale === "en" ? "AR" : "EN"}
        </button>
      </div>
    </header>
  );
}

function BottomNav({
  locale,
  active,
  onChange,
  orderState,
  billState
}: {
  locale: Locale;
  active: View;
  onChange: (view: View) => void;
  orderState: OrderState;
  billState: BillState;
}) {
  const items: Array<{ id: View; en: string; ar: string; icon: typeof Coffee }> = [
    { id: "menu", en: "Menu", ar: "المنيو", icon: Coffee },
    { id: "order", en: "Order", ar: "الطلب", icon: Clock3 },
    { id: "service", en: "Service", ar: "الخدمة", icon: Bell },
    { id: "bill", en: "Bill", ar: "الفاتورة", icon: Receipt }
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-[#E5DBD1] bg-[#FFF9F2]/96 px-2 pb-[calc(.55rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="grid grid-cols-4 gap-1">
        {items.map((entry) => {
          const Icon = entry.icon;
          const activeItem = active === entry.id;
          const hasSignal =
            (entry.id === "order" && !["draft", "served"].includes(orderState)) ||
            (entry.id === "bill" && ["requested", "presented", "paying", "unknown"].includes(billState));

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onChange(entry.id)}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition ${
                activeItem ? "bg-[#2F2119] text-[#FFF7EF]" : "text-[#816F63]"
              }`}
            >
              <Icon className="size-4" />
              {L(locale, entry.en, entry.ar)}
              {hasSignal && !activeItem ? <span className="absolute end-3 top-2 size-1.5 rounded-full bg-[#C27043]" /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function AiPrompt({
  locale,
  onOpen
}: {
  locale: Locale;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-[20px] border border-[#E3D7CB] bg-[#F7EBDD] p-3 text-start"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6B3F2D] text-[#FFF9F3]">
        <Sparkles className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-[#3A2A20]">
          {L(locale, "Not sure what to order?", "مش عارف تطلب إيه؟")}
        </span>
        <span className="mt-0.5 block text-xs text-[#7D675A]">
          {L(locale, "Ask Balcona AI — it knows this menu.", "اسأل نادل بلكونة الذكي — فاهم المنيو دي.")}
        </span>
      </span>
      <ChevronRight className="ms-auto size-4 shrink-0 text-[#9A8374] rtl:rotate-180" />
    </button>
  );
}

function MenuView({
  locale,
  cart,
  onSelectItem,
  onOpenAi,
  onOpenCart
}: {
  locale: Locale;
  cart: CartItem[];
  onSelectItem: (item: MenuItem) => void;
  onOpenAi: () => void;
  onOpenCart: () => void;
}) {
  const [category, setCategory] = useState<"all" | MenuItem["category"]>("all");
  const categories: Array<{ id: "all" | MenuItem["category"]; en: string; ar: string }> = [
    { id: "all", en: "For you", ar: "ليك" },
    { id: "coffee", en: "Coffee", ar: "قهوة" },
    { id: "cold", en: "Cold", ar: "بارد" },
    { id: "food", en: "Food", ar: "أكل" },
    { id: "dessert", en: "Dessert", ar: "حلويات" }
  ];
  const visible = category === "all" ? menuItems : menuItems.filter((item) => item.category === category);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + item.item.price * item.quantity, 0);

  return (
    <main className="mx-auto max-w-md px-4 pb-36 pt-4">
      <section className="rounded-[28px] bg-[#2F2119] p-5 text-[#FFF7EF]">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#CDAF98]">
          {L(locale, "Your table is live", "جلستك شغالة")}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
          {L(locale, "What feels right?", "نطلب إيه؟")}
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-6 text-[#D6C6BA]">
          {L(locale, "Order from the table, follow it live, and call us only when you need us.", "اطلب من الترابيزة، تابع طلبك، ونادينا وقت ما تحتاج.")}
        </p>
      </section>

      <div className="mt-4">
        <AiPrompt locale={locale} onOpen={onOpenAi} />
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {categories.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setCategory(entry.id)}
            className={`min-h-9 shrink-0 rounded-full px-4 text-xs font-black ${
              category === entry.id
                ? "bg-[#2F2119] text-[#FFF7EF]"
                : "border border-[#DED3C8] bg-white text-[#725E51]"
            }`}
          >
            {L(locale, entry.en, entry.ar)}
          </button>
        ))}
      </div>

      <section className="mt-5 grid grid-cols-2 gap-3">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.available === false}
            onClick={() => onSelectItem(item)}
            className="overflow-hidden rounded-[24px] border border-[#E7DDD3] bg-white p-2 text-start shadow-[0_8px_26px_rgba(75,48,31,.06)] disabled:opacity-55"
          >
            <ProductVisual kind={item.visual} />
            <div className="px-1 pb-2 pt-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-black leading-5 text-[#34271F]">{itemName(locale, item)}</h2>
                {item.featured ? <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[#B7794C]" /> : null}
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#8A7668]">{itemDescription(locale, item)}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <strong className="text-xs text-[#49372B]">{money(item.price)}</strong>
                {item.available === false ? (
                  <span className="text-[10px] font-black text-[#A15B50]">{L(locale, "Unavailable", "غير متاح")}</span>
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#EEE4DA] text-[#4C392D]">
                    <Plus className="size-3.5" />
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </section>

      {cartCount > 0 ? (
        <button
          type="button"
          onClick={onOpenCart}
          className="fixed bottom-[5.15rem] start-1/2 z-30 flex min-h-14 w-[calc(100%-2rem)] max-w-[416px] -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#6A3F2D] px-4 text-start text-white shadow-[0_16px_40px_rgba(60,34,22,.25)] rtl:translate-x-1/2"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-xs font-black">{cartCount}</span>
          <span>
            <span className="block text-sm font-black">{L(locale, "View cart", "عرض السلة")}</span>
            <span className="block text-[10px] text-white/70">{L(locale, "Ready when you are", "جاهزة لما تحب")}</span>
          </span>
          <strong className="ms-auto text-sm">{money(cartTotal)}</strong>
        </button>
      ) : null}
    </main>
  );
}

function ItemSheet({
  locale,
  item,
  onClose,
  onAdd
}: {
  locale: Locale;
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem, modifier?: string) => void;
}) {
  const [modifier, setModifier] = useState("Regular milk");
  if (!item) return null;

  return (
    <>
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-40 bg-black/35" />
      <section className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] max-w-md overflow-y-auto rounded-t-[30px] bg-[#FFF9F2] p-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <span className="h-1 w-12 rounded-full bg-[#D9CEC4]" />
          <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-full border border-[#E1D7CD] bg-white text-[#6F5E52]">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3">
          <ProductVisual kind={item.visual} />
        </div>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.03em] text-[#32251D]">{itemName(locale, item)}</h2>
            <p className="mt-2 text-sm leading-6 text-[#816D60]">{itemDescription(locale, item)}</p>
          </div>
          <strong className="shrink-0 text-base text-[#523B2E]">{money(item.price)}</strong>
        </div>

        {(item.category === "coffee" || item.category === "cold") ? (
          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-[#7D695C]">{L(locale, "Milk", "اللبن")}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["Regular milk", "Oat milk", "No milk"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setModifier(value)}
                  className={`min-h-11 rounded-xl border px-2 text-xs font-bold ${
                    modifier === value ? "border-[#6A3F2D] bg-[#F0E3D8] text-[#4B3428]" : "border-[#E1D7CD] bg-white text-[#806D61]"
                  }`}
                >
                  {value === "Regular milk"
                    ? L(locale, "Regular", "عادي")
                    : value === "Oat milk"
                      ? L(locale, "Oat", "شوفان")
                      : L(locale, "No milk", "بدون لبن")}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => onAdd(item, (item.category === "coffee" || item.category === "cold") ? modifier : undefined)}
          className="mt-6 min-h-14 w-full rounded-2xl bg-[#2F2119] px-4 text-sm font-black text-[#FFF7EF]"
        >
          {L(locale, "Add to cart", "أضف للسلة")} · {money(item.price)}
        </button>
      </section>
    </>
  );
}

function CartSheet({
  locale,
  cart,
  onClose,
  onQuantity,
  onSubmit
}: {
  locale: Locale;
  cart: CartItem[];
  onClose: () => void;
  onQuantity: (id: string, delta: number) => void;
  onSubmit: () => void;
}) {
  const total = cart.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);

  return (
    <>
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-40 bg-black/35" />
      <section className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] max-w-md overflow-y-auto rounded-t-[30px] bg-[#FFF9F2] p-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8D786A]">{L(locale, "Table T12", "ترابيزة T12")}</p>
            <h2 className="mt-1 text-2xl font-black text-[#33261E]">{L(locale, "Your cart", "سلتك")}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-full border border-[#E1D7CD] bg-white">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-[#ECE2D8]">
          {cart.map((entry) => (
            <div key={entry.item.id} className="flex gap-3 py-3">
              <ProductVisual kind={entry.item.visual} compact />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-[#372A21]">{itemName(locale, entry.item)}</p>
                {entry.modifier ? <p className="mt-0.5 text-[11px] text-[#8A7668]">{entry.modifier}</p> : null}
                <p className="mt-1 text-xs font-bold text-[#685145]">{money(entry.item.price * entry.quantity)}</p>
              </div>
              <div className="flex items-center gap-2 self-center rounded-full border border-[#E0D5CB] bg-white p-1">
                <button type="button" onClick={() => onQuantity(entry.item.id, -1)} className="flex size-7 items-center justify-center rounded-full text-[#68564A]"><Minus className="size-3" /></button>
                <span className="min-w-5 text-center text-xs font-black">{entry.quantity}</span>
                <button type="button" onClick={() => onQuantity(entry.item.id, 1)} className="flex size-7 items-center justify-center rounded-full bg-[#EEE3D8] text-[#4E3B30]"><Plus className="size-3" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-[#F3E9DF] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#786457]">{L(locale, "Subtotal", "المجموع")}</span>
            <strong className="text-[#3B2D24]">{money(total)}</strong>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[#8B776A]">
            {L(locale, "Availability is checked again before the order is submitted.", "بنتأكد من الإتاحة مرة ثانية قبل إرسال الطلب.")}
          </p>
        </div>

        <button
          type="button"
          disabled={cart.length === 0}
          onClick={onSubmit}
          className="mt-4 min-h-14 w-full rounded-2xl bg-[#6A3F2D] text-sm font-black text-white disabled:opacity-50"
        >
          {L(locale, "Place order", "إرسال الطلب")}
        </button>
      </section>
    </>
  );
}

function OrderView({
  locale,
  state,
  onAdvance
}: {
  locale: Locale;
  state: OrderState;
  onAdvance: () => void;
}) {
  if (state === "draft") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-5 pb-28">
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#F0E4D9] text-[#6A3F2D]"><ShoppingBag className="size-5" /></span>
          <h1 className="mt-4 text-xl font-black text-[#33261E]">{L(locale, "No order yet", "لسه مفيش طلب")}</h1>
          <p className="mt-2 text-sm leading-6 text-[#857164]">{L(locale, "Your table is ready. Start from the menu whenever you like.", "ترابيزتك جاهزة. ابدأ من المنيو وقت ما تحب.")}</p>
        </div>
      </main>
    );
  }

  const timeline: Array<{ id: OrderState; en: string; ar: string }> = [
    { id: "submitted", en: "Sent to Balcona", ar: "الطلب اتبعت لبلكونة" },
    { id: "accepted", en: "Accepted", ar: "تم قبول الطلب" },
    { id: "preparing", en: "Being prepared", ar: "بيتجهز" },
    { id: "ready", en: "Ready to serve", ar: "جاهز للتقديم" },
    { id: "served", en: "Served", ar: "تم التقديم" }
  ];
  const currentIndex = timeline.findIndex((entry) => entry.id === state);

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-5">
      <div className="rounded-[28px] bg-[#2F2119] p-5 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#CDB29F]">#ORD-10428 · T12</p>
        <h1 className="mt-2 text-2xl font-black tracking-[-0.03em]">
          {state === "submitted"
            ? L(locale, "We got your order", "طلبك وصل")
            : state === "accepted"
              ? L(locale, "Confirmed", "اتأكد")
              : state === "preparing"
                ? L(locale, "It's being made", "بيتحضر دلوقتي")
                : state === "ready"
                  ? L(locale, "Ready for you", "طلبك جاهز")
                  : L(locale, "Enjoy", "بالهنا")}
        </h1>
        <p className="mt-2 text-sm text-[#D8C8BC]">{L(locale, "2 items · 230 EGP", "منتجين · 230 جنيه")}</p>
      </div>

      <section className="mt-5 rounded-[24px] border border-[#E6DCD2] bg-white p-4">
        {timeline.map((entry, index) => {
          const done = index <= currentIndex;
          const current = index === currentIndex;
          return (
            <div key={entry.id} className="flex gap-3">
              <div className="flex w-6 flex-col items-center">
                <span className={`flex size-6 items-center justify-center rounded-full border ${
                  done ? "border-[#6A3F2D] bg-[#6A3F2D] text-white" : "border-[#DDD2C8] bg-white text-[#B1A196]"
                }`}>
                  {done ? <Check className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                {index < timeline.length - 1 ? <span className={`h-9 w-px ${index < currentIndex ? "bg-[#6A3F2D]" : "bg-[#E5DCD3]"}`} /> : null}
              </div>
              <div className="pb-5">
                <p className={`text-sm font-black ${current ? "text-[#33261E]" : done ? "text-[#6C584C]" : "text-[#A49489]"}`}>
                  {L(locale, entry.en, entry.ar)}
                </p>
                {current ? <p className="mt-1 text-xs text-[#8C786B]">{L(locale, "Live status from the restaurant", "حالة مباشرة من المكان")}</p> : null}
              </div>
            </div>
          );
        })}
      </section>

      {state !== "served" ? (
        <button
          type="button"
          onClick={onAdvance}
          className="mt-4 min-h-11 w-full rounded-xl border border-dashed border-[#D9CCC1] bg-[#F8EFE7] text-xs font-black text-[#70584A]"
        >
          {L(locale, "Prototype: advance order state", "بروتوتايب: حرّك حالة الطلب")}
        </button>
      ) : null}
    </main>
  );
}

function ServiceView({
  locale,
  waiterCalled,
  billState,
  onWaiter,
  onBill,
  onOpenAi
}: {
  locale: Locale;
  waiterCalled: boolean;
  billState: BillState;
  onWaiter: () => void;
  onBill: () => void;
  onOpenAi: () => void;
}) {
  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#927B6B]">{L(locale, "At your table", "على ترابيزتك")}</p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#33261E]">{L(locale, "Need anything?", "محتاج حاجة؟")}</h1>
      <p className="mt-2 text-sm leading-6 text-[#826F62]">{L(locale, "Ask us directly, without leaving the table.", "اطلب اللي تحتاجه من غير ما تقوم من مكانك.")}</p>

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          onClick={onWaiter}
          className={`flex min-h-24 items-center gap-4 rounded-[22px] border p-4 text-start ${
            waiterCalled ? "border-[#B7895D] bg-[#F4E5D5]" : "border-[#E3D8CE] bg-white"
          }`}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-[#EEE2D7] text-[#674736]"><Bell className="size-5" /></span>
          <span>
            <span className="block text-base font-black text-[#3A2A21]">{L(locale, "Call a waiter", "نادي ويتر")}</span>
            <span className="mt-1 block text-xs text-[#866F61]">
              {waiterCalled ? L(locale, "We notified the team · waiting", "بلغنا الفريق · في الانتظار") : L(locale, "We'll let the floor team know", "هنبلغ فريق الصالة")}
            </span>
          </span>
          {waiterCalled ? <Check className="ms-auto size-5 text-[#7B5B3F]" /> : <ChevronRight className="ms-auto size-4 text-[#A08A7B] rtl:rotate-180" />}
        </button>

        <button
          type="button"
          onClick={onBill}
          disabled={billState !== "idle"}
          className="flex min-h-24 items-center gap-4 rounded-[22px] border border-[#E3D8CE] bg-white p-4 text-start disabled:bg-[#F7EFE8]"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-[#EEE2D7] text-[#674736]"><Receipt className="size-5" /></span>
          <span>
            <span className="block text-base font-black text-[#3A2A21]">{L(locale, "Request the bill", "اطلب الفاتورة")}</span>
            <span className="mt-1 block text-xs text-[#866F61]">
              {billState === "idle" ? L(locale, "We'll prepare it for this table", "هنجهزها للترابيزة دي") : L(locale, "Your bill request is already active", "طلب الفاتورة شغال بالفعل")}
            </span>
          </span>
          <ChevronRight className="ms-auto size-4 text-[#A08A7B] rtl:rotate-180" />
        </button>

        <button
          type="button"
          onClick={onOpenAi}
          className="flex min-h-24 items-center gap-4 rounded-[22px] border border-[#E1D4C8] bg-[#F7EBDD] p-4 text-start"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-[#6B3F2D] text-white"><Sparkles className="size-5" /></span>
          <span>
            <span className="block text-base font-black text-[#3A2A21]">{L(locale, "Ask Balcona AI", "اسأل نادل بلكونة الذكي")}</span>
            <span className="mt-1 block text-xs text-[#806A5D]">{L(locale, "Menu help or ask for a human", "مساعدة في المنيو أو تحويل لموظف")}</span>
          </span>
          <ChevronRight className="ms-auto size-4 text-[#A08A7B] rtl:rotate-180" />
        </button>
      </div>
    </main>
  );
}

function BillView({
  locale,
  state,
  onRequest,
  onPresent,
  onPay,
  onResolveUnknown
}: {
  locale: Locale;
  state: BillState;
  onRequest: () => void;
  onPresent: () => void;
  onPay: () => void;
  onResolveUnknown: () => void;
}) {
  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-5">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#927B6B]">{L(locale, "Your table", "ترابيزتك")}</p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[#33261E]">{L(locale, "Bill & payment", "الفاتورة والدفع")}</h1>

      {state === "idle" ? (
        <div className="mt-5 rounded-[26px] border border-[#E4D9CF] bg-white p-5">
          <Receipt className="size-6 text-[#704B38]" />
          <h2 className="mt-4 text-lg font-black text-[#3A2A21]">{L(locale, "Ready when you are", "لما تكون جاهز")}</h2>
          <p className="mt-2 text-sm leading-6 text-[#846F62]">{L(locale, "Request the bill and we'll prepare it for your table.", "اطلب الفاتورة وهنجهزها لترابيزتك.")}</p>
          <button type="button" onClick={onRequest} className="mt-5 min-h-12 w-full rounded-2xl bg-[#2F2119] text-sm font-black text-white">
            {L(locale, "Request bill", "اطلب الفاتورة")}
          </button>
        </div>
      ) : null}

      {state === "requested" ? (
        <div className="mt-5 rounded-[26px] border border-[#E3D3C2] bg-[#F6EBDD] p-5">
          <Clock3 className="size-6 text-[#A06C45]" />
          <h2 className="mt-4 text-lg font-black text-[#3A2A21]">{L(locale, "Bill requested", "طلب الفاتورة وصل")}</h2>
          <p className="mt-2 text-sm leading-6 text-[#846F62]">{L(locale, "The team is preparing it. You'll see the total here when it's presented.", "الفريق بيجهزها. الإجمالي هيظهر هنا لما تتقدم.")}</p>
          <button type="button" onClick={onPresent} className="mt-5 min-h-11 w-full rounded-xl border border-dashed border-[#CDB9A7] text-xs font-black text-[#765B49]">
            {L(locale, "Prototype: staff presents bill", "بروتوتايب: الموظف يقدم الفاتورة")}
          </button>
        </div>
      ) : null}

      {["presented", "paying", "paid", "unknown"].includes(state) ? (
        <section className="mt-5 rounded-[26px] border border-[#E4D9CF] bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#907A6B]">#B-8821</p>
              <h2 className="mt-1 text-xl font-black text-[#362820]">{L(locale, "Table T12", "ترابيزة T12")}</h2>
            </div>
            <strong className="text-2xl font-black text-[#362820]">385 EGP</strong>
          </div>

          <div className="mt-5 divide-y divide-[#EEE5DC] border-y border-[#EEE5DC]">
            <div className="flex justify-between py-3 text-sm"><span className="text-[#796559]">2× Spanish Latte</span><strong>190 EGP</strong></div>
            <div className="flex justify-between py-3 text-sm"><span className="text-[#796559]">1× Basque Cheesecake</span><strong>135 EGP</strong></div>
            <div className="flex justify-between py-3 text-sm"><span className="text-[#796559]">{L(locale, "Other items", "منتجات أخرى")}</span><strong>60 EGP</strong></div>
          </div>

          {state === "presented" ? (
            <button type="button" onClick={onPay} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#6A3F2D] text-sm font-black text-white">
              <CreditCard className="size-4" />
              {L(locale, "Pay online", "ادفع أونلاين")}
            </button>
          ) : null}

          {state === "paying" ? (
            <div className="mt-5 rounded-2xl bg-[#F3E9DF] p-4 text-center">
              <WalletCards className="mx-auto size-5 text-[#775744]" />
              <p className="mt-2 text-sm font-black text-[#3B2D24]">{L(locale, "Payment pending", "الدفع قيد التنفيذ")}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={onResolveUnknown} className="min-h-10 rounded-xl border border-[#D8C9BC] bg-white text-xs font-black text-[#715A4B]">{L(locale, "Simulate unknown", "حالة غير محسومة")}</button>
                <button type="button" onClick={onPay} className="min-h-10 rounded-xl bg-[#2F2119] text-xs font-black text-white">{L(locale, "Simulate success", "نجاح الدفع")}</button>
              </div>
            </div>
          ) : null}

          {state === "paid" ? (
            <div className="mt-5 rounded-2xl bg-[#E8F1E7] p-4 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#54775A] text-white"><Check className="size-5" /></span>
              <p className="mt-3 text-sm font-black text-[#36503A]">{L(locale, "Payment complete", "تم الدفع")}</p>
              <p className="mt-1 text-xs text-[#607965]">{L(locale, "Your table bill is settled.", "فاتورة الترابيزة اتسددت.")}</p>
            </div>
          ) : null}

          {state === "unknown" ? (
            <div className="mt-5 rounded-2xl border border-[#D9A79E] bg-[#F9E9E6] p-4">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#A8574D]" />
                <div>
                  <p className="text-sm font-black text-[#7D3F38]">{L(locale, "We're checking your payment", "بنتأكد من حالة الدفع")}</p>
                  <p className="mt-1 text-xs leading-5 text-[#956159]">{L(locale, "Don't pay again yet. This isn't the same as a failed payment.", "ما تدفعش مرة ثانية دلوقتي. دي مش معناها إن الدفع فشل.")}</p>
                </div>
              </div>
              <button type="button" onClick={onPay} className="mt-3 min-h-10 w-full rounded-xl border border-[#D2A49C] bg-white text-xs font-black text-[#7B4C45]">
                {L(locale, "Prototype: provider confirms success", "بروتوتايب: شركة الدفع تؤكد النجاح")}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function AiSheet({
  locale,
  onClose,
  onAddSuggested,
  onEscalate
}: {
  locale: Locale;
  onClose: () => void;
  onAddSuggested: () => void;
  onEscalate: () => void;
}) {
  const [sent, setSent] = useState(false);
  return (
    <>
      <button type="button" aria-label="Close" onClick={onClose} className="fixed inset-0 z-40 bg-black/35" />
      <section className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[86vh] max-w-md overflow-y-auto rounded-t-[30px] bg-[#FFF9F2] p-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#6A3F2D] text-white"><Sparkles className="size-4" /></span>
            <div>
              <p className="text-sm font-black text-[#382920]">{L(locale, "Balcona AI Waiter", "نادل بلكونة الذكي")}</p>
              <p className="text-[10px] text-[#8A7567]">{L(locale, "Grounded in this menu", "فاهم المنيو الحالية")}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-full border border-[#E1D7CD] bg-white"><X className="size-4" /></button>
        </div>

        <div className="mt-5 rounded-[20px] bg-[#F1E6DC] p-4 text-sm leading-6 text-[#5B473B]">
          {L(locale, "If you want something smooth and not too heavy, I'd suggest the Spanish Latte. Want me to add one to your cart?", "لو عايز حاجة ناعمة ومش تقيلة، أرشحلك السبانيش لاتيه. أضيفه للسلة؟")}
        </div>

        {!sent ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { onAddSuggested(); setSent(true); }} className="min-h-12 rounded-xl bg-[#2F2119] px-3 text-xs font-black text-white">{L(locale, "Add it", "أضفه")}</button>
            <button type="button" onClick={() => setSent(true)} className="min-h-12 rounded-xl border border-[#DED2C7] bg-white px-3 text-xs font-black text-[#765F51]">{L(locale, "Something else", "حاجة تانية")}</button>
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-[#EAF1E8] p-3 text-xs font-bold text-[#4F6A52]">{L(locale, "Done — the cart proposal was applied.", "تمام — الاقتراح اتضاف للسلة.")}</div>
        )}

        <div className="mt-5 border-t border-[#E9DED4] pt-4">
          <button type="button" onClick={onEscalate} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#DCCFC3] bg-white text-xs font-black text-[#694F40]">
            <MessageCircle className="size-4" />
            {L(locale, "I want a human waiter", "عايز ويتر")}
          </button>
        </div>
      </section>
    </>
  );
}

export function GuestPrototype() {
  const [locale, setLocale] = useState<Locale>("en");
  const [view, setView] = useState<View>("menu");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderState, setOrderState] = useState<OrderState>("draft");
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [billState, setBillState] = useState<BillState>("idle");

  const addItem = (item: MenuItem, modifier?: string) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.item.id === item.id && entry.modifier === modifier);
      if (existing) {
        return current.map((entry) =>
          entry.item.id === item.id && entry.modifier === modifier
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        );
      }
      return [...current, { item, quantity: 1, modifier }];
    });
    setSelectedItem(null);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((current) =>
      current
        .map((entry) => entry.item.id === id ? { ...entry, quantity: entry.quantity + delta } : entry)
        .filter((entry) => entry.quantity > 0)
    );
  };

  const submitOrder = () => {
    if (!cart.length) return;
    setOrderState("submitted");
    setCartOpen(false);
    setView("order");
  };

  const advanceOrder = () => {
    setOrderState((current) => {
      if (current === "submitted") return "accepted";
      if (current === "accepted") return "preparing";
      if (current === "preparing") return "ready";
      if (current === "ready") return "served";
      return current;
    });
  };

  const requestBill = () => {
    setBillState((current) => current === "idle" ? "requested" : current);
    setView("bill");
  };

  const pay = () => {
    setBillState((current) => {
      if (current === "presented") return "paying";
      if (current === "paying" || current === "unknown") return "paid";
      return current;
    });
  };

  const spanishLatte = menuItems[0];

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#FFF9F2] text-[#33261E]">
      <SessionHeader locale={locale} onLocale={() => setLocale((value) => value === "en" ? "ar" : "en")} />

      {view === "menu" ? (
        <MenuView
          locale={locale}
          cart={cart}
          onSelectItem={setSelectedItem}
          onOpenAi={() => setAiOpen(true)}
          onOpenCart={() => setCartOpen(true)}
        />
      ) : null}

      {view === "order" ? <OrderView locale={locale} state={orderState} onAdvance={advanceOrder} /> : null}

      {view === "service" ? (
        <ServiceView
          locale={locale}
          waiterCalled={waiterCalled}
          billState={billState}
          onWaiter={() => setWaiterCalled(true)}
          onBill={requestBill}
          onOpenAi={() => setAiOpen(true)}
        />
      ) : null}

      {view === "bill" ? (
        <BillView
          locale={locale}
          state={billState}
          onRequest={requestBill}
          onPresent={() => setBillState("presented")}
          onPay={pay}
          onResolveUnknown={() => setBillState("unknown")}
        />
      ) : null}

      <BottomNav locale={locale} active={view} onChange={setView} orderState={orderState} billState={billState} />

      <ItemSheet locale={locale} item={selectedItem} onClose={() => setSelectedItem(null)} onAdd={addItem} />

      {cartOpen ? (
        <CartSheet
          locale={locale}
          cart={cart}
          onClose={() => setCartOpen(false)}
          onQuantity={updateQuantity}
          onSubmit={submitOrder}
        />
      ) : null}

      {aiOpen ? (
        <AiSheet
          locale={locale}
          onClose={() => setAiOpen(false)}
          onAddSuggested={() => addItem(spanishLatte, "Regular milk")}
          onEscalate={() => {
            setWaiterCalled(true);
            setAiOpen(false);
            setView("service");
          }}
        />
      ) : null}
    </div>
  );
}
