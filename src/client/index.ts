import { definePluginClient } from '@maxal_studio/kratosjs-react';
import SetAllField from './SetAllField';
import ToggleAllField from './ToggleAllField';
import ToggleFullAccessField from './ToggleFullAccessField';
import PermissionsEditorBlock from './PermissionsEditorBlock';
import en from './lang/en';
import sq from './lang/sq';

export default definePluginClient({
	name: 'permissions',
	fields: {
		'set-all': SetAllField,
		'toggle-all': ToggleAllField,
		'toggle-full-access': ToggleFullAccessField,
	},
	blocks: {
		'permissions-editor': PermissionsEditorBlock,
	},
	translations: {
		en,
		sq,
	},
});
