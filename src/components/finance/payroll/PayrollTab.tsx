import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PayrollTimesheetsTab from "./PayrollTimesheetsTab";
import PayrollStaffTab from "./PayrollStaffTab";

export default function PayrollTab() {
  return (
    <Tabs defaultValue="timesheets" className="space-y-4">
      <TabsList>
        <TabsTrigger value="timesheets">Timesheets &amp; hours</TabsTrigger>
        <TabsTrigger value="staff">Staff &amp; rates</TabsTrigger>
      </TabsList>
      <TabsContent value="timesheets">
        <PayrollTimesheetsTab />
      </TabsContent>
      <TabsContent value="staff">
        <PayrollStaffTab />
      </TabsContent>
    </Tabs>
  );
}
