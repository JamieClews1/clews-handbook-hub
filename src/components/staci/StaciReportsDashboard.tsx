import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Download, Package, Truck } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  STACI_PALLET_RATES,
  STACI_PALLET_GOOD_REBATE,
  WASTE_TYPE_LABELS,
  RECYCLABLE_WASTE_TYPES,
  NON_RECYCLABLE_WASTE_TYPES,
  WOOD_TYPE,
  type StaciWasteBreakdown,
  type StaciPalletColour,
  STACI_COLOUR_CONFIG,
} from "@/components/load-reports/staci/types";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { StaciMonthlyReport } from "@/components/staci/StaciMonthlyReport";
import { StaciLoadReportCards } from "@/components/customer-reporting/StaciLoadReportCards";

const TARE_KG = 20;

interface PalletRow {
  id: string;
  colour: StaciPalletColour;
  weight_kg: number;
  pallet_type: string;
  pallet_count: number;
  description: string | null;
  waste_breakdown: StaciWasteBreakdown | null;
  load_report_id: string;
  report_date: string;
  site_name: string | null;
  customer_name: string | null;
}

interface StaciReportsDashboardProps {
  /** When provided, renders the monthly report in portal mode for this customer */
  customerId?: string;
  customerName?: string;
  isPortalView?: boolean;
}

export function StaciReportsDashboard({ customerId, customerName, isPortalView }: StaciReportsDashboardProps) {
  const { toast } = useToast();

  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [dateMode, setDateMode] = useState<"range" | "month">("month");
  const [rows, setRows] = useState<PalletRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [balesDolavData, setBalesDolavData] = useState<{
    cardBalesCount: number; cardBalesWeightKg: number; cardBalesOnPalletsCount: number;
    filmsBaleCount: number; filmsBaleWeightKg: number; filmsBaleOnPalletsCount: number;
    papersDolavCount: number; papersDolavWeightKg: number; papersDolavOnPalletsCount: number;
    glassDolavCount: number; glassDolavWeightKg: number; glassDolavOnPalletsCount: number;
    scrapMetalLooseCount: number; scrapMetalLooseWeightKg: number; scrapMetalLooseOnPalletsCount: number;
    scrapPalletsCount: number;
  }>({ cardBalesCount: 0, cardBalesWeightKg: 0, cardBalesOnPalletsCount: 0, filmsBaleCount: 0, filmsBaleWeightKg: 0, filmsBaleOnPalletsCount: 0, papersDolavCount: 0, papersDolavWeightKg: 0, papersDolavOnPalletsCount: 0, glassDolavCount: 0, glassDolavWeightKg: 0, glassDolavOnPalletsCount: 0, scrapMetalLooseCount: 0, scrapMetalLooseWeightKg: 0, scrapMetalLooseOnPalletsCount: 0, scrapPalletsCount: 0 });
  const [haulageData, setHaulageData] = useState<{
    artic: { loads: number; totalCost: number; rate: number };
    pickup: { loads: number; totalCost: number; rate: number };
    totalLoads: number;
    totalCost: number;
  }>({ artic: { loads: 0, totalCost: 0, rate: 145 }, pickup: { loads: 0, totalCost: 0, rate: 15 }, totalLoads: 0, totalCost: 0 });

  const [dbPalletRates, setDbPalletRates] = useState<Record<string, number>>({});
  const [dbGoodPalletRebate, setDbGoodPalletRebate] = useState<number>(STACI_PALLET_GOOD_REBATE);
  const [dbPalletWeightCharge, setDbPalletWeightCharge] = useState<number>(-47);
  const [baleRates, setBaleRates] = useState<{ cardBalesRate: number; filmsRate: number; scrapMetalRate: number }>({ cardBalesRate: 0, filmsRate: 0, scrapMetalRate: 0 });

  useEffect(() => {
    const fetchData = async () => {
      setFetching(true);
      const from = format(dateFrom, "yyyy-MM-dd");
      const to = format(dateTo, "yyyy-MM-dd");

      // When in portal view, get the customer's sites for filtering
      let customerSiteIds: string[] = [];
      let dataHubCustomerName: string | null = null;
      if (customerId) {
        const { data: sites } = await supabase
          .from("customer_sites")
          .select("id, data_hub_customer")
          .eq("customer_id", customerId);
        customerSiteIds = (sites ?? []).map(s => s.id);
        dataHubCustomerName = sites?.find(s => s.data_hub_customer)?.data_hub_customer ?? null;
      }

      // Pallet entries query - filter by customer sites when in portal view
      let palletQuery = supabase
        .from("staci_pallet_entries")
        .select("id, colour, weight_kg, pallet_type, pallet_count, description, waste_breakdown, load_report_id, load_reports!inner(report_date, status, site_id, customer_sites(site_name, customers(customer_name)))")
        .gte("load_reports.report_date", from)
        .lte("load_reports.report_date", to)
        .eq("load_reports.status", "submitted");

      if (customerId && customerSiteIds.length > 0) {
        palletQuery = palletQuery.in("load_reports.site_id", customerSiteIds);
      }

      const { data, error } = await palletQuery;

      if (error) {
        console.error(error);
        toast({ title: "Error loading data", description: error.message, variant: "destructive" });
        setFetching(false);
        return;
      }

      const mapped: PalletRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        colour: r.colour,
        weight_kg: r.weight_kg,
        pallet_type: r.pallet_type ?? "good",
        pallet_count: r.pallet_count ?? 1,
        description: r.description,
        waste_breakdown: r.waste_breakdown as StaciWasteBreakdown | null,
        load_report_id: r.load_report_id,
        report_date: r.load_reports?.report_date ?? "",
        site_name: r.load_reports?.customer_sites?.site_name ?? null,
        customer_name: r.load_reports?.customer_sites?.customers?.customer_name ?? null,
      }));

      setRows(mapped);

      // Bales/dolavs query - filter by customer sites when in portal view
      let balesQuery = supabase
        .from("load_reports")
        .select("card_bales_count, card_bales_weight_kg, card_bales_on_pallets, films_bale_count, films_bale_weight_kg, films_bale_on_pallets, papers_dolav_count, papers_dolav_weight_kg, papers_dolav_on_pallets, glass_dolav_count, glass_dolav_weight_kg, glass_dolav_on_pallets, scrap_metal_loose_count, scrap_metal_loose_weight_kg, scrap_metal_loose_on_pallets")
        .gte("report_date", from)
        .lte("report_date", to)
        .eq("status", "submitted")
        .not("site_id", "is", null);

      if (customerId && customerSiteIds.length > 0) {
        balesQuery = balesQuery.in("site_id", customerSiteIds);
      }

      const { data: reportData } = await balesQuery;

      const agg = { cardBalesCount: 0, cardBalesWeightKg: 0, cardBalesOnPalletsCount: 0, filmsBaleCount: 0, filmsBaleWeightKg: 0, filmsBaleOnPalletsCount: 0, papersDolavCount: 0, papersDolavWeightKg: 0, papersDolavOnPalletsCount: 0, glassDolavCount: 0, glassDolavWeightKg: 0, glassDolavOnPalletsCount: 0, scrapMetalLooseCount: 0, scrapMetalLooseWeightKg: 0, scrapMetalLooseOnPalletsCount: 0 };
      (reportData ?? []).forEach((r: any) => {
        const cardCount = Number(r.card_bales_count) || 0;
        const cardPerUnit = Number(r.card_bales_weight_kg) || 0;
        const filmsCount = Number(r.films_bale_count) || 0;
        const filmsPerUnit = Number(r.films_bale_weight_kg) || 0;
        const papersCount = Number(r.papers_dolav_count) || 0;
        const papersPerUnit = Number(r.papers_dolav_weight_kg) || 0;
        const glassCount = Number(r.glass_dolav_count) || 0;
        const glassPerUnit = Number(r.glass_dolav_weight_kg) || 0;
        const scrapMetalCount = Number(r.scrap_metal_loose_count) || 0;
        const scrapMetalPerUnit = Number(r.scrap_metal_loose_weight_kg) || 0;
        agg.cardBalesCount += cardCount;
        agg.cardBalesWeightKg += cardCount * cardPerUnit;
        if (r.card_bales_on_pallets) agg.cardBalesOnPalletsCount += cardCount;
        agg.filmsBaleCount += filmsCount;
        agg.filmsBaleWeightKg += filmsCount * filmsPerUnit;
        if (r.films_bale_on_pallets) agg.filmsBaleOnPalletsCount += filmsCount;
        agg.papersDolavCount += papersCount;
        agg.papersDolavWeightKg += papersCount * papersPerUnit;
        if (r.papers_dolav_on_pallets) agg.papersDolavOnPalletsCount += papersCount;
        agg.glassDolavCount += glassCount;
        agg.glassDolavWeightKg += glassCount * glassPerUnit;
        if (r.glass_dolav_on_pallets) agg.glassDolavOnPalletsCount += glassCount;
        agg.scrapMetalLooseCount += scrapMetalCount;
        agg.scrapMetalLooseWeightKg += scrapMetalCount * scrapMetalPerUnit;
        if (r.scrap_metal_loose_on_pallets) agg.scrapMetalLooseOnPalletsCount += scrapMetalCount;
      });
      setBalesDolavData(agg);

      // Haulage query - use customer's data_hub_customer name when in portal view
      const haulageCustomerFilter = dataHubCustomerName ?? (customerId ? null : "%staci%");
      
      let haulageJobs: any[] = [];
      if (haulageCustomerFilter) {
        const { data: hjData } = customerId
          ? await supabase
              .from("data_hub_jobs")
              .select("job_number, raw, container_type")
              .eq("customer", dataHubCustomerName!)
              .eq("source", "skiptrak")
              .gte("job_date", from)
              .lte("job_date", to)
          : await supabase
              .from("data_hub_jobs")
              .select("job_number, raw, container_type")
              .ilike("customer", "%staci%")
              .eq("source", "skiptrak")
              .gte("job_date", from)
              .lte("job_date", to);
        haulageJobs = hjData ?? [];
      }

      if (haulageJobs.length > 0) {
        let articLoads = 0, articCost = 0;
        let pickupLoads = 0, pickupCost = 0;
        haulageJobs.forEach((j: any) => {
          const cost = parseFloat(j.raw?.Cost ?? j.raw?.cost ?? "0");
          if (isNaN(cost)) return;
          const ct = (j.container_type ?? j.raw?.["Container Type"] ?? "").toLowerCase();
          const isPickup = ct.includes("dolav") || ct.includes("pickup") || ct.includes("box");
          if (isPickup) { pickupLoads++; pickupCost += cost; }
          else { articLoads++; articCost += cost; }
        });
        setHaulageData({
          artic: { loads: articLoads, totalCost: articCost, rate: articLoads > 0 ? articCost / articLoads : 145 },
          pickup: { loads: pickupLoads, totalCost: pickupCost, rate: pickupLoads > 0 ? pickupCost / pickupLoads : 15 },
          totalLoads: articLoads + pickupLoads,
          totalCost: articCost + pickupCost,
        });
      } else {
        setHaulageData({ artic: { loads: 0, totalCost: 0, rate: 145 }, pickup: { loads: 0, totalCost: 0, rate: 15 }, totalLoads: 0, totalCost: 0 });
      }

      const { data: ratesData } = await supabase
        .from("staci_pallet_rates")
        .select("colour, rate, effective_from")
        .lte("effective_from", from)
        .order("effective_from", { ascending: false });

      if (ratesData && ratesData.length > 0) {
        const rateMap: Record<string, number> = {};
        for (const r of ratesData) {
          if (!(r.colour in rateMap)) rateMap[r.colour] = Number(r.rate);
        }
        setDbPalletRates(rateMap);
      } else {
        setDbPalletRates(Object.fromEntries(Object.entries(STACI_PALLET_RATES)));
      }

      const { data: chargesData } = await supabase
        .from("staci_pallet_charges")
        .select("charge_key, charge_value, effective_from")
        .lte("effective_from", from)
        .order("effective_from", { ascending: false });

      if (chargesData && chargesData.length > 0) {
        const chargeMap: Record<string, number> = {};
        for (const c of chargesData) {
          if (!(c.charge_key in chargeMap)) chargeMap[c.charge_key] = Number(c.charge_value);
        }
        setDbGoodPalletRebate(chargeMap["good_pallet_rebate"] ?? STACI_PALLET_GOOD_REBATE);
        setDbPalletWeightCharge(chargeMap["pallet_weight_charge"] ?? -47);
      }

      // Bale rates - use customer's site or fall back to searching by name
      try {
        let staciSiteId: string | undefined;
        if (customerId && customerSiteIds.length > 0) {
          staciSiteId = customerSiteIds[0];
        } else {
          const { data: staciSites } = await supabase
            .from("customer_sites")
            .select("id, site_name, customers!inner(customer_name)")
            .ilike("customers.customer_name", "%staci%")
            .limit(1);
          staciSiteId = staciSites?.[0]?.id;
        }

        if (staciSiteId) {
          const { data: priceSetLink } = await supabase
            .from("customer_site_price_sets")
            .select("price_set_id")
            .eq("site_id", staciSiteId)
            .single();

          if (priceSetLink?.price_set_id) {
            const { data: psItems } = await supabase
              .from("rebate_price_set_items")
              .select("rebate_item_id, value_type, set_value, adjustment, value_type_item_id")
              .eq("price_set_id", priceSetLink.price_set_id);

            const { data: wasteTypes } = await supabase
              .from("load_waste_types")
              .select("id, waste_type")
              .in("waste_type", ["Card Bales", "Films Baled- Clear", "Films Baled- Mixed Colour", "Scrap Ferrous"]);

            const wasteTypeMap = Object.fromEntries((wasteTypes ?? []).map(w => [w.id, w.waste_type]));

            const monthsInRange = eachMonthOfInterval({ start: dateFrom, end: dateTo });
            const monthStarts = monthsInRange.map(m => format(startOfMonth(m), "yyyy-MM-dd"));
            const { data: monthlyValues } = await supabase
              .from("rebate_monthly_values")
              .select("item_id, lower_range, higher_range, month_start")
              .in("month_start", monthStarts);

            const valueAccumulator: Record<string, { lowerSum: number; higherSum: number; count: number }> = {};
            for (const mv of monthlyValues ?? []) {
              if (!valueAccumulator[mv.item_id]) {
                valueAccumulator[mv.item_id] = { lowerSum: 0, higherSum: 0, count: 0 };
              }
              valueAccumulator[mv.item_id].lowerSum += mv.lower_range ?? 0;
              valueAccumulator[mv.item_id].higherSum += mv.higher_range ?? 0;
              valueAccumulator[mv.item_id].count += 1;
            }

            let cardRate = 0;
            let filmsRate = 0;
            let scrapMetalRate = 0;

            for (const item of psItems ?? []) {
              const wtName = wasteTypeMap[item.rebate_item_id];
              if (!wtName) continue;

              let rate = 0;
              if (item.value_type === "set" && item.set_value != null) {
                rate = Number(item.set_value);
              } else if (item.value_type_item_id) {
                const acc = valueAccumulator[item.value_type_item_id];
                if (acc && acc.count > 0) {
                  const avgVal = item.value_type === "higher"
                    ? acc.higherSum / acc.count
                    : acc.lowerSum / acc.count;
                  rate = avgVal;
                }
              }
              rate += Number(item.adjustment ?? 0);

              if (wtName === "Card Bales") cardRate = rate;
              if (wtName.startsWith("Films Baled")) filmsRate = rate;
              if (wtName === "Scrap Ferrous") scrapMetalRate = rate;
            }

            setBaleRates({ cardBalesRate: cardRate, filmsRate, scrapMetalRate });
          }
        }
      } catch (e) {
        console.error("Failed to fetch bale rates from rebate setup:", e);
      }

      setFetching(false);
    };
    fetchData();
  }, [dateFrom, dateTo, customerId]);

  const stats = useMemo(() => {
    const colourMap: Record<string, { count: number; weightKg: number; cost: number }> = {};
    let totalPallets = 0;
    let totalWeightKg = 0;
    let totalCost = 0;
    let goodPallets = 0;
    let scrapPallets = 0;

    rows.forEach((r) => {
      const count = r.pallet_count;
      const grossWeightPerPallet = r.weight_kg;
      const totalGrossWeight = grossWeightPerPallet * count;
      const rate = dbPalletRates[r.colour] ?? STACI_PALLET_RATES[r.colour] ?? 0;
      const isWasteWood = r.colour === "waste_wood";
      const lineCost = isWasteWood
        ? (totalGrossWeight / 1000) * rate
        : rate * count;

      if (!colourMap[r.colour]) colourMap[r.colour] = { count: 0, weightKg: 0, cost: 0 };
      colourMap[r.colour].count += count;
      colourMap[r.colour].weightKg += totalGrossWeight;
      colourMap[r.colour].cost += lineCost;

      totalPallets += count;
      totalWeightKg += totalGrossWeight;
      totalCost += lineCost;

      if (r.pallet_type === "good") goodPallets += count;
      else scrapPallets += count;
    });

    // Add pallet tare weight as waste_wood — from pallet entries AND bales/dolavs "on pallets"
    const palletEntryTareCount = totalPallets; // every pallet entry sits on a wooden pallet
    const onPalletsCount = balesDolavData.cardBalesOnPalletsCount + balesDolavData.filmsBaleOnPalletsCount + balesDolavData.papersDolavOnPalletsCount + balesDolavData.glassDolavOnPalletsCount + balesDolavData.scrapMetalLooseOnPalletsCount;
    const totalWoodPallets = palletEntryTareCount + onPalletsCount;
    if (totalWoodPallets > 0) {
      const tareWeightKg = totalWoodPallets * TARE_KG;
      const wasteWoodRate = dbPalletRates["waste_wood"] ?? STACI_PALLET_RATES["waste_wood"] ?? 45;
      const tareCharge = (tareWeightKg / 1000) * wasteWoodRate;
      if (!colourMap["waste_wood"]) colourMap["waste_wood"] = { count: 0, weightKg: 0, cost: 0 };
      colourMap["waste_wood"].count += totalWoodPallets;
      colourMap["waste_wood"].weightKg += tareWeightKg;
      colourMap["waste_wood"].cost += tareCharge;
      // Don't re-add palletEntryTareCount to totalPallets — those are already counted above
      totalPallets += onPalletsCount;
      totalWeightKg += tareWeightKg;
      totalCost += tareCharge;
    }

    const palletRebate = goodPallets * dbGoodPalletRebate;
    const netCost = totalCost - palletRebate;

    const wasteAgg: Record<string, number> = {};
    let totalBreakdownWeight = 0;

    rows.forEach((r) => {
      if (!r.waste_breakdown) return;
      const grossWeightPerPallet = r.weight_kg;
      const entryWeight = grossWeightPerPallet * r.pallet_count;
      (Object.keys(r.waste_breakdown) as (keyof StaciWasteBreakdown)[]).forEach((key) => {
        const pct = (r.waste_breakdown as StaciWasteBreakdown)[key] ?? 0;
        const kg = (pct / 100) * entryWeight;
        wasteAgg[key] = (wasteAgg[key] ?? 0) + kg;
        totalBreakdownWeight += kg;
      });
    });

    // Include bales, dolavs, and scrap metal loose in waste breakdown
    if (balesDolavData.cardBalesWeightKg > 0) {
      wasteAgg["card"] = (wasteAgg["card"] ?? 0) + balesDolavData.cardBalesWeightKg;
      totalBreakdownWeight += balesDolavData.cardBalesWeightKg;
    }
    if (balesDolavData.filmsBaleWeightKg > 0) {
      wasteAgg["shrink_wrap"] = (wasteAgg["shrink_wrap"] ?? 0) + balesDolavData.filmsBaleWeightKg;
      totalBreakdownWeight += balesDolavData.filmsBaleWeightKg;
    }
    if (balesDolavData.papersDolavWeightKg > 0) {
      wasteAgg["paper"] = (wasteAgg["paper"] ?? 0) + balesDolavData.papersDolavWeightKg;
      totalBreakdownWeight += balesDolavData.papersDolavWeightKg;
    }
    if (balesDolavData.glassDolavWeightKg > 0) {
      // Glass doesn't have a StaciWasteBreakdown key, add as a custom entry
      wasteAgg["glass"] = (wasteAgg["glass"] ?? 0) + balesDolavData.glassDolavWeightKg;
      totalBreakdownWeight += balesDolavData.glassDolavWeightKg;
    }
    if (balesDolavData.scrapMetalLooseWeightKg > 0) {
      wasteAgg["scrap_metal"] = (wasteAgg["scrap_metal"] ?? 0) + balesDolavData.scrapMetalLooseWeightKg;
      totalBreakdownWeight += balesDolavData.scrapMetalLooseWeightKg;
    }
    // Add ALL pallet tare weight as wood in waste breakdown
    if (totalWoodPallets > 0) {
      const tareWeightKg = totalWoodPallets * TARE_KG;
      wasteAgg["wood"] = (wasteAgg["wood"] ?? 0) + tareWeightKg;
      totalBreakdownWeight += tareWeightKg;
    }

    const wasteRows = Object.entries(wasteAgg)
      .filter(([, kg]) => kg > 0)
      .map(([key, kg]) => ({
        key: key as keyof StaciWasteBreakdown,
        label: WASTE_TYPE_LABELS[key as keyof StaciWasteBreakdown] ?? (key === "glass" ? "Glass" : key),
        kg,
        tonnes: kg / 1000,
        pct: totalBreakdownWeight > 0 ? (kg / totalBreakdownWeight) * 100 : 0,
        recyclable: RECYCLABLE_WASTE_TYPES.includes(key as any) || key === "glass",
        nonRecoverable: NON_RECYCLABLE_WASTE_TYPES.includes(key as any),
        wood: key === WOOD_TYPE,
      }))
      .sort((a, b) => b.kg - a.kg);

    const recyclableKg = wasteRows.filter((w) => w.recyclable).reduce((s, w) => s + w.kg, 0);
    const nonRecoverableKg = wasteRows.filter((w) => w.nonRecoverable).reduce((s, w) => s + w.kg, 0);
    const woodKg = wasteRows.filter((w) => w.wood).reduce((s, w) => s + w.kg, 0);

    return {
      colourMap, totalPallets, totalWeightKg, totalCost, goodPallets, scrapPallets,
      palletRebate, netCost, wasteRows, totalBreakdownWeight, recyclableKg, nonRecoverableKg, woodKg,
    };
  }, [rows, dbPalletRates, dbGoodPalletRebate, balesDolavData]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ["STACI Recycling Report"],
      ["Period", `${format(dateFrom, "dd/MM/yyyy")} – ${format(dateTo, "dd/MM/yyyy")}`],
      ["Generated", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Metric", "Value"],
      ["Total Pallets", stats.totalPallets],
      ["Total Weight (kg)", Math.round(stats.totalWeightKg)],
      ["Total Weight (t)", (stats.totalWeightKg / 1000).toFixed(2)],
      ["Good Pallets", stats.goodPallets],
      ["Scrap Pallets", stats.scrapPallets],
      ["Gross Cost (£)", stats.totalCost.toFixed(2)],
      ["Pallet Rebate (£)", stats.palletRebate.toFixed(2)],
      ["Net Cost (£)", stats.netCost.toFixed(2)],
      [],
      ["Haulage"],
      ["Artic Loads", haulageData.artic.loads],
      ["Artic Rate (£)", haulageData.artic.rate.toFixed(2)],
      ["Artic Total (£)", haulageData.artic.totalCost.toFixed(2)],
      ["Pickup/Dolav Loads", haulageData.pickup.loads],
      ["Pickup/Dolav Rate (£)", haulageData.pickup.rate.toFixed(2)],
      ["Pickup/Dolav Total (£)", haulageData.pickup.totalCost.toFixed(2)],
      ["Total Haulage Cost (£)", haulageData.totalCost.toFixed(2)],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");

    const colourData = [
      ["Colour", "Pallets", "Weight (kg)", "Rate", "Cost (£)"],
      ...Object.entries(stats.colourMap).map(([colour, d]) => [
        STACI_COLOUR_CONFIG[colour as StaciPalletColour]?.label ?? colour,
        d.count,
        Math.round(d.weightKg),
        `£${(dbPalletRates[colour] ?? STACI_PALLET_RATES[colour as StaciPalletColour])?.toFixed(2) ?? "0.00"}`,
        d.cost.toFixed(2),
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(colourData);
    XLSX.utils.book_append_sheet(wb, ws2, "Pallet Breakdown");

    const recyclingData = [
      ["STACI Recycling Report"],
      ["Period", `${format(dateFrom, "dd/MM/yyyy")} – ${format(dateTo, "dd/MM/yyyy")}`],
      [],
      ["Waste Type", "Weight (kg)", "Weight (t)", "% of Total", "Category"],
      ...stats.wasteRows.map((w) => [
        w.label,
        Math.round(w.kg),
        w.tonnes.toFixed(2),
        w.pct.toFixed(1) + "%",
        w.recyclable ? "Recyclable" : "Waste For Energy",
      ]),
      [],
      ["Category", "Weight (kg)", "% of Total"],
      ["Recyclable", Math.round(stats.recyclableKg), stats.totalBreakdownWeight > 0 ? ((stats.recyclableKg / stats.totalBreakdownWeight) * 100).toFixed(1) + "%" : "0%"],
      ["Waste For Energy", Math.round(stats.nonRecoverableKg), stats.totalBreakdownWeight > 0 ? ((stats.nonRecoverableKg / stats.totalBreakdownWeight) * 100).toFixed(1) + "%" : "0%"],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(recyclingData);
    XLSX.utils.book_append_sheet(wb, ws3, "Recycling Report");

    const rawData = [
      ["Date", "Site", "Customer", "Description", "Colour", "Pallet Count", "Weight (kg)", "Type"],
      ...rows.map((r) => [
        r.report_date,
        r.site_name ?? "",
        r.customer_name ?? "",
        r.description ?? "",
        STACI_COLOUR_CONFIG[r.colour]?.label ?? r.colour,
        r.pallet_count,
        r.weight_kg,
        r.pallet_type,
      ]),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, ws4, "Raw Data");

    XLSX.writeFile(wb, `STACI_Report_${format(dateFrom, "yyyyMMdd")}_${format(dateTo, "yyyyMMdd")}.xlsx`);
    toast({ title: "Report exported" });
  };

  const pieData = useMemo(() => {
    const recyclablePct = stats.totalBreakdownWeight > 0 ? (stats.recyclableKg / stats.totalBreakdownWeight) * 100 : 0;
    const nonRecoverablePct = stats.totalBreakdownWeight > 0 ? (stats.nonRecoverableKg / stats.totalBreakdownWeight) * 100 : 0;
    return [
      { name: "Recyclable", value: +recyclablePct.toFixed(1), fill: "hsl(142, 71%, 45%)" },
      { name: "Waste For Energy", value: +nonRecoverablePct.toFixed(1), fill: "hsl(0, 72%, 51%)" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const colourBarData = useMemo(() => {
    return Object.entries(stats.colourMap).map(([colour, d]) => ({
      name: STACI_COLOUR_CONFIG[colour as StaciPalletColour]?.label ?? colour,
      pallets: d.count,
      cost: +d.cost.toFixed(2),
      fill: colour === "red" ? "hsl(0, 72%, 51%)" : colour === "yellow" ? "hsl(48, 96%, 53%)" : colour === "blue" ? "hsl(217, 91%, 60%)" : colour === "green" ? "hsl(142, 71%, 45%)" : "hsl(30, 60%, 45%)",
    }));
  }, [stats]);

  // Compute KPI financial totals for use in both KPI cards and Monthly Report
  const kpiFinancials = useMemo(() => {
    const cardRebateValue = (balesDolavData.cardBalesWeightKg / 1000) * baleRates.cardBalesRate;
    const filmsRebateValue = (balesDolavData.filmsBaleWeightKg / 1000) * baleRates.filmsRate;
    const scrapMetalRebateValue = (balesDolavData.scrapMetalLooseWeightKg / 1000) * baleRates.scrapMetalRate;
    const totalRebates = stats.palletRebate + cardRebateValue + filmsRebateValue + scrapMetalRebateValue;
    const monthlyRecyclingInvoice = stats.totalCost - totalRebates;
    const monthlyNetCost = haulageData.totalCost + stats.totalCost - totalRebates;
    return { monthlyNetCost, monthlyRecyclingInvoice };
  }, [stats, balesDolavData, baleRates, haulageData]);

  return (
    <div className="space-y-8">
      {/* Date range */}
      <Card>
        <CardContent className="py-4 flex flex-wrap items-center gap-4">
          <Select value={dateMode} onValueChange={(v) => {
            const mode = v as "range" | "month";
            setDateMode(mode);
            if (mode === "month") {
              setDateFrom(startOfMonth(dateFrom));
              setDateTo(endOfMonth(dateFrom));
            }
          }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="range">Date Range</SelectItem>
            </SelectContent>
          </Select>

          {dateMode === "month" ? (
            <>
              <Button variant="outline" size="icon" onClick={() => {
                const prev = subMonths(dateFrom, 1);
                setDateFrom(startOfMonth(prev));
                setDateTo(endOfMonth(prev));
              }}>
                <span className="text-lg">‹</span>
              </Button>
              <span className="font-medium min-w-[120px] text-center">
                {format(dateFrom, "MMMM yyyy")}
              </span>
              <Button variant="outline" size="icon" onClick={() => {
                const next = addMonths(dateFrom, 1);
                setDateFrom(startOfMonth(next));
                setDateTo(endOfMonth(next));
              }}>
                <span className="text-lg">›</span>
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-muted-foreground">Period:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, "dd MMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </>
          )}

          <div className="ml-auto">
            <Button onClick={handleExport} disabled={rows.length === 0} variant="outline" className="gap-2">
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>

          {fetching && <span className="text-sm text-muted-foreground animate-pulse">Loading…</span>}
        </CardContent>
      </Card>

      {rows.length === 0 && !fetching && balesDolavData.cardBalesCount === 0 && balesDolavData.filmsBaleCount === 0 && balesDolavData.papersDolavCount === 0 && balesDolavData.glassDolavCount === 0 && balesDolavData.scrapMetalLooseCount === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No submitted STACI load reports found for this period.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Pallets", value: stats.totalPallets.toLocaleString() },
              { label: "Total Weight", value: `${((stats.totalWeightKg + balesDolavData.cardBalesWeightKg + balesDolavData.filmsBaleWeightKg + balesDolavData.papersDolavWeightKg + balesDolavData.glassDolavWeightKg + balesDolavData.scrapMetalLooseWeightKg) / 1000).toFixed(2)} t` },
              { label: "Monthly Net Cost", value: `£${kpiFinancials.monthlyNetCost.toFixed(2)}`, highlight: true },
              { label: "Monthly Recycling Invoice", value: `£${kpiFinancials.monthlyRecyclingInvoice.toFixed(2)}` },
              { label: "Haulage", value: haulageData.totalLoads > 0 ? `${haulageData.totalLoads} loads` : "—" },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="py-4 text-center">
                  <p className={`text-2xl font-bold ${(kpi as any).highlight ? "text-primary" : "text-foreground"}`}>{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Haulage summary table */}
          {haulageData.totalLoads > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Haulage Costs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Loads</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Rate</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total (£)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {haulageData.artic.loads > 0 && (
                        <tr className="border-b border-border/50">
                          <td className="py-1.5 px-3">Artic</td>
                          <td className="py-1.5 px-3 text-right">{haulageData.artic.loads}</td>
                          <td className="py-1.5 px-3 text-right">£{haulageData.artic.rate.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right font-medium">£{haulageData.artic.totalCost.toFixed(2)}</td>
                        </tr>
                      )}
                      {haulageData.pickup.loads > 0 && (
                        <tr className="border-b border-border/50">
                          <td className="py-1.5 px-3">Pickup / Dolav Box</td>
                          <td className="py-1.5 px-3 text-right">{haulageData.pickup.loads}</td>
                          <td className="py-1.5 px-3 text-right">£{haulageData.pickup.rate.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right font-medium">£{haulageData.pickup.totalCost.toFixed(2)}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td className="py-2 px-3">Total</td>
                        <td className="py-2 px-3 text-right">{haulageData.totalLoads}</td>
                        <td className="py-2 px-3 text-right" />
                        <td className="py-2 px-3 text-right">£{haulageData.totalCost.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pallet colour breakdown table + bar chart */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pallet Colour Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Colour</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Pallets</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Rate</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Cost (£)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats.colourMap).map(([colour, d]) => (
                        <tr key={colour} className="border-b border-border/50">
                          <td className="py-1.5 px-3 flex items-center gap-2">
                            <span className={cn("w-3 h-3 rounded-full", STACI_COLOUR_CONFIG[colour as StaciPalletColour]?.bgColor)} />
                            {STACI_COLOUR_CONFIG[colour as StaciPalletColour]?.label ?? colour}
                          </td>
                          <td className="py-1.5 px-3 text-right">{d.count}</td>
                          <td className="py-1.5 px-3 text-right">{(d.weightKg / 1000).toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right">£{(dbPalletRates[colour] ?? STACI_PALLET_RATES[colour as StaciPalletColour])?.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right font-medium">{d.cost >= 0 ? `£${d.cost.toFixed(2)}` : `-£${Math.abs(d.cost).toFixed(2)}`}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td className="py-2 px-3">Total</td>
                        <td className="py-2 px-3 text-right">{stats.totalPallets}</td>
                        <td className="py-2 px-3 text-right">{(stats.totalWeightKg / 1000).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right" />
                        <td className="py-2 px-3 text-right">£{stats.totalCost.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cost by Colour</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={colourBarData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(v: number) => [`£${v.toFixed(2)}`, "Cost"]} />
                    <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                      {colourBarData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Pallets, Bales & Dolavs Breakdown */}
          {(stats.goodPallets > 0 || balesDolavData.cardBalesCount > 0 || balesDolavData.filmsBaleCount > 0 || balesDolavData.papersDolavCount > 0 || balesDolavData.glassDolavCount > 0 || balesDolavData.scrapMetalLooseCount > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pallets, Bales & Dolavs Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Qty</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Wt/Item (kg)</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Net Total Weight (kg)</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Rate</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Value (£)</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.goodPallets > 0 && (
                        <tr className="border-b border-border/50">
                          <td className="py-1.5 px-3">Good Pallets (Rebate)</td>
                          <td className="py-1.5 px-3 text-right">{stats.goodPallets}</td>
                          <td className="py-1.5 px-3 text-right">-</td>
                          <td className="py-1.5 px-3 text-right">-</td>
                          <td className="py-1.5 px-3 text-right">-</td>
                          <td className="py-1.5 px-3 text-right text-green-600">-£{dbGoodPalletRebate.toFixed(2)}/ea</td>
                          <td className="py-1.5 px-3 text-right font-medium text-green-600">-£{stats.palletRebate.toFixed(2)}</td>
                          <td className="py-1.5 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Rebate</span></td>
                        </tr>
                      )}
                      {balesDolavData.cardBalesCount > 0 && (() => {
                        const cardValuePerTonne = baleRates.cardBalesRate;
                        const netWeightKg = balesDolavData.cardBalesWeightKg - (balesDolavData.cardBalesOnPalletsCount * TARE_KG);
                        const cardTonnes = netWeightKg / 1000;
                        const cardValue = cardTonnes * cardValuePerTonne;
                        return (
                          <tr className="border-b border-border/50">
                            <td className="py-1.5 px-3">Card Bales</td>
                            <td className="py-1.5 px-3 text-right">{balesDolavData.cardBalesCount}</td>
                            <td className="py-1.5 px-3 text-right">{balesDolavData.cardBalesCount > 0 ? Math.round(balesDolavData.cardBalesWeightKg / balesDolavData.cardBalesCount).toLocaleString() : "-"}</td>
                            <td className="py-1.5 px-3 text-right">{netWeightKg.toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-right">{cardTonnes.toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right text-green-600">
                              {cardValuePerTonne !== 0 ? `-£${Math.abs(cardValuePerTonne).toFixed(2)}/t` : "-"}
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium text-green-600">
                              {cardValuePerTonne !== 0 ? `-£${cardValue.toFixed(2)}` : "-"}
                            </td>
                            <td className="py-1.5 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Rebate</span></td>
                          </tr>
                        );
                      })()}
                      {balesDolavData.filmsBaleCount > 0 && (() => {
                        const filmsValuePerTonne = baleRates.filmsRate;
                        const netWeightKg = balesDolavData.filmsBaleWeightKg - (balesDolavData.filmsBaleOnPalletsCount * TARE_KG);
                        const filmsTonnes = netWeightKg / 1000;
                        const filmsValue = filmsTonnes * filmsValuePerTonne;
                        return (
                          <tr className="border-b border-border/50">
                            <td className="py-1.5 px-3">Films Bale</td>
                            <td className="py-1.5 px-3 text-right">{balesDolavData.filmsBaleCount}</td>
                            <td className="py-1.5 px-3 text-right">{balesDolavData.filmsBaleCount > 0 ? Math.round(balesDolavData.filmsBaleWeightKg / balesDolavData.filmsBaleCount).toLocaleString() : "-"}</td>
                            <td className="py-1.5 px-3 text-right">{netWeightKg.toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-right">{filmsTonnes.toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right text-green-600">
                              {filmsValuePerTonne !== 0 ? `-£${Math.abs(filmsValuePerTonne).toFixed(2)}/t` : "-"}
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium text-green-600">
                              {filmsValuePerTonne !== 0 ? `-£${filmsValue.toFixed(2)}` : "-"}
                            </td>
                            <td className="py-1.5 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Rebate</span></td>
                          </tr>
                        );
                      })()}
                      {balesDolavData.papersDolavCount > 0 && (() => {
                        const netWeightKg = balesDolavData.papersDolavWeightKg - (balesDolavData.papersDolavOnPalletsCount * TARE_KG);
                        return (
                          <tr className="border-b border-border/50">
                            <td className="py-1.5 px-3">Papers Dolav</td>
                            <td className="py-1.5 px-3 text-right">{balesDolavData.papersDolavCount}</td>
                            <td className="py-1.5 px-3 text-right">{balesDolavData.papersDolavCount > 0 ? Math.round(balesDolavData.papersDolavWeightKg / balesDolavData.papersDolavCount).toLocaleString() : "-"}</td>
                            <td className="py-1.5 px-3 text-right">{netWeightKg.toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-right">{(netWeightKg / 1000).toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right">-</td>
                            <td className="py-1.5 px-3 text-right">-</td>
                            <td className="py-1.5 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Rebate</span></td>
                          </tr>
                        );
                      })()}
                      {balesDolavData.glassDolavCount > 0 && (() => {
                        const netWeightKg = balesDolavData.glassDolavWeightKg - (balesDolavData.glassDolavOnPalletsCount * TARE_KG);
                        return (
                          <tr className="border-b border-border/50">
                            <td className="py-1.5 px-3">Glass Dolav</td>
                            <td className="py-1.5 px-3 text-right">{balesDolavData.glassDolavCount}</td>
                            <td className="py-1.5 px-3 text-right">{balesDolavData.glassDolavCount > 0 ? Math.round(balesDolavData.glassDolavWeightKg / balesDolavData.glassDolavCount).toLocaleString() : "-"}</td>
                            <td className="py-1.5 px-3 text-right">{netWeightKg.toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-right">{(netWeightKg / 1000).toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right">-</td>
                            <td className="py-1.5 px-3 text-right">-</td>
                            <td className="py-1.5 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Rebate</span></td>
                          </tr>
                        );
                      })()}
                      {balesDolavData.scrapMetalLooseCount > 0 && (() => {
                        const scrapMetalValuePerTonne = baleRates.scrapMetalRate;
                        const netWeightKg = balesDolavData.scrapMetalLooseWeightKg - (balesDolavData.scrapMetalLooseOnPalletsCount * TARE_KG);
                        const scrapMetalTonnes = netWeightKg / 1000;
                        const scrapMetalValue = scrapMetalTonnes * scrapMetalValuePerTonne;
                        return (
                          <tr className="border-b border-border/50">
                            <td className="py-1.5 px-3">Scrap Metal Loose</td>
                            <td className="py-1.5 px-3 text-right">{balesDolavData.scrapMetalLooseCount}</td>
                            <td className="py-1.5 px-3 text-right">{Math.round(balesDolavData.scrapMetalLooseWeightKg / balesDolavData.scrapMetalLooseCount).toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-right">{netWeightKg.toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-right">{scrapMetalTonnes.toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right text-green-600">
                              {scrapMetalValuePerTonne !== 0 ? `-£${Math.abs(scrapMetalValuePerTonne).toFixed(2)}/t` : "-"}
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium text-green-600">
                              {scrapMetalValuePerTonne !== 0 ? `-£${Math.abs(scrapMetalValue).toFixed(2)}` : "-"}
                            </td>
                            <td className="py-1.5 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Rebate</span></td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const onPalletsCount = balesDolavData.cardBalesOnPalletsCount + balesDolavData.filmsBaleOnPalletsCount + balesDolavData.papersDolavOnPalletsCount + balesDolavData.glassDolavOnPalletsCount + balesDolavData.scrapMetalLooseOnPalletsCount;
                        if (onPalletsCount === 0) return null;
                        const palletWeightT = onPalletsCount * TARE_KG / 1000;
                        const chargePerTonne = dbPalletWeightCharge;
                        const palletWeightChargeCost = palletWeightT * Math.abs(chargePerTonne);
                        return (
                          <tr className="border-b border-border/50">
                            <td className="py-1.5 px-3">Pallet Weight Charge</td>
                            <td className="py-1.5 px-3 text-right">{onPalletsCount}</td>
                            <td className="py-1.5 px-3 text-right">-</td>
                            <td className="py-1.5 px-3 text-right">{(onPalletsCount * TARE_KG).toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-right">{palletWeightT.toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right text-destructive">£{Math.abs(chargePerTonne).toFixed(2)}/t</td>
                            <td className="py-1.5 px-3 text-right font-medium text-destructive">£{palletWeightChargeCost.toFixed(2)}</td>
                            <td className="py-1.5 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Charge</span></td>
                          </tr>
                        );
                      })()}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const onPalletsCount = balesDolavData.cardBalesOnPalletsCount + balesDolavData.filmsBaleOnPalletsCount + balesDolavData.papersDolavOnPalletsCount + balesDolavData.glassDolavOnPalletsCount + balesDolavData.scrapMetalLooseOnPalletsCount;
                        const cardNetKg = balesDolavData.cardBalesWeightKg - (balesDolavData.cardBalesOnPalletsCount * TARE_KG);
                        const filmsNetKg = balesDolavData.filmsBaleWeightKg - (balesDolavData.filmsBaleOnPalletsCount * TARE_KG);
                        const papersNetKg = balesDolavData.papersDolavWeightKg - (balesDolavData.papersDolavOnPalletsCount * TARE_KG);
                        const glassNetKg = balesDolavData.glassDolavWeightKg - (balesDolavData.glassDolavOnPalletsCount * TARE_KG);
                        const scrapMetalNetKg = balesDolavData.scrapMetalLooseWeightKg - (balesDolavData.scrapMetalLooseOnPalletsCount * TARE_KG);
                        const cardValue = (cardNetKg / 1000) * baleRates.cardBalesRate;
                        const filmsValue = (filmsNetKg / 1000) * baleRates.filmsRate;
                        const scrapMetalValue = (scrapMetalNetKg / 1000) * baleRates.scrapMetalRate;
                        const totalQty = stats.goodPallets + balesDolavData.cardBalesCount + balesDolavData.filmsBaleCount + balesDolavData.papersDolavCount + balesDolavData.glassDolavCount + balesDolavData.scrapMetalLooseCount;
                        const netItemsWeightKg = cardNetKg + filmsNetKg + papersNetKg + glassNetKg + scrapMetalNetKg;
                        const totalWeightKg = netItemsWeightKg + (onPalletsCount * TARE_KG);
                        const totalWeightT = totalWeightKg / 1000;
                        const totalRebate = stats.palletRebate + cardValue + filmsValue + scrapMetalValue;
                        const palletWeightChargeCost = (onPalletsCount * TARE_KG / 1000) * Math.abs(dbPalletWeightCharge);
                        const netValue = totalRebate - palletWeightChargeCost;
                        return (
                          <tr className="border-t-2 font-semibold">
                            <td className="py-2 px-3">Total</td>
                            <td className="py-2 px-3 text-right">{totalQty}</td>
                            <td className="py-2 px-3 text-right">-</td>
                            <td className="py-2 px-3 text-right">{totalWeightKg.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right">{totalWeightT.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right" />
                            <td className={`py-2 px-3 text-right font-medium ${netValue > 0 ? "text-green-600" : "text-destructive"}`}>
                              {netValue >= 0 ? `-£${netValue.toFixed(2)}` : `£${Math.abs(netValue).toFixed(2)}`}
                            </td>
                            <td />
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Waste breakdown */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Waste Type Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Material</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">%</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.wasteRows.map((w) => (
                        <tr key={w.key} className="border-b border-border/50">
                          <td className="py-1.5 px-3">{w.label}</td>
                          <td className="py-1.5 px-3 text-right">{w.tonnes.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right">{w.pct.toFixed(1)}%</td>
                          <td className="py-1.5 px-3">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full", w.recyclable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                              {w.recyclable ? "Recyclable" : "Waste For Energy"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td className="py-2 px-3">Total</td>
                        <td className="py-2 px-3 text-right">{(stats.totalBreakdownWeight / 1000).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">100%</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-green-500/10">
                    <p className="text-lg font-bold text-green-600">{stats.totalBreakdownWeight > 0 ? ((stats.recyclableKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0}%</p>
                    <p className="text-xs text-muted-foreground">Recyclable</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-500/10">
                    <p className="text-lg font-bold text-red-600">{stats.totalBreakdownWeight > 0 ? ((stats.nonRecoverableKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0}%</p>
                    <p className="text-xs text-muted-foreground">Waste For Energy</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recyclable vs Waste For Energy</CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={60} label={({ name, value }) => `${name}: ${value}%`}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No waste breakdown data</div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Load Report Cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-5 w-5" />
            Individual Load Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StaciLoadReportCards dateFrom={format(dateFrom, "yyyy-MM-dd")} dateTo={format(dateTo, "yyyy-MM-dd")} />
        </CardContent>
      </Card>

      {/* Monthly Report Section */}
      <StaciMonthlyReport
        customerId={customerId}
        customerName={customerName}
        isPortalView={isPortalView}
        dashboardStats={stats}
        dashboardHaulage={haulageData}
        balesDolavTotalWeightKg={balesDolavData.cardBalesWeightKg + balesDolavData.filmsBaleWeightKg + balesDolavData.papersDolavWeightKg + balesDolavData.glassDolavWeightKg + balesDolavData.scrapMetalLooseWeightKg}
        monthlyNetCost={kpiFinancials.monthlyNetCost}
        monthlyRecyclingInvoice={kpiFinancials.monthlyRecyclingInvoice}
        dateFrom={dateFrom}
        dateTo={dateTo}
        dashboardLoading={fetching}
      />
    </div>
  );
}
