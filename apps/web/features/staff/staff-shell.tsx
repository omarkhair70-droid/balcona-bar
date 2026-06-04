import { type ReactNode } from "react";
import { StaffShellFrame } from "./staff-shell-frame";

type StaffShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  supporting?: ReactNode;
  children: ReactNode;
};

export function StaffShell({
  title,
  description,
  actions,
  supporting,
  children
}: StaffShellProps) {
  return (
    <StaffShellFrame
      title={title}
      description={description}
      actions={actions}
      supporting={supporting}
    >
      {children}
    </StaffShellFrame>
  );
}
