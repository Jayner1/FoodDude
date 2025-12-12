// src/services/FoodDatabase.ts
import { Capacitor } from '@capacitor/core';

import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

let db: SQLiteDBConnection | Database | null = null;
const isNative = Capacitor.isNativePlatform();

export async function initDatabase(): Promise<void> {
  if (db) return;

  if (isNative) {
    const sqlite = new SQLiteConnection(CapacitorSQLite);

    try {
      await sqlite.copyFromAssets(true); 
      const conn = await sqlite.createConnection('foods', false, 'no-encryption', 1, false);
      await conn.open();
      db = conn;
      console.log('Native DB loaded — 326,760 foods');
    } catch (err) {
      console.error('Native DB init failed:', err);
      throw err;
    }
  } else {
    try {
      const SQL = await initSqlJs({
        locateFile: () => '/sql-wasm.wasm',
      });

      const resp = await fetch('/assets/databases/foods.db');
      if (!resp.ok) throw new Error('Failed to fetch foods.db');
      const buffer = await resp.arrayBuffer();
      const uint8 = new Uint8Array(buffer);

      db = new SQL.Database(uint8);
      console.log('Web sql.js DB loaded — 326,760 foods');
    } catch (err) {
      console.error('Web DB init failed:', err);
      throw err;
    }
  }
}

export async function searchFoodsLocal(query: string, limit = 30): Promise<any[]> {
  if (!db || !query?.trim()) return [];

  const q = `%${query.trim()}%`;

  if (isNative) {
    try {
      const result = await (db as SQLiteDBConnection).query(
        `SELECT 
          rowid AS id,
          name,
          calories,
          protein,
          carbs,
          fat
         FROM foods 
         WHERE name LIKE ? COLLATE NOCASE
         LIMIT ?`,
        [q, limit]
      );

      return (result.values || []).map(row => ({
        id: row.id,
        name: String(row.name || 'Unknown').trim(),
        calories: Math.round(Number(row.calories) || 0),
        protein: Number((Number(row.protein) || 0).toFixed(1)),
        carbs: Number((Number(row.carbs) || 0).toFixed(1)),
        fat: Number((Number(row.fat) || 0).toFixed(1)),
      }));
    } catch (e) {
      console.error('Native search error:', e);
      return [];
    }
  } else {
    try {
      const stmt = (db as Database).prepare(
        `SELECT 
          rowid AS id,
          name,
          calories,
          protein,
          carbs,
          fat
         FROM foods 
         WHERE name LIKE $q COLLATE NOCASE
         LIMIT $limit`
      );

      stmt.bind({ $q: q, $limit: limit });

      const results: any[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          id: row.id,
          name: String(row.name || 'Unknown').trim(),
          calories: Math.round(Number(row.calories) || 0),
          protein: Number((Number(row.protein) || 0).toFixed(1)),
          carbs: Number((Number(row.carbs) || 0).toFixed(1)),
          fat: Number((Number(row.fat) || 0).toFixed(1)),
        });
      }
      stmt.free();
      return results;
    } catch (e) {
      console.error('Web search error:', e);
      return [];
    }
  }
}