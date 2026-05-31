export type AdminNavLink = {
  key: "platform" | "space";
  label: string;
  href: string;
};

export function buildAdminNavLinks(input: {
  isPlatformAdmin: boolean;
  hasSpaceAdminRole: boolean;
}): AdminNavLink[] {
  const links: AdminNavLink[] = [];
  if (input.isPlatformAdmin) {
    links.push({ key: "platform", label: "全体管理", href: "/admin" });
  }
  if (input.hasSpaceAdminRole) {
    links.push({ key: "space", label: "場管理", href: "/admin/spaces" });
  }
  return links;
}
