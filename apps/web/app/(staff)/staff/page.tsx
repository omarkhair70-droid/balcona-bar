import Link from "next/link";
import { Bell, ChefHat, Receipt, UsersRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { StaffPageShell } from "@/features/staff/staff-page-shell";

const staffAreas = [
  {
    title: "Cashier",
    href: "/staff/cashier",
    description:
      "Ready for smart cashier intake, order acceptance, and bill workflows.",
    icon: <Receipt className="size-5" aria-hidden="true" />
  },
  {
    title: "Kitchen",
    href: "/staff/kitchen",
    description:
      "Prepared for production queues without implementing the queue UI yet.",
    icon: <ChefHat className="size-5" aria-hidden="true" />
  },
  {
    title: "Waiter",
    href: "/staff/waiter",
    description:
      "Ready for table attention, waiter calls, and realtime service signals.",
    icon: <Bell className="size-5" aria-hidden="true" />
  },
  {
    title: "Owner",
    href: "/staff/owner",
    description:
      "Prepared for analytics, configuration, permissions, and audit views.",
    icon: <UsersRound className="size-5" aria-hidden="true" />
  }
];

export default function StaffPage() {
  return (
    <StaffPageShell
      title="Staff workspace shell"
      description="A dashboard-ready foundation for cashier, kitchen, waiter, and owner roles with navigation, theme tokens, and realtime utilities prepared."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {staffAreas.map((area) => (
          <Card key={area.href}>
            <CardHeader>
              <div className="text-primary">{area.icon}</div>
              <CardTitle>{area.title}</CardTitle>
              <CardDescription>{area.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Link
                href={area.href}
                className={buttonVariants({
                  variant: "secondary",
                  size: "sm"
                })}
              >
                Open placeholder
              </Link>
            </CardFooter>
          </Card>
        ))}
      </section>
    </StaffPageShell>
  );
}
