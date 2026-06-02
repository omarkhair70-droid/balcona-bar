import { type ReactNode } from "react";
import { StaffShell } from "./staff-shell";

type StaffPageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function StaffPageShell({
  title,
  description,
  children,
  actions
}: StaffPageShellProps) {
  return (
    <StaffShell
      title={title}
      description={description}
      actions={actions}
    >
      {children}
    </StaffShell>
  );
}
