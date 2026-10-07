import { Activity, FileText, ShieldAlert, Smartphone, type LucideIcon } from 'lucide-react';
import type { GroupKey } from '@domain/api';

export const GROUP_ICON: Record<GroupKey, LucideIcon> = { tracking: Activity, mobile: Smartphone, trust: FileText, policy: ShieldAlert };
export const GROUP_ORDER: readonly GroupKey[] = ['tracking', 'mobile', 'trust', 'policy'];
