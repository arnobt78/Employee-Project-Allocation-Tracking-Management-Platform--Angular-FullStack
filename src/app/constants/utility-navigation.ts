import { Activity, FileText, type LucideIconData } from 'lucide-angular';

export interface UtilityNavItem {
  label: string;
  route: string;
  icon: LucideIconData;
  iconName: string;
}

export const UTILITY_NAVIGATION_ITEMS: UtilityNavItem[] = [
  {
    label: 'API Documentation',
    route: '/api-doc',
    icon: FileText,
    iconName: 'file-text',
  },
  {
    label: 'API Status',
    route: '/api-status',
    icon: Activity,
    iconName: 'activity',
  },
];
