import { outgoingStream, midweighRowTonnes, type OutgoingStreamRow } from "./outgoing-waste-streams";
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^papers/, "paper");
export function recoveryStreamName(row: OutgoingStreamRow): string {
  if (/^WOOD[\s-]*A(?:\s+OUT)?$/i.test(row.product?.trim() ?? "")) return "Wood A";
  if (/^WOOD[\s-]*C(?:\s+OUT)?$/i.test(row.product?.trim() ?? "")) return "Wood C";
  return outgoingStream(row.ewc, row.waste_description, row.product);
}
export function measuredRecoveryRows(rows: OutgoingStreamRow[], costs: { stream: string; costPerTonne: number }[], baseline: number) {
  const groups = new Map<string, number>();
  rows.forEach(row => { const stream = recoveryStreamName(row); groups.set(stream, (groups.get(stream) ?? 0) + midweighRowTonnes(row)); });
  return [...groups.entries()].map(([stream, tonnes]) => {
    const matches = costs.filter(cost => key(cost.stream) === key(stream) || (stream === "Waste RDF" && key(cost.stream) === "rdf"));
    const cost = matches.length === 1 ? matches[0].costPerTonne : null;
    return { stream, tonnes, cost, saving: cost === null ? null : stream === "Landfill" ? 0 : tonnes * (baseline - cost) };
  }).sort((a, b) => b.tonnes - a.tonnes);
}