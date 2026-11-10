/**
 * Roles and permissions. Pure and isomorphic so the UI can hide what a user cannot do, while the
 * server remains the only place where access is actually enforced.
 *
 * Roles are hierarchical: each role has every permission of the roles below it.
 */

export const roles = ["USER", "RESEARCHER", "EDITOR", "ADMINISTRATOR", "SUPER_ADMINISTRATOR"] as const;
export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  USER: "Reader",
  RESEARCHER: "Researcher",
  EDITOR: "Editor",
  ADMINISTRATOR: "Administrator",
  SUPER_ADMINISTRATOR: "Super Administrator",
};

/** Permissions first granted at each role. */
const grants = {
  USER: ["profile:manage", "bookmark:manage", "correction:submit"],
  RESEARCHER: [
    "studio:access",
    "research:run",
    "entity:edit",
    "source:manage",
    "article:draft",
    "media:upload",
    "review:request",
  ],
  EDITOR: [
    "article:review",
    "article:publish",
    "claim:verify",
    "media:approve",
    "taxonomy:manage",
    "documentary:edit",
    "correction:resolve",
  ],
  ADMINISTRATOR: [
    "project:create",
    "spend:approve",
    "documentary:render",
    "youtube:upload",
    "youtube:publish",
    "user:view",
    "audit:view",
    "analytics:view",
    "integration:view",
  ],
  SUPER_ADMINISTRATOR: ["user:manage", "role:assign", "integration:manage", "settings:manage"],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof grants)[Role][number];

const rank: Record<Role, number> = Object.fromEntries(roles.map((r, i) => [r, i])) as Record<Role, number>;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

/** True when `role` is the same as or senior to `minimum`. */
export function hasRoleAtLeast(role: Role, minimum: Role): boolean {
  return rank[role] >= rank[minimum];
}

export function permissionsFor(role: Role): Permission[] {
  return roles.filter((r) => rank[r] <= rank[role]).flatMap((r) => [...grants[r]]);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

/**
 * Who may assign which role. Only Super Administrators assign roles, nobody changes their own
 * role, and the last Super Administrator can never be demoted (enforced where roles are changed).
 */
export function canAssignRole(actor: { id: string; role: Role }, target: { id: string }, _newRole: Role): boolean {
  return actor.role === "SUPER_ADMINISTRATOR" && actor.id !== target.id;
}
