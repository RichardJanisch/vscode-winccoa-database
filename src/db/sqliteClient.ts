import * as path from 'path';
import * as fs from 'fs';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import type { DpType } from '../models/dpType';
import type { DpElement } from '../models/dpElement';
import type { Datapoint } from '../models/datapoint';
import type {
  AddressConfig,
  AlertHdlConfig,
  AlertHdlDetail,
  ArchiveConfig,
  ArchiveDetail,
  PvRangeConfig,
  SmoothConfig,
  DistribConfig,
  LastValue,
  DisplayName,
  UnitAndFormat,
  AlertInstance,
  AlertClass,
} from '../models/configs';

const SQLITE_DIR = 'db/wincc_oa/sqlite';

export class SqliteClient {
  private identDb: SqlJsDatabase | null = null;
  private configDb: SqlJsDatabase | null = null;
  private lastValueDb: SqlJsDatabase | null = null;
  private lastAlertDb: SqlJsDatabase | null = null;
  private projectPath: string = '';
  private SQL: any = null;

  constructor() {}

  /** Initialize sql.js WASM module (must be called once before using the client) */
  async init(): Promise<void> {
    if (!this.SQL) {
      console.log('Starting sql.js initialization...');
      try {
        // Initialize sql.js with locateFile pointing to the dist directory where webpack copies the WASM file
        this.SQL = await initSqlJs({
          locateFile: (file) => {
            // Since sql.js is externalized in webpack, __dirname points to the dist folder
            const resolvedPath = path.join(__dirname, file);
            const fileExists = fs.existsSync(resolvedPath);
            console.log(`sql.js locateFile: "${file}" -> "${resolvedPath}" (exists: ${fileExists})`);
            if (!fileExists) {
              console.error(`WASM file not found. __dirname: ${__dirname}`);
              try {
                const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.wasm'));
                console.log(`WASM files in directory:`, files);
              } catch (e) {
                console.error('Could not read directory:', e);
              }
            }
            return resolvedPath;
          }
        });
        console.log('sql.js initialized successfully');
      } catch (err) {
        console.error('Failed to initialize sql.js:', err);
        throw new Error(`Failed to initialize sql.js: ${err}`);
      }
    }
  }

  /** Connect to all SQLite databases for the given project */
  open(projectPath: string): void {
    this.close();
    this.projectPath = projectPath;
    const sqliteDir = path.join(projectPath, SQLITE_DIR);

    // Load database files into memory
    const identPath = path.join(sqliteDir, 'ident.sqlite');
    const configPath = path.join(sqliteDir, 'config.sqlite');
    const lastValuePath = path.join(sqliteDir, 'last_value.sqlite');
    const lastAlertPath = path.join(sqliteDir, 'last_alert.sqlite');

    // Read files as buffers and create sql.js databases
    this.identDb = new this.SQL.Database(fs.readFileSync(identPath));
    this.configDb = new this.SQL.Database(fs.readFileSync(configPath));
    this.lastValueDb = new this.SQL.Database(fs.readFileSync(lastValuePath));
    this.lastAlertDb = new this.SQL.Database(fs.readFileSync(lastAlertPath));
  }

  /** Close all database connections */
  close(): void {
    this.identDb?.close();
    this.configDb?.close();
    this.lastValueDb?.close();
    this.lastAlertDb?.close();
    this.identDb = null;
    this.configDb = null;
    this.lastValueDb = null;
    this.lastAlertDb = null;
  }

  get isOpen(): boolean {
    return this.identDb !== null;
  }

  /** Helper: Execute query and return all rows as objects */
  private queryAll<T>(db: SqlJsDatabase, sql: string, params: any[] = []): T[] {
    const result = db.exec(sql, params);
    if (result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, idx: number) => {
        obj[col] = row[idx];
      });
      return obj as T;
    });
  }

  /** Helper: Execute query and return first row as object */
  private queryOne<T>(db: SqlJsDatabase, sql: string, params: any[] = []): T | undefined {
    const result = db.exec(sql, params);
    if (result.length === 0 || result[0].values.length === 0) return undefined;
    const { columns, values } = result[0];
    const obj: any = {};
    columns.forEach((col: string, idx: number) => {
      obj[col] = values[0][idx];
    });
    return obj as T;
  }

  // ──── Datapoint Types ────

  getAllDpTypes(): DpType[] {
    return this.queryAll<DpType>(
      this.identDb!,
      'SELECT dpt_id, canonical_name, next_free_el_id, modification_time FROM datapoint_type ORDER BY canonical_name'
    );
  }

  getDpTypeById(dptId: number): DpType | undefined {
    return this.queryOne<DpType>(
      this.identDb!,
      'SELECT dpt_id, canonical_name, next_free_el_id, modification_time FROM datapoint_type WHERE dpt_id = ?',
      [dptId]
    );
  }

  // ──── Datapoint Elements ────

  getElementsByDptId(dptId: number): DpElement[] {
    return this.queryAll<DpElement>(
      this.identDb!,
      'SELECT el_id, dpt_id, position_in_type, parent_el_id, datatype, referenced_type, source_dpt_id, source_el_id, canonical_name, modification_time FROM datapoint_element WHERE dpt_id = ? ORDER BY position_in_type',
      [dptId]
    );
  }

  getElementByDptAndElId(dptId: number, elId: number): DpElement | undefined {
    return this.queryOne<DpElement>(
      this.identDb!,
      'SELECT el_id, dpt_id, position_in_type, parent_el_id, datatype, referenced_type, source_dpt_id, source_el_id, canonical_name, modification_time FROM datapoint_element WHERE dpt_id = ? AND el_id = ?',
      [dptId, elId]
    );
  }

  /** Get element info by dp_id + el_id (looks up dpt_id from datapoint first) */
  getElementByIds(dpId: number, elId: number): DpElement | undefined {
    const dp = this.queryOne<{ dpt_id: number }>(
      this.identDb!,
      'SELECT dpt_id FROM datapoint WHERE dp_id = ?',
      [dpId]
    );
    if (!dp) return undefined;
    return this.getElementByDptAndElId(dp.dpt_id, elId);
  }

  /** Build the full element path from root to the given element (e.g., "alert.controlFuse") */
  getElementPath(dpId: number, elId: number): string | undefined {
    const dp = this.queryOne<{ dpt_id: number }>(
      this.identDb!,
      'SELECT dpt_id FROM datapoint WHERE dp_id = ?',
      [dpId]
    );
    if (!dp) return undefined;

    const elements = this.getElementsByDptId(dp.dpt_id);
    const elMap = new Map(elements.map(e => [e.el_id, e]));

    // Walk up from elId to root, collecting names (skip root element)
    const parts: string[] = [];
    let current = elMap.get(elId);
    while (current) {
      const parent = elMap.get(current.parent_el_id);
      // Stop if we reached the root element (parent_el_id === 0 or self-referencing)
      if (!parent || current.parent_el_id === 0 || current.el_id === current.parent_el_id) {
        break;
      }
      parts.unshift(current.canonical_name);
      current = parent;
    }

    return parts.length > 0 ? parts.join('.') : undefined;
  }

  // ──── Datapoints ────

  getAllDatapoints(): Datapoint[] {
    return this.queryAll<Datapoint>(
      this.identDb!,
      'SELECT dp_id, dpt_id, canonical_name, modification_time FROM datapoint ORDER BY canonical_name'
    );
  }

  getDatapointName(dpId: number): string | undefined {
    const row = this.queryOne<{ canonical_name: string }>(
      this.identDb!,
      'SELECT canonical_name FROM datapoint WHERE dp_id = ?',
      [dpId]
    );
    return row?.canonical_name;
  }

  getDatapointsByDptId(dptId: number): Datapoint[] {
    return this.queryAll<Datapoint>(
      this.identDb!,
      'SELECT dp_id, dpt_id, canonical_name, modification_time FROM datapoint WHERE dpt_id = ? ORDER BY canonical_name',
      [dptId]
    );
  }

  // ──── Display Names & Units ────

  getDisplayName(dpId: number, elId: number): DisplayName | undefined {
    return this.queryOne<DisplayName>(
      this.identDb!,
      'SELECT dp_id, el_id, language_id, text FROM display_name WHERE dp_id = ? AND el_id = ? LIMIT 1',
      [dpId, elId]
    );
  }

  getUnitAndFormat(dpId: number, elId: number): UnitAndFormat | undefined {
    return this.queryOne<UnitAndFormat>(
      this.identDb!,
      'SELECT dp_id, el_id, language_id, unit, format FROM unit_and_format WHERE dp_id = ? AND el_id = ? LIMIT 1',
      [dpId, elId]
    );
  }

  // ──── Configs ────

  getAddressConfig(dpId: number, elId: number): AddressConfig | undefined {
    return this.queryOne<AddressConfig>(
      this.configDb!,
      'SELECT * FROM address WHERE dp_id = ? AND el_id = ?',
      [dpId, elId]
    );
  }

  getAlertHdlConfig(dpId: number, elId: number): AlertHdlConfig | undefined {
    return this.queryOne<AlertHdlConfig>(
      this.configDb!,
      'SELECT * FROM alert_hdl WHERE dp_id = ? AND el_id = ?',
      [dpId, elId]
    );
  }

  getAlertHdlDetails(dpId: number, elId: number): AlertHdlDetail[] {
    return this.queryAll<AlertHdlDetail>(
      this.configDb!,
      'SELECT * FROM alert_hdl_detail WHERE dp_id = ? AND el_id = ? ORDER BY detail_nr',
      [dpId, elId]
    );
  }

  getArchiveConfig(dpId: number, elId: number): ArchiveConfig | undefined {
    return this.queryOne<ArchiveConfig>(
      this.configDb!,
      'SELECT * FROM archive WHERE dp_id = ? AND el_id = ?',
      [dpId, elId]
    );
  }

  getArchiveDetail(dpId: number, elId: number): ArchiveDetail | undefined {
    return this.queryOne<ArchiveDetail>(
      this.configDb!,
      'SELECT * FROM archive_detail WHERE dp_id = ? AND el_id = ? LIMIT 1',
      [dpId, elId]
    );
  }

  getPvRangeConfig(dpId: number, elId: number): PvRangeConfig | undefined {
    return this.queryOne<PvRangeConfig>(
      this.configDb!,
      'SELECT * FROM pv_range WHERE dp_id = ? AND el_id = ?',
      [dpId, elId]
    );
  }

  getSmoothConfig(dpId: number, elId: number): SmoothConfig | undefined {
    return this.queryOne<SmoothConfig>(
      this.configDb!,
      'SELECT * FROM smooth WHERE dp_id = ? AND el_id = ?',
      [dpId, elId]
    );
  }

  getDistribConfig(dpId: number, elId: number): DistribConfig | undefined {
    return this.queryOne<DistribConfig>(
      this.configDb!,
      'SELECT * FROM distrib WHERE dp_id = ? AND el_id = ?',
      [dpId, elId]
    );
  }

  // ──── Last Values ────

  getLastValue(dpId: number, elId: number): LastValue | undefined {
    // Timestamps and status_64 are 64-bit integers beyond JS MAX_SAFE_INTEGER.
    // Cast to TEXT in SQL to avoid precision loss.
    return this.queryOne<LastValue>(
      this.lastValueDb!,
      `SELECT dp_id, el_id, dyn_idx, language_id, value, variable_type,
        CAST(original_time AS TEXT) as original_time,
        CAST(system_time AS TEXT) as system_time,
        CAST(status_64 AS TEXT) as status_64,
        user_id, manager_id
      FROM last_value WHERE dp_id = ? AND el_id = ? AND dyn_idx = 0 AND language_id = 0`,
      [dpId, elId]
    );
  }

  // ──── Alerts ────

  /** Get active alert instances for a given dp element, with joined lang_text */
  getActiveAlerts(dpId: number, elId: number): AlertInstance[] {
    const rows = this.queryAll<AlertInstance>(
      this.lastAlertDb!,
      `SELECT
        ai.alert_instance_id, ai.dp_id, ai.el_id, ai.detail_nr,
        ai.value_came, ai.value_went, ai.state_32,
        CAST(ai.came_time AS TEXT) as came_time,
        CAST(ai.went_time AS TEXT) as went_time,
        CAST(ai.ack_time_came AS TEXT) as ack_time_came,
        CAST(ai.ack_time_went AS TEXT) as ack_time_went,
        ai.class_dp_id, ai.class_dp_el_id
      FROM alert_instance ai
      WHERE ai.dp_id = ? AND ai.el_id = ?`,
      [dpId, elId]
    );

    // Enrich with lang_text (came/went texts)
    for (const alert of rows) {
      const texts = this.queryAll<{ attribute_nr: number; text: string }>(
        this.lastAlertDb!,
        `SELECT attribute_nr, text FROM lang_text
         WHERE alert_instance_id = ? AND language_id = 10001`,
        [alert.alert_instance_id]
      );

      for (const t of texts) {
        // attribute_nr: 0 = came text, 1 = went text
        if (t.attribute_nr === 0) alert.came_text = t.text;
        else if (t.attribute_nr === 1) alert.went_text = t.text;
      }
    }

    return rows;
  }

  /** Get alert class definition by dp_id and el_id */
  getAlertClass(dpId: number, elId: number): AlertClass | undefined {
    return this.queryOne<AlertClass>(
      this.configDb!,
      `SELECT dp_id, el_id, ack_type, "prior",
        color_none, color_c_nack, color_c_ack, color_g_nack, color_c_g_nack,
        fore_color_none, fore_color_c_nack, fore_color_c_ack, fore_color_g_nack, fore_color_c_g_nack
      FROM alert_class WHERE dp_id = ? AND el_id = ?`,
      [dpId, elId]
    );
  }

  /** Get alert class canonical name from ident.sqlite datapoint table */
  getAlertClassName(dpId: number): string | undefined {
    const row = this.queryOne<{ canonical_name: string }>(
      this.identDb!,
      'SELECT canonical_name FROM datapoint WHERE dp_id = ?',
      [dpId]
    );
    return row?.canonical_name;
  }

}