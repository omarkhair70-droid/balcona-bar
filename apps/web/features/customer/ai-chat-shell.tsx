import { type ReactNode } from "react";
import { Bot, MenuSquare, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n/i18n-provider";

type AiChatShellProps = {
  title: string;
  description: string;
  tone: string;
  status: ReactNode;
  children: ReactNode;
  side: ReactNode;
};

export function AiChatShell({
  title,
  description,
  tone,
  status,
  children,
  side
}: AiChatShellProps) {
  const t = useTranslations("customer.ai");

  return (
    <section className="grid gap-4">
      <div className="rounded-[22px] border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
            <Bot className="size-5" aria-hidden="true" />
          </span>
          {status}
        </div>

        <Badge variant="muted" className="mt-3 w-fit">
          {tone}
        </Badge>

        <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border bg-muted p-2.5">
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
            <p className="mt-2 text-[10px] font-bold leading-4 text-foreground">
              {t("page.safetyConfirm")}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted p-2.5">
            <MenuSquare className="size-4 text-primary" aria-hidden="true" />
            <p className="mt-2 text-[10px] font-bold leading-4 text-foreground">
              {t("page.menuGrounded")}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted p-2.5">
            <ShieldCheck className="size-4 text-warning" aria-hidden="true" />
            <p className="mt-2 text-[10px] font-bold leading-4 text-foreground">
              {t("page.cartValidationAuthority")}
            </p>
          </div>
        </div>
      </div>

      <div className="min-w-0">{children}</div>
      <aside className="grid gap-4">{side}</aside>
    </section>
  );
}
