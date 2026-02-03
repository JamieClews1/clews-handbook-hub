import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Languages, Save } from "lucide-react";

export type TranslationOption = "all" | "none";

interface TranslationSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (option: TranslationOption) => void;
  isTranslating: boolean;
  documentType: "RAMS" | "Toolbox Talk" | "Handbook Section" | "Handbook Subsection";
  isNew?: boolean;
}

export const TranslationSaveDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isTranslating,
  documentType,
  isNew = false,
}: TranslationSaveDialogProps) => {
  const [selectedOption, setSelectedOption] = useState<TranslationOption>("all");

  const handleConfirm = () => {
    onConfirm(selectedOption);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Save {documentType}
          </DialogTitle>
          <DialogDescription>
            Choose how to handle translations for this {documentType.toLowerCase()}.
            Translations are stored in the database for users to view without using API quota.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={selectedOption}
            onValueChange={(value) => setSelectedOption(value as TranslationOption)}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="all" id="all" className="mt-1" />
              <div>
                <Label htmlFor="all" className="font-medium cursor-pointer">
                  Translate all content
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isNew 
                    ? "Generate translations for Polish, Ukrainian, and Romanian"
                    : "Re-translate all content to Polish, Ukrainian, and Romanian"}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="none" id="none" className="mt-1" />
              <div>
                <Label htmlFor="none" className="font-medium cursor-pointer">
                  Save without translating
                </Label>
                <p className="text-sm text-muted-foreground">
                  Keep existing translations (if any). Users will see English for untranslated content.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isTranslating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isTranslating}
            className="gap-2"
          >
            {isTranslating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save {selectedOption === "all" ? "& Translate" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
