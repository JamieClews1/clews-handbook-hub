/** Transport-job pricing belongs to Route One, not the weighbridge ticket. */
export const hasWeighbridgePricing = (jobType: string | null | undefined) => jobType === "waste_in";