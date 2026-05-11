"use client";

import { Loader2, Trash2 } from "lucide-react";
import { LegacyDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  isLoading?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  isLoading,
}: Props) {
  return (
    <LegacyDialog open={open} onClose={onClose} title={title} description={description}>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          className="gap-2 bg-red-600 text-white hover:bg-red-700"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {confirmLabel}
        </Button>
      </div>
    </LegacyDialog>
  );
}
