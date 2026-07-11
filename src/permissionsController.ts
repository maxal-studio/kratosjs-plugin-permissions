import { KratosRequest, KratosReply } from "@maxal_studio/kratosjs";
import { IAdminPermissions } from "./entities/AdminPermissions";
import { getPermissionsEntity } from "./db";

function denormalizePermissions(permissions: any): any {
  if (!permissions || typeof permissions !== "object") {
    return permissions;
  }

  const denormalized: any = { ...permissions };

  if (denormalized.resources && typeof denormalized.resources === "object") {
    denormalized.resources = Object.entries(denormalized.resources).reduce(
      (acc, [resourceSlug, resourcePerm]: [string, any]) => {
        if (resourcePerm && typeof resourcePerm === "object") {
          const denormalizedResource: any = { ...resourcePerm };

          if (Array.isArray(denormalizedResource.widgets)) {
            const widgetsObj: Record<string, boolean> = {};
            denormalizedResource.widgets.forEach((name: string) => {
              widgetsObj[name] = true;
            });
            denormalizedResource.widgets = widgetsObj;
          }

          if (Array.isArray(denormalizedResource.actions)) {
            const actionsObj: Record<string, boolean> = {};
            denormalizedResource.actions.forEach((name: string) => {
              actionsObj[name] = true;
            });
            denormalizedResource.actions = actionsObj;
          }

          if (Array.isArray(denormalizedResource.tabs)) {
            const tabsObj: Record<string, boolean> = {};
            denormalizedResource.tabs.forEach((name: string) => {
              tabsObj[name] = true;
            });
            denormalizedResource.tabs = tabsObj;
          }

          acc[resourceSlug] = denormalizedResource;
        } else {
          acc[resourceSlug] = resourcePerm;
        }
        return acc;
      },
      {} as any,
    );
  }

  if (denormalized.pages && typeof denormalized.pages === "object") {
    denormalized.pages = Object.entries(denormalized.pages).reduce(
      (acc, [pageSlug, pagePerm]: [string, any]) => {
        if (pagePerm && typeof pagePerm === "object") {
          const denormalizedPage: any = { ...pagePerm };
          if (Array.isArray(denormalizedPage.blocks)) {
            const blocksObj: Record<string, boolean> = {};
            denormalizedPage.blocks.forEach((name: string) => {
              blocksObj[name] = true;
            });
            denormalizedPage.blocks = blocksObj;
          }
          acc[pageSlug] = denormalizedPage;
        } else {
          acc[pageSlug] = pagePerm;
        }
        return acc;
      },
      {} as any,
    );
  }

  return denormalized;
}

export async function getPermissions(
  req: KratosRequest,
  res: KratosReply,
): Promise<void> {
  try {
    const em = req.panel!.getEm();
    const role = (req.query.role as string) || "editor";
    const permissions = await em.findOne<IAdminPermissions>(
      getPermissionsEntity(),
      { role } as any,
    );

    if (permissions) {
      res.json(
        denormalizePermissions({
          role: permissions.role,
          resources: permissions.resources || {},
          pages: permissions.pages || {},
        }),
      );
    } else {
      res.json({ role, resources: {}, pages: {} });
    }
  } catch (error: any) {
    console.error("Error fetching permissions:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch permissions" });
  }
}

function normalizePermissions(permissions: any): any {
  if (!permissions || typeof permissions !== "object") {
    return permissions;
  }

  const normalized: any = { ...permissions };

  if (normalized.resources && typeof normalized.resources === "object") {
    normalized.resources = Object.entries(normalized.resources).reduce(
      (acc, [resourceSlug, resourcePerm]: [string, any]) => {
        if (resourcePerm && typeof resourcePerm === "object") {
          const normalizedResource: any = { ...resourcePerm };

          for (const key of ["widgets", "actions", "tabs"] as const) {
            if (
              normalizedResource[key] &&
              typeof normalizedResource[key] === "object" &&
              !Array.isArray(normalizedResource[key])
            ) {
              normalizedResource[key] = Object.entries(normalizedResource[key])
                .filter(([_, value]) => value === true)
                .map(([name]) => name);
            }
          }

          acc[resourceSlug] = normalizedResource;
        } else {
          acc[resourceSlug] = resourcePerm;
        }
        return acc;
      },
      {} as any,
    );
  }

  return normalized;
}

export async function savePermissions(
  req: KratosRequest,
  res: KratosReply,
): Promise<void> {
  try {
    const em = req.panel!.getEm();
    const { role, resources, pages } = req.body;
    const roleFromQuery = req.query.role as string | undefined;

    if (!role) {
      res.status(400).json({ message: "Role is required" });
      return;
    }

    if (role && !roleFromQuery) {
      res.redirectTo(`/page/permissions?role=${role}`, {
        message: "Role selected successfully",
      });
      return;
    }

    const normalizedPermissions = normalizePermissions({ resources, pages });
    const AdminPermissions = getPermissionsEntity();
    let record = await em.findOne<IAdminPermissions>(AdminPermissions, {
      role,
    } as any);

    if (record) {
      em.assign(record, {
        resources: normalizedPermissions.resources || {},
        pages: normalizedPermissions.pages || {},
      });
    } else {
      record = em.create<IAdminPermissions>(AdminPermissions, {
        role,
        name: role,
        description: `Permissions for ${role}`,
        resources: normalizedPermissions.resources || {},
        pages: normalizedPermissions.pages || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }

    await em.flush();

    res.json(
      denormalizePermissions({
        role: record.role,
        resources: record.resources || {},
        pages: record.pages || {},
      }),
    );
  } catch (error: any) {
    console.error("Error saving permissions:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to save permissions" });
  }
}

export async function getAllRoles(
  req: KratosRequest,
  res: KratosReply,
): Promise<void> {
  try {
    const em = req.panel!.getEm();
    const permissions = await em.find<IAdminPermissions>(
      getPermissionsEntity(),
      {},
    );

    res.json(
      permissions
        .filter((p: IAdminPermissions) => p.role !== "admin")
        .map((p: IAdminPermissions) => ({
          role: p.role,
          name: p.name || p.role,
          description: p.description || "",
        })),
    );
  } catch (error: any) {
    console.error("Error fetching all roles:", error);
    res.status(500).json({ message: error.message || "Failed to fetch roles" });
  }
}

export async function getStructure(
  req: KratosRequest,
  res: KratosReply,
): Promise<void> {
  try {
    const { getPanelStructureData } = await import("./structureHelper");
    const structure = await getPanelStructureData(req.panel!);
    res.json(structure);
  } catch (error: any) {
    console.error("Error fetching permissions structure:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch structure" });
  }
}
