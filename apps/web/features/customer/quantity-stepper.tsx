"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type QuantityStepperProps = {
  value: number;
  min?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

export function QuantityStepper({
  value,
  min = 1,
  onChange,
  disabled
}: QuantityStepperProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-button border bg-surface p-1">
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>
      <span className="min-w-8 text-center text-sm font-semibold">{value}</span>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        aria-label="Increase quantity"
      >
        <Plus className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
