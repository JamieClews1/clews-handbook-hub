/**
 * Waste Transfer Note (A4) design used by WeighOne.
 *
 * The stored template describes ONE half of the A4 sheet. It is rendered twice:
 * the top half is the customer copy, the bottom half is retained by Clews Recycling.
 * All values are simple {{placeholders}} so the design can be edited in the portal.
 */

export const WTN_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "copy_label", label: "Copy label (Customer / Office)" },
  { key: "ticket_number", label: "Ticket number" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "customer_order_no", label: "Customer O/N" },
  { key: "account", label: "Account / customer code" },
  { key: "direction", label: "Direction (INWARD / OUTWARD)" },
  { key: "vehicle_reg", label: "Vehicle registration" },
  { key: "driver_name", label: "Driver name" },
  { key: "carrier_name", label: "Carrier / haulier name" },
  { key: "carrier_registration", label: "Waste carrier licence" },
  { key: "customer", label: "Customer" },
  { key: "site", label: "Site" },
  { key: "waste_description", label: "Waste description" },
  { key: "ewc_code", label: "EWC code" },
  { key: "container_type", label: "Container type" },
  { key: "physical_form", label: "Physical form" },
  { key: "means_of_transport", label: "Means of transport" },
  { key: "gross_weight", label: "Gross weight (kg)" },
  { key: "gross_time", label: "Gross weigh time" },
  { key: "tare_weight", label: "Tare weight (kg)" },
  { key: "tare_time", label: "Tare weigh time" },
  { key: "net_weight", label: "Net weight (kg)" },
  { key: "net_tonnes", label: "Net weight (tonnes)" },
  { key: "price_per_tonne", label: "Price per tonne" },
  { key: "total_price", label: "Total price" },
  { key: "additional_items", label: "Additional items (rows)" },
  { key: "operator_name", label: "Weighbridge operator" },
  { key: "notes", label: "Notes / comments" },
  { key: "company_name", label: "Company name" },
  { key: "company_address", label: "Company address" },
  { key: "company_contact", label: "Website & phone" },
  { key: "company_licences", label: "Licence / reg numbers line" },
];

/** Styles applied to the whole A4 sheet (both halves). */
export const WTN_PRINT_STYLES = `
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
  .wtn-sheet { display: flex; flex-direction: column; gap: 4mm; height: 281mm; }
  .wtn-copy { flex: 1 1 50%; border: 1px solid #000; padding: 3mm 4mm; font-size: 8.5pt; position: relative; overflow: hidden; }
  .wtn-cut { border-top: 1px dashed #666; text-align: center; font-size: 7pt; color: #666; letter-spacing: .12em; }
  .wtn-copy h1 { font-size: 12pt; margin: 0; text-align: right; letter-spacing: .04em; }
  .wtn-copy .copy-label { text-align: right; font-size: 8pt; font-weight: bold; letter-spacing: .1em; margin-bottom: 2mm; }
  .wtn-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm; }
  .wtn-brand { font-size: 7.5pt; line-height: 1.35; }
  .wtn-brand strong { font-size: 10pt; }
  .wtn-strip { width: 100%; border-collapse: collapse; margin: 2mm 0; }
  .wtn-strip th { background: #f0f0f0; border: 1px solid #000; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .04em; padding: 1mm; }
  .wtn-strip td { border: 1px solid #000; text-align: center; font-size: 8pt; padding: 1.4mm 1mm; font-weight: bold; }
  .wtn-cols { display: flex; gap: 3mm; }
  .wtn-col { flex: 1; border: 1px solid #000; padding: 1.5mm 2mm; min-height: 22mm; }
  .wtn-col .k { font-size: 6.5pt; text-transform: uppercase; color: #444; letter-spacing: .04em; }
  .wtn-col .v { font-size: 8pt; line-height: 1.35; white-space: pre-line; }
  .wtn-grid { display: flex; gap: 3mm; margin-top: 2mm; }
  .wtn-weights { width: 62mm; border: 1px solid #000; }
  .wtn-weights table { width: 100%; border-collapse: collapse; }
  .wtn-weights td { border-bottom: 1px solid #ddd; padding: 1mm 2mm; font-size: 8pt; }
  .wtn-weights td:last-child { text-align: right; font-weight: bold; }
  .wtn-weights .net td { font-size: 10pt; border-bottom: none; }
  .wtn-decl { flex: 1; border: 1px solid #000; padding: 1.5mm 2mm; font-size: 6.5pt; line-height: 1.3; }
  .wtn-signs { display: flex; gap: 3mm; margin-top: 2mm; }
  .wtn-sign { flex: 1; border: 1px solid #000; padding: 1.5mm 2mm; height: 17mm; }
  .wtn-sign .k { font-size: 6.5pt; text-transform: uppercase; color: #444; }
  .wtn-sign .name { font-size: 8pt; border-top: 1px solid #999; margin-top: 9mm; padding-top: .8mm; }
`;

/** Default design for one half of the sheet. */
export const DEFAULT_WTN_TEMPLATE = `<div class="wtn-copy">
  <div class="wtn-head">
    <div class="wtn-brand">
      <strong>{{company_name}}</strong><br />
      {{company_contact}}<br />
      {{company_address}}<br />
      {{company_licences}}
    </div>
    <div>
      <h1>WASTE TRANSFER NOTE</h1>
      <div class="copy-label">{{copy_label}}</div>
    </div>
  </div>

  <table class="wtn-strip">
    <tr>
      <th>Customer O/N</th><th>Date &amp; Time</th><th>Ticket No</th><th>Vehicle Reg</th>
      <th>Haulier WCL</th><th>Direction</th><th>Account</th>
    </tr>
    <tr>
      <td>{{customer_order_no}}</td>
      <td>{{date}} {{time}}</td>
      <td>{{ticket_number}}</td>
      <td>{{vehicle_reg}}</td>
      <td>{{carrier_name}}<br />{{carrier_registration}}</td>
      <td>{{direction}}</td>
      <td>{{account}}</td>
    </tr>
  </table>

  <div class="wtn-cols">
    <div class="wtn-col">
      <div class="k">Waste Producer / Customer</div>
      <div class="v">{{customer}}
{{site}}</div>
      <div class="k" style="margin-top:1.5mm">EWC</div>
      <div class="v">{{ewc_code}} — {{waste_description}}</div>
    </div>
    <div class="wtn-col">
      <div class="k">Receiving Site</div>
      <div class="v">{{company_name}}
{{company_address}}</div>
      <div class="k" style="margin-top:1.5mm">Container / Form / Transport</div>
      <div class="v">{{container_type}} · {{physical_form}} · {{means_of_transport}}</div>
    </div>
  </div>

  <div class="wtn-grid">
    <div class="wtn-weights">
      <table>
        <tr><td>Gross Weight</td><td>{{gross_weight}} kg</td></tr>
        <tr><td>Tare Weight</td><td>{{tare_weight}} kg</td></tr>
        <tr class="net"><td>Net Weight</td><td>{{net_weight}} kg</td></tr>
      </table>
    </div>
    <div class="wtn-decl">
      <strong>Producer's Certificate</strong><br />
      I confirm that I have applied the waste management hierarchy as required by Regulation 12 and complied
      with the requirements of Regulation 13 of the Waste (England and Wales) Regulations 2011 regarding the
      separate collection of waste paper, metal, plastic and glass.<br />
      <strong>Comments:</strong> {{notes}}
    </div>
  </div>

  <div class="wtn-signs">
    <div class="wtn-sign"><div class="k">Producer Sign</div><div class="name">{{customer}}</div></div>
    <div class="wtn-sign"><div class="k">Driver Sign</div><div class="name">{{driver_name}}</div></div>
    <div class="wtn-sign"><div class="k">Weighbridge Sign</div><div class="name">{{operator_name}}</div></div>
  </div>
</div>`;

export type WtnVars = Record<string, string>;

export function renderWtnHalf(template: string, vars: WtnVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => vars[key] ?? "");
}

/** Build the full A4 sheet: top = customer copy, bottom = Clews retained copy. */
export function renderWtnSheet(template: string, vars: WtnVars, title = "Waste Transfer Note"): string {
  const top = renderWtnHalf(template, { ...vars, copy_label: "CUSTOMER COPY" });
  const bottom = renderWtnHalf(template, { ...vars, copy_label: "CLEWS RECYCLING — OFFICE COPY" });
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
<style>${WTN_PRINT_STYLES}</style></head>
<body><div class="wtn-sheet">${top}<div class="wtn-cut">— — — — — — — — — — cut here — — — — — — — — — —</div>${bottom}</div></body></html>`;
}

export const SAMPLE_WTN_VARS: WtnVars = {
  ticket_number: "84655",
  date: "25/08/2026",
  time: "14:01",
  customer_order_no: "PO-10293",
  account: "ZZWIL004",
  direction: "INWARD",
  vehicle_reg: "FJ18FDM",
  driver_name: "Jarek",
  carrier_name: "Clews Recycling Ltd",
  carrier_registration: "CBDU203180",
  customer: "Example Customer Ltd",
  site: "Unit 4, Example Way, Coventry, CV1 2AB",
  waste_description: "Paper and cardboard",
  ewc_code: "19 12 01",
  container_type: "Clews Trailer",
  physical_form: "Solid",
  means_of_transport: "Road",
  gross_weight: "24,800",
  gross_time: "14:01:24",
  tare_weight: "16,960",
  tare_time: "14:01:03",
  net_weight: "7,840",
  net_tonnes: "7.84",
  price_per_tonne: "£195.00",
  total_price: "£1,528.80",
  additional_items: "",
  operator_name: "Weighbridge",
  notes: "",
  company_name: "Clews Recycling Ltd",
  company_address: "Unit 17 Hunters Lane, Rugby, CV21 1EA",
  company_contact: "clewsrecycling.co.uk | 01788 541549",
  company_licences: "Site Licence EAWML48106 | Waste Carrier CBDU203180 | Company Reg 3856771 | VAT 747316619",
};
