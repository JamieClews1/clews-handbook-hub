import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/SignaturePad";
import { PenLine, X } from "lucide-react";

interface SignatureFieldProps {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  /** Optional helper text under the field */
  hint?: string;
  disabled?: boolean;
}

/** Reusable capture-or-clear signature control backed by the drawing pad. */
export const SignatureField = ({ label, value, onChange, hint, disabled }: SignatureFieldProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {value ? (
        <div className="relative rounded-md border border-foreground/20 bg-white p-1">
          <img src={value} alt={`${label} signature`} className="h-16 w-full object-contain" />
          {!disabled && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute top-0.5 right-0.5 h-6 w-6 text-destructive"
              onClick={() => onChange(null)}
              title="Clear signature"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <PenLine className="h-3.5 w-3.5" /> Sign
        </Button>
      )}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <SignaturePad
            onSave={(data) => {
              onChange(data);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
