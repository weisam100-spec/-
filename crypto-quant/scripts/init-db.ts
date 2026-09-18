import { getDb } from "../lib/storage/db";

const db = getDb();
console.log(`資料庫已初始化：${db.name}`);
db.close();
