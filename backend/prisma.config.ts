
import type { Config } from 'prisma/config';

export default {
	datasource: {
		db: {
			provider: 'postgresql',
			url: 'postgresql://postgres:password@localhost:5432/expense_tracker',
		},
	},
} satisfies Config;

