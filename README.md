# @maxal_studio/kratosjs-plugin-permissions

Adds **role-based permissions** to a KratosJs admin panel. You get a visual
**Permissions** page where you define roles and grant each one access to resources
(actions, tabs, widgets) and pages (blocks). Works on both MongoDB and SQL.

![General](./images/permissions_1.png)

![Resource](./images/permissions_2.png)

When registered, the plugin attaches a nullable `role` **relation**
(`User` → `AdminPermissions`) to your user entity, so a user references its role by
**id**. The base KratosJs app templates no longer ship a hardcoded `role` field — the
role concept comes entirely from this plugin.

## Install

```bash
npm install @maxal_studio/kratosjs-plugin-permissions
```

## Register

**Server** (`src/index.ts`):

```ts
import { PermissionsPlugin } from "@maxal_studio/kratosjs-plugin-permissions";

Panel.make("admin")
  // ...
  .plugins([new PermissionsPlugin()]);
```

**Client** (`src/admin/main.tsx`):

```ts
import permissions from "@maxal_studio/kratosjs-plugin-permissions/client";

mountAdminPanel({ plugins: [permissions] });
```

After registering, open the **Permissions** page in the panel to create roles and set
their access.

The plugin attaches the `role` relation to the entity named `User` by default. If your
user entity has a different name, pass it: `new PermissionsPlugin({ userEntityName: 'Account' })`.
Make sure the user's resource is registered **before** the plugin so the entity can be found.

## Add the role field to your user resource

The plugin adds the relation to the entity but does not modify your resource — add the
**Role** select and column yourself (`src/resources/UserResource.ts`):

```ts
import { SelectInput, TextColumn } from '@maxal_studio/kratosjs';

// in form():
SelectInput.make('role').label('Role').relationship('role', 'name', 'admin-roles'),

// in table().columns():
TextColumn.make('role.name').label('Role').badge(),
```

`relationship('role', 'name', 'admin-roles')` populates the dropdown from the roles you
create on the Permissions page (slug `admin-roles`) and stores the selected role's **id**
on the user.

## Flow the role into auth

So the panel knows the logged-in user's role, add it to the extended user

```ts
adminPanel.auth({
  ...
  extendUser: (user) => ({
    role: user.role,
  }),
  ...
});
```

## Super admins

A super admin bypasses every permission check. A role is a super admin when its id is
configured, or — by default — when its slug (`AdminPermissions.role`) is `admin`.

```ts
// By id, when known up front:
.plugins([new PermissionsPlugin({ superAdminRoleIds: [1] })]);

// Or register the id at runtime (e.g. from a seeder, once it exists):
PermissionsPlugin.markSuperAdminRole(adminRole.id);
```

Seed an admin role and link your admin user to it (`src/index.ts` start callback):

```ts
const AdminPermissions = PermissionsPlugin.getEntity();
let adminRole = await em.findOne(AdminPermissions, { role: "admin" });
if (!adminRole) {
  adminRole = em.create(AdminPermissions, {
    role: "admin",
    name: "Admin",
    description: "Full access",
    resources: {},
    pages: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await em.persist(adminRole);
  await em.flush();
}
PermissionsPlugin.markSuperAdminRole(adminRole.id);

const admin = await em.findOne(User, { email: "admin@example.com" });
if (admin && !(admin as any).role) {
  (admin as any).role = adminRole;
  await em.flush();
}
```

> **SQL note:** the plugin's bundled migration targets MySQL/MariaDB/Postgres. On SQLite,
> start the panel with `{ migrate: false, updateSchema: true }` so the schema generator
> creates the `admin_permissions` table and the user `role` foreign key.

## Disabling / uninstalling the plugin

The plugin attaches the `role` relation to your user entity at runtime, so the schema
generator creates a `role_id` **column**, an **index** (`user_role_id_index`) and a
**foreign key** (`user_role_id_foreign`) on the `user` table. These are not managed by a
migration.

When you disable the plugin, its code no longer runs, so it can't clean those up. On the
next boot the schema generator tries to drop the leftover index and fails, because
MySQL/InnoDB won't drop an index that a foreign key still depends on:

```
DriverException: Cannot drop index 'user_role_id_index': needed in a foreign key constraint
```

Before disabling the plugin, drop the foreign key **first** (which then lets the column and
index go). On SQL run:

```sql
-- Confirm the constraint name (usually user_role_id_foreign):
SELECT CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_NAME = 'user'
  AND COLUMN_NAME = 'role_id'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Then drop the FK and the column (dropping the column removes its index):
ALTER TABLE `user` DROP FOREIGN KEY `user_role_id_foreign`;
ALTER TABLE `user` DROP COLUMN `role_id`;
```

Optionally drop the plugin's own table too if you no longer need the role data:

```sql
DROP TABLE IF EXISTS `admin_permissions`;
```

After the foreign key is removed, the panel starts cleanly with the plugin disabled. If
you already hit the error, running the SQL above resolves it — the failing schema step no
longer has an orphaned index to drop.
