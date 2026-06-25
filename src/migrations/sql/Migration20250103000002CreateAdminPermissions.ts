import { Migration } from '@mikro-orm/migrations';

/**
 * Permissions plugin migration — creates the admin role permissions table.
 */
export class Migration20250103000002CreateAdminPermissions extends Migration {
	async up(): Promise<void> {
		this.addSql(`
			create table if not exists \`admin_permissions\` (
				\`id\` int unsigned not null auto_increment primary key,
				\`role\` varchar(255) not null,
				\`name\` varchar(255) not null,
				\`description\` text not null,
				\`resources\` json null,
				\`pages\` json null,
				\`created_at\` datetime not null,
				\`updated_at\` datetime not null,
				unique key \`admin_permissions_role_unique\` (\`role\`)
			) default character set utf8mb4 engine = InnoDB;
		`);
	}

	async down(): Promise<void> {
		this.addSql('drop table if exists `admin_permissions`;');
	}
}
