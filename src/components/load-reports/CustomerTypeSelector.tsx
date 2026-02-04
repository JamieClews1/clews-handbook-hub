import { Truck, Warehouse } from "lucide-react";

export type CustomerType = "yard" | "mrf";

interface CustomerTypeSelectorProps {
  onSelect: (customer: CustomerType) => void;
}

const customerTypes: { id: CustomerType; name: string; icon: React.ReactNode; available: boolean }[] = [
  { id: "yard", name: "Yard Reports", icon: <Warehouse className="h-8 w-8" />, available: true },
  { id: "mrf", name: "MRF Reports", icon: <Truck className="h-8 w-8" />, available: true },
];

export const CustomerTypeSelector = ({ onSelect }: CustomerTypeSelectorProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
          <Truck className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Load Reports</h1>
          <p className="text-muted-foreground text-sm">
            Track pallet loads and weights for recyclables
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-8">
        {customerTypes.map((customer) => (
          <button
            key={customer.id}
            onClick={() => customer.available && onSelect(customer.id)}
            disabled={!customer.available}
            className={`
              relative flex flex-col items-center justify-center
              min-h-[120px] p-6 rounded-xl
              font-bold text-lg tracking-wide
              transition-all duration-200
              ${customer.available 
                ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] cursor-pointer shadow-lg hover:shadow-xl" 
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
              }
            `}
          >
            <div className="mb-2">{customer.icon}</div>
            {customer.name}
            {!customer.available && (
              <span className="text-xs font-normal mt-2 opacity-75">Coming Soon</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
