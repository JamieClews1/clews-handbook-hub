import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, XCircle, ClipboardList } from "lucide-react";

type Rating = 'good' | 'acceptable' | 'poor' | 'n/a' | null;

interface InspectionItem {
  category: string;
  field: string;
  label: string;
  rating: Rating;
  comment?: string;
}

interface FormData {
  housekeeping_general_cleanliness: Rating;
  housekeeping_waste_disposal: Rating;
  housekeeping_storage_areas: Rating;
  housekeeping_walkways_clear: Rating;
  housekeeping_comments: string;
  fire_extinguishers_accessible: Rating;
  fire_exits_clear: Rating;
  fire_signage_visible: Rating;
  fire_assembly_point_clear: Rating;
  fire_safety_comments: string;
  first_aid_kit_stocked: Rating;
  first_aid_signage: Rating;
  first_aid_trained_personnel: Rating;
  first_aid_comments: string;
  ppe_available: Rating;
  ppe_condition: Rating;
  ppe_being_worn: Rating;
  ppe_comments: string;
  equipment_condition: Rating;
  equipment_guarding: Rating;
  equipment_maintenance_records: Rating;
  equipment_comments: string;
  electrical_equipment_condition: Rating;
  electrical_cables_secure: Rating;
  electrical_pat_testing: Rating;
  electrical_comments: string;
  welfare_toilets_clean: Rating;
  welfare_drinking_water: Rating;
  welfare_rest_areas: Rating;
  welfare_comments: string;
  environmental_spill_kits: Rating;
  environmental_waste_segregation: Rating;
  environmental_drainage: Rating;
  environmental_comments: string;
}

interface TodoItem {
  id: string;
  category: string;
  item: string;
  priority: 'high' | 'medium';
  comment?: string;
  completed: boolean;
}

interface InspectionTodoListProps {
  formData: FormData;
  todoItems: TodoItem[];
  onTodoChange: (items: TodoItem[]) => void;
  isSubmitted: boolean;
}

const inspectionFields: Omit<InspectionItem, 'rating' | 'comment'>[] = [
  // Housekeeping
  { category: 'Housekeeping', field: 'housekeeping_general_cleanliness', label: 'General Cleanliness' },
  { category: 'Housekeeping', field: 'housekeeping_waste_disposal', label: 'Waste Disposal' },
  { category: 'Housekeeping', field: 'housekeeping_storage_areas', label: 'Storage Areas' },
  { category: 'Housekeeping', field: 'housekeeping_walkways_clear', label: 'Walkways Clear' },
  // Fire Safety
  { category: 'Fire Safety', field: 'fire_extinguishers_accessible', label: 'Fire Extinguishers Accessible' },
  { category: 'Fire Safety', field: 'fire_exits_clear', label: 'Fire Exits Clear' },
  { category: 'Fire Safety', field: 'fire_signage_visible', label: 'Fire Signage Visible' },
  { category: 'Fire Safety', field: 'fire_assembly_point_clear', label: 'Assembly Point Clear' },
  // First Aid
  { category: 'First Aid', field: 'first_aid_kit_stocked', label: 'First Aid Kit Stocked' },
  { category: 'First Aid', field: 'first_aid_signage', label: 'First Aid Signage' },
  { category: 'First Aid', field: 'first_aid_trained_personnel', label: 'Trained Personnel Available' },
  // PPE
  { category: 'PPE', field: 'ppe_available', label: 'PPE Available' },
  { category: 'PPE', field: 'ppe_condition', label: 'PPE Condition' },
  { category: 'PPE', field: 'ppe_being_worn', label: 'PPE Being Worn' },
  // Equipment
  { category: 'Equipment', field: 'equipment_condition', label: 'Equipment Condition' },
  { category: 'Equipment', field: 'equipment_guarding', label: 'Equipment Guarding' },
  { category: 'Equipment', field: 'equipment_maintenance_records', label: 'Maintenance Records' },
  // Electrical
  { category: 'Electrical Safety', field: 'electrical_equipment_condition', label: 'Electrical Equipment Condition' },
  { category: 'Electrical Safety', field: 'electrical_cables_secure', label: 'Cables Secure' },
  { category: 'Electrical Safety', field: 'electrical_pat_testing', label: 'PAT Testing Up to Date' },
  // Welfare
  { category: 'Welfare Facilities', field: 'welfare_toilets_clean', label: 'Toilets Clean' },
  { category: 'Welfare Facilities', field: 'welfare_drinking_water', label: 'Drinking Water Available' },
  { category: 'Welfare Facilities', field: 'welfare_rest_areas', label: 'Rest Areas Adequate' },
  // Environmental
  { category: 'Environmental', field: 'environmental_spill_kits', label: 'Spill Kits Available' },
  { category: 'Environmental', field: 'environmental_waste_segregation', label: 'Waste Segregation' },
  { category: 'Environmental', field: 'environmental_drainage', label: 'Drainage Clear' },
];

const categoryComments: Record<string, keyof FormData> = {
  'Housekeeping': 'housekeeping_comments',
  'Fire Safety': 'fire_safety_comments',
  'First Aid': 'first_aid_comments',
  'PPE': 'ppe_comments',
  'Equipment': 'equipment_comments',
  'Electrical Safety': 'electrical_comments',
  'Welfare Facilities': 'welfare_comments',
  'Environmental': 'environmental_comments',
};

export function generateTodoItems(formData: FormData): TodoItem[] {
  const items: TodoItem[] = [];
  
  inspectionFields.forEach(field => {
    const rating = formData[field.field as keyof FormData] as Rating;
    
    if (rating === 'poor' || rating === 'acceptable') {
      const commentField = categoryComments[field.category];
      const comment = formData[commentField] as string;
      
      items.push({
        id: field.field,
        category: field.category,
        item: field.label,
        priority: rating === 'poor' ? 'high' : 'medium',
        comment: comment || undefined,
        completed: false,
      });
    }
  });
  
  return items;
}

export default function InspectionTodoList({ 
  formData, 
  todoItems, 
  onTodoChange,
  isSubmitted 
}: InspectionTodoListProps) {
  const generatedItems = generateTodoItems(formData);
  
  // Merge generated items with existing todo state to preserve completion status
  const mergedItems = generatedItems.map(genItem => {
    const existing = todoItems.find(t => t.id === genItem.id);
    return existing ? { ...genItem, completed: existing.completed } : genItem;
  });
  
  const highPriority = mergedItems.filter(item => item.priority === 'high');
  const mediumPriority = mergedItems.filter(item => item.priority === 'medium');
  
  const handleToggle = (itemId: string) => {
    if (isSubmitted) return;
    
    const updated = mergedItems.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    onTodoChange(updated);
  };
  
  if (mergedItems.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
            <ClipboardList className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
            All Clear!
          </h3>
          <p className="text-green-700 dark:text-green-300">
            No issues found requiring action. All items rated as Good or N/A.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" />
            Action Items Summary
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Based on your inspection, the following items require attention:
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {highPriority.length} Urgent
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                <AlertTriangle className="h-3 w-3" />
                {mediumPriority.length} Needs Attention
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {highPriority.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              Urgent - Requires Immediate Action
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {highPriority.map(item => (
              <div 
                key={item.id} 
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  item.completed 
                    ? 'bg-muted/50 border-muted' 
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <Checkbox
                  id={item.id}
                  checked={item.completed}
                  onCheckedChange={() => handleToggle(item.id)}
                  disabled={isSubmitted}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <label 
                    htmlFor={item.id}
                    className={`font-medium cursor-pointer ${
                      item.completed ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {item.item}
                  </label>
                  <p className="text-sm text-muted-foreground">{item.category}</p>
                  {item.comment && (
                    <p className="text-sm mt-1 italic text-muted-foreground">
                      Note: {item.comment}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {mediumPriority.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Needs Attention - Follow Up Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mediumPriority.map(item => (
              <div 
                key={item.id} 
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  item.completed 
                    ? 'bg-muted/50 border-muted' 
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }`}
              >
                <Checkbox
                  id={item.id}
                  checked={item.completed}
                  onCheckedChange={() => handleToggle(item.id)}
                  disabled={isSubmitted}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <label 
                    htmlFor={item.id}
                    className={`font-medium cursor-pointer ${
                      item.completed ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {item.item}
                  </label>
                  <p className="text-sm text-muted-foreground">{item.category}</p>
                  {item.comment && (
                    <p className="text-sm mt-1 italic text-muted-foreground">
                      Note: {item.comment}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

