import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Phone, Clock, MapPin } from "lucide-react";

interface ContactProps {
  language: string;
}

interface HRContact {
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  office_hours: string | null;
  office_address: string | null;
}

const translations = {
  en: {
    title: "HR Contact Information",
    subtitle: "Get in touch with our Human Resources team",
    email: "Email",
    phone: "Phone",
    hours: "Office Hours",
    hoursText: "Monday - Friday: 9:00 AM - 5:00 PM",
    emergencyNote: "For urgent matters outside office hours, please call the emergency line.",
  },
  pl: {
    title: "Kontakt z Działem HR",
    subtitle: "Skontaktuj się z naszym zespołem Zasobów Ludzkich",
    email: "E-mail",
    phone: "Telefon",
    hours: "Godziny Pracy Biura",
    hoursText: "Poniedziałek - Piątek: 9:00 - 17:00",
    emergencyNote: "W pilnych sprawach poza godzinami pracy biura, prosimy o kontakt pod numer alarmowy.",
  },
  uk: {
    title: "Контактна Інформація HR",
    subtitle: "Зв'яжіться з нашим відділом кадрів",
    email: "Електронна пошта",
    phone: "Телефон",
    hours: "Години Роботи Офісу",
    hoursText: "Понеділок - П'ятниця: 9:00 - 17:00",
    emergencyNote: "Для термінових питань поза робочим часом, будь ласка, зателефонуйте на екстрену лінію.",
  },
  ro: {
    title: "Informații Contact HR",
    subtitle: "Contactați echipa noastră de Resurse Umane",
    email: "Email",
    phone: "Telefon",
    hours: "Ore de Birou",
    hoursText: "Luni - Vineri: 9:00 - 17:00",
    emergencyNote: "Pentru probleme urgente în afara orelor de birou, vă rugăm să sunați la linia de urgență.",
  },
};

export const Contact = ({ language }: ContactProps) => {
  const t = translations[language as keyof typeof translations];
  const [hrContact, setHrContact] = useState<HRContact | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHRContact = async () => {
      try {
        const { data, error } = await supabase
          .from("hr_contact_settings")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setHrContact(data);
        }
      } catch (error) {
        console.error("Error fetching HR contact:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHRContact();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Skeleton className="h-12 w-3/4 mb-2" />
        <Skeleton className="h-6 w-1/2 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-4xl font-bold text-primary mb-2">{t.title}</h1>
      <p className="text-muted-foreground mb-8">{t.subtitle}</p>

      <div className="space-y-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <Mail className="h-5 w-5" />
              {t.email}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={`mailto:${hrContact?.contact_email || "hr@clews-recycling.co.uk"}`}
              className="text-lg text-primary hover:underline font-medium"
            >
              {hrContact?.contact_email || "hr@clews-recycling.co.uk"}
            </a>
          </CardContent>
        </Card>

        {hrContact?.contact_phone && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-accent">
                <Phone className="h-5 w-5" />
                {t.phone}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={`tel:${hrContact.contact_phone.replace(/\s/g, "")}`}
                className="text-lg text-primary hover:underline font-medium"
              >
                {hrContact.contact_phone}
              </a>
            </CardContent>
          </Card>
        )}

        {hrContact?.office_hours && (
          <Card className="bg-secondary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-accent">
                <Clock className="h-5 w-5" />
                {t.hours}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground font-medium mb-2">{hrContact.office_hours}</p>
              <p className="text-sm text-muted-foreground">{t.emergencyNote}</p>
            </CardContent>
          </Card>
        )}

        {hrContact?.office_address && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-accent">
                <MapPin className="h-5 w-5" />
                Office Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap">{hrContact.office_address}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
