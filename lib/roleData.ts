import { readJson, writeJson } from './blob';
import type { RolePermissions, Role, PermissionKey } from './types';
import { DEFAULT_ROLE_PERMISSIONS } from './types';

const BLOB_KEY = 'config/role-permissions.json';

export async function loadRolePermissions(): Promise<RolePermissions> {
  return readJson<RolePermissions>(BLOB_KEY, DEFAULT_ROLE_PERMISSIONS);
}

export async function saveRolePermissions(perms: RolePermissions): Promise<void> {
  await writeJson(BLOB_KEY, perms);
}

export function hasPermission(
  rolePerms: RolePermissions,
  role: Role,
  permission: PermissionKey
): boolean {
  const perms = rolePerms[role];
  if (!perms) return false;
  return perms.includes(permission);
}
