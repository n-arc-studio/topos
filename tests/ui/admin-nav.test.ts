import { describe, expect, test } from "vitest";
import { buildAdminNavLinks } from "@/lib/ui/admin-nav";

describe("buildAdminNavLinks", () => {
  test("returns no links for non-admin user", () => {
    const links = buildAdminNavLinks({
      isPlatformAdmin: false,
      hasSpaceAdminRole: false,
    });
    expect(links).toEqual([]);
  });

  test("returns only platform link for platform admin", () => {
    const links = buildAdminNavLinks({
      isPlatformAdmin: true,
      hasSpaceAdminRole: false,
    });
    expect(links).toEqual([
      { key: "platform", label: "全体管理", href: "/admin" },
    ]);
  });

  test("returns only space link for space admin", () => {
    const links = buildAdminNavLinks({
      isPlatformAdmin: false,
      hasSpaceAdminRole: true,
    });
    expect(links).toEqual([
      { key: "space", label: "場管理", href: "/admin/spaces" },
    ]);
  });

  test("returns both links in stable order for dual-role user", () => {
    const links = buildAdminNavLinks({
      isPlatformAdmin: true,
      hasSpaceAdminRole: true,
    });
    expect(links).toEqual([
      { key: "platform", label: "全体管理", href: "/admin" },
      { key: "space", label: "場管理", href: "/admin/spaces" },
    ]);
  });
});
