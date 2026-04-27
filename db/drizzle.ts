import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

export const DATABASE_NAME = 'canteen.db';
export const expoDb = openDatabaseSync(DATABASE_NAME);
console.log(`Database connected at: ${expoDb.databasePath}`);
export const db = drizzle(expoDb, { schema });
