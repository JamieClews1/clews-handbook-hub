import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import clewsLogo from "@/assets/clews-logo.png";

type Language = "en" | "pl" | "uk" | "ro";

const translations = {
  en: {
    title: "Near Miss Report",
    subtitle: "Report a near miss incident to help improve workplace safety",
    instruction: "A near miss is any unplanned event that did not result in injury, illness, or damage but had the potential to do so. Reporting near misses helps us identify hazards and prevent future incidents.",
    dateLabel: "Date of Incident",
    locationLabel: "Location",
    locationPlaceholder: "Where did this happen?",
    descriptionLabel: "Brief Description",
    descriptionPlaceholder: "What type of near miss was this?",
    whatHappenedLabel: "What Happened?",
    whatHappenedPlaceholder: "Describe the incident in detail...",
    consequencesLabel: "What Could Have Happened?",
    consequencesPlaceholder: "What were the potential consequences?",
    actionsLabel: "Suggested Actions",
    actionsPlaceholder: "How can we prevent this in the future?",
    nameLabel: "Your Name (Optional)",
    namePlaceholder: "You can remain anonymous",
    departmentLabel: "Department (Optional)",
    departmentPlaceholder: "Your department or area",
    submitButton: "Submit Report",
    submitting: "Submitting...",
    successTitle: "Report Submitted",
    successMessage: "Thank you for reporting this near miss. Your report helps keep everyone safe.",
    errorTitle: "Error",
    errorMessage: "Failed to submit report. Please try again.",
    submitAnother: "Submit Another Report",
    anonymous: "Anonymous reports are welcome",
  },
  pl: {
    title: "Raport o Zdarzeniu Potencjalnie Wypadkowym",
    subtitle: "Zgłoś zdarzenie potencjalnie wypadkowe, aby poprawić bezpieczeństwo w miejscu pracy",
    instruction: "Zdarzenie potencjalnie wypadkowe to każde nieplanowane zdarzenie, które nie spowodowało obrażeń, choroby ani szkód, ale mogło do nich doprowadzić. Zgłaszanie takich zdarzeń pomaga nam identyfikować zagrożenia i zapobiegać przyszłym incydentom.",
    dateLabel: "Data Zdarzenia",
    locationLabel: "Lokalizacja",
    locationPlaceholder: "Gdzie to się wydarzyło?",
    descriptionLabel: "Krótki Opis",
    descriptionPlaceholder: "Jaki to był rodzaj zdarzenia?",
    whatHappenedLabel: "Co Się Stało?",
    whatHappenedPlaceholder: "Opisz szczegółowo zdarzenie...",
    consequencesLabel: "Co Mogło Się Stać?",
    consequencesPlaceholder: "Jakie były potencjalne konsekwencje?",
    actionsLabel: "Sugerowane Działania",
    actionsPlaceholder: "Jak możemy temu zapobiec w przyszłości?",
    nameLabel: "Twoje Imię (Opcjonalnie)",
    namePlaceholder: "Możesz pozostać anonimowy",
    departmentLabel: "Dział (Opcjonalnie)",
    departmentPlaceholder: "Twój dział lub obszar",
    submitButton: "Wyślij Raport",
    submitting: "Wysyłanie...",
    successTitle: "Raport Wysłany",
    successMessage: "Dziękujemy za zgłoszenie tego zdarzenia. Twój raport pomaga zapewnić bezpieczeństwo wszystkim.",
    errorTitle: "Błąd",
    errorMessage: "Nie udało się wysłać raportu. Spróbuj ponownie.",
    submitAnother: "Wyślij Kolejny Raport",
    anonymous: "Anonimowe zgłoszenia są mile widziane",
  },
  uk: {
    title: "Звіт про Потенційний Інцидент",
    subtitle: "Повідомте про потенційний інцидент для покращення безпеки на робочому місці",
    instruction: "Потенційний інцидент — це будь-яка незапланована подія, яка не призвела до травми, хвороби чи пошкодження, але могла б це зробити. Повідомлення про такі події допомагає нам виявляти небезпеки та запобігати майбутнім інцидентам.",
    dateLabel: "Дата Інциденту",
    locationLabel: "Місце",
    locationPlaceholder: "Де це сталося?",
    descriptionLabel: "Короткий Опис",
    descriptionPlaceholder: "Який це був тип інциденту?",
    whatHappenedLabel: "Що Сталося?",
    whatHappenedPlaceholder: "Детально опишіть інцидент...",
    consequencesLabel: "Що Могло Статися?",
    consequencesPlaceholder: "Які були потенційні наслідки?",
    actionsLabel: "Запропоновані Дії",
    actionsPlaceholder: "Як ми можемо запобігти цьому в майбутньому?",
    nameLabel: "Ваше Ім'я (Необов'язково)",
    namePlaceholder: "Ви можете залишитися анонімним",
    departmentLabel: "Відділ (Необов'язково)",
    departmentPlaceholder: "Ваш відділ або зона",
    submitButton: "Надіслати Звіт",
    submitting: "Надсилання...",
    successTitle: "Звіт Надіслано",
    successMessage: "Дякуємо за повідомлення про цей інцидент. Ваш звіт допомагає забезпечити безпеку всіх.",
    errorTitle: "Помилка",
    errorMessage: "Не вдалося надіслати звіт. Спробуйте ще раз.",
    submitAnother: "Надіслати Інший Звіт",
    anonymous: "Анонімні повідомлення вітаються",
  },
  ro: {
    title: "Raport Incident Potențial",
    subtitle: "Raportați un incident potențial pentru a îmbunătăți siguranța la locul de muncă",
    instruction: "Un incident potențial este orice eveniment neplanificat care nu a avut ca rezultat vătămări, boli sau daune, dar care ar fi putut avea. Raportarea acestor incidente ne ajută să identificăm pericolele și să prevenim incidentele viitoare.",
    dateLabel: "Data Incidentului",
    locationLabel: "Locația",
    locationPlaceholder: "Unde s-a întâmplat?",
    descriptionLabel: "Descriere Scurtă",
    descriptionPlaceholder: "Ce tip de incident a fost?",
    whatHappenedLabel: "Ce S-a Întâmplat?",
    whatHappenedPlaceholder: "Descrieți incidentul în detaliu...",
    consequencesLabel: "Ce S-ar Fi Putut Întâmpla?",
    consequencesPlaceholder: "Care erau consecințele potențiale?",
    actionsLabel: "Acțiuni Sugerate",
    actionsPlaceholder: "Cum putem preveni acest lucru în viitor?",
    nameLabel: "Numele Dvs. (Opțional)",
    namePlaceholder: "Puteți rămâne anonim",
    departmentLabel: "Departament (Opțional)",
    departmentPlaceholder: "Departamentul sau zona dvs.",
    submitButton: "Trimite Raportul",
    submitting: "Se trimite...",
    successTitle: "Raport Trimis",
    successMessage: "Vă mulțumim pentru raportarea acestui incident. Raportul dvs. ajută la menținerea siguranței tuturor.",
    errorTitle: "Eroare",
    errorMessage: "Nu s-a putut trimite raportul. Vă rugăm să încercați din nou.",
    submitAnother: "Trimite Alt Raport",
    anonymous: "Rapoartele anonime sunt binevenite",
  },
};

const languageNames: Record<Language, string> = {
  en: "English",
  pl: "Polski",
  uk: "Українська",
  ro: "Română",
};

const NearMissReportPage = () => {
  const { toast } = useToast();
  const [language, setLanguage] = useState<Language>("en");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    report_date: new Date().toISOString().split('T')[0],
    location: "",
    description: "",
    what_happened: "",
    potential_consequences: "",
    suggested_actions: "",
    reporter_name: "",
    reporter_department: "",
  });

  const t = translations[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("near_miss_reports")
        .insert({
          report_date: formData.report_date,
          location: formData.location,
          description: formData.description,
          what_happened: formData.what_happened,
          potential_consequences: formData.potential_consequences || null,
          suggested_actions: formData.suggested_actions || null,
          reporter_name: formData.reporter_name || null,
          reporter_department: formData.reporter_department || null,
        });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: t.successTitle,
        description: t.successMessage,
      });
    } catch (error) {
      console.error("Error submitting near miss report:", error);
      toast({
        title: t.errorTitle,
        description: t.errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setFormData({
      report_date: new Date().toISOString().split('T')[0],
      location: "",
      description: "",
      what_happened: "",
      potential_consequences: "",
      suggested_actions: "",
      reporter_name: "",
      reporter_department: "",
    });
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{t.successTitle}</h2>
            <p className="text-muted-foreground mb-6">{t.successMessage}</p>
            <Button onClick={handleReset} className="w-full">
              {t.submitAnother}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <img src={clewsLogo} alt="Clews Recycling" className="h-12 mx-auto mb-4" />
          
          {/* Language Selector */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(languageNames).map(([code, name]) => (
                  <SelectItem key={code} value={code}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="border-amber-200 shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-7 w-7 text-white" />
            </div>
            <CardTitle className="text-2xl">{t.title}</CardTitle>
            <CardDescription className="text-base">{t.subtitle}</CardDescription>
          </CardHeader>
          
          <CardContent>
            {/* Instruction Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800">{t.instruction}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="report_date">{t.dateLabel} *</Label>
                <Input
                  id="report_date"
                  type="date"
                  value={formData.report_date}
                  onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                  required
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">{t.locationLabel} *</Label>
                <Input
                  id="location"
                  placeholder={t.locationPlaceholder}
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>

              {/* Brief Description */}
              <div className="space-y-2">
                <Label htmlFor="description">{t.descriptionLabel} *</Label>
                <Input
                  id="description"
                  placeholder={t.descriptionPlaceholder}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              {/* What Happened */}
              <div className="space-y-2">
                <Label htmlFor="what_happened">{t.whatHappenedLabel} *</Label>
                <Textarea
                  id="what_happened"
                  placeholder={t.whatHappenedPlaceholder}
                  value={formData.what_happened}
                  onChange={(e) => setFormData({ ...formData, what_happened: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              {/* Potential Consequences */}
              <div className="space-y-2">
                <Label htmlFor="potential_consequences">{t.consequencesLabel}</Label>
                <Textarea
                  id="potential_consequences"
                  placeholder={t.consequencesPlaceholder}
                  value={formData.potential_consequences}
                  onChange={(e) => setFormData({ ...formData, potential_consequences: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Suggested Actions */}
              <div className="space-y-2">
                <Label htmlFor="suggested_actions">{t.actionsLabel}</Label>
                <Textarea
                  id="suggested_actions"
                  placeholder={t.actionsPlaceholder}
                  value={formData.suggested_actions}
                  onChange={(e) => setFormData({ ...formData, suggested_actions: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Optional Reporter Info */}
              <div className="border-t pt-5 mt-5">
                <p className="text-sm text-muted-foreground mb-4">{t.anonymous}</p>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reporter_name">{t.nameLabel}</Label>
                    <Input
                      id="reporter_name"
                      placeholder={t.namePlaceholder}
                      value={formData.reporter_name}
                      onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reporter_department">{t.departmentLabel}</Label>
                    <Input
                      id="reporter_department"
                      placeholder={t.departmentPlaceholder}
                      value={formData.reporter_department}
                      onChange={(e) => setFormData({ ...formData, reporter_department: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? t.submitting : t.submitButton}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NearMissReportPage;
