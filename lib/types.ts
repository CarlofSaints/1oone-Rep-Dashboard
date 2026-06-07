export type Role = 'super_admin' | 'admin' | 'viewer';

export type PermissionKey =
  | 'view_dashboard'
  | 'upload_call_cycle'
  | 'manage_settings'
  | 'manage_users'
  | 'manage_roles'
  | 'import_visits';

export const ALL_PERMISSIONS: PermissionKey[] = [
  'view_dashboard',
  'upload_call_cycle',
  'manage_settings',
  'manage_users',
  'manage_roles',
  'import_visits',
];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_dashboard: 'View Dashboard',
  upload_call_cycle: 'Upload Call Cycle',
  manage_settings: 'Manage Settings',
  manage_users: 'Manage Users',
  manage_roles: 'Manage Roles',
  import_visits: 'Import Visits',
};

export type RolePermissions = Record<Role, PermissionKey[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  super_admin: [...ALL_PERMISSIONS],
  admin: ['view_dashboard', 'upload_call_cycle', 'manage_settings', 'import_visits'],
  viewer: ['view_dashboard'],
};

export type FrequencyType = 'weekly' | 'fortnightly' | 'monthly';

export interface CallCycleEntry {
  repEmail: string;
  repName: string;
  storeName: string;
  storeCode: string;
  day: string; // "Monday", "Tuesday", etc.
  frequency: FrequencyType;
  week?: number; // for fortnightly/monthly — which week(s)
}

export interface CallCycleUploadMeta {
  id: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  rowCount: number;
}
