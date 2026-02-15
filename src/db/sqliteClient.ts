import * as path from 'path';
import Database from 'better-sqlite3';
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
  private identDb: Database.Database | null = null;
  private configDb: Database.Database | null = null;
  private lastValueDb: Database.Database | null = null;
  private lastAlertDb: Database.Database | null = null;
  private projectPath: string = '';

  constructor() {}

  /** Connect to all SQLite databases for the given project */
  open(projectPath: string): void {
    this.close();
    this.projectPath = projectPath;
    const sqliteDir = path.join(projectPath, SQLITE_DIR);

    this.identDb = new Database(path.join(sqliteDir, 'ident.sqlite'), { readonly: true });
    this.configDb = new Database(path.join(sqliteDir, 'config.sqlite'), { readonly: true });
    this.lastValueDb = new Database(path.join(sqliteDir, 'last_value.sqlite'), { readonly: true });
    this.lastAlertDb = new Database(path.join(sqliteDir, 'last_alert.sqlite'), { readonly: true });
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

  // ──── Datapoint Types ────

  getAllDpTypes(): DpType[] {
    return this.identDb!.prepare(
      'SELECT dpt_id, canonical_name, next_free_el_id, modification_time FROM datapoint_type ORDER BY canonical_name'
    ).all() as DpType[];
  }

  getDpTypeById(dptId: number): DpType | undefined {
    return this.identDb!.prepare(
      'SELECT dpt_id, canonical_name, next_free_el_id, modification_time FROM datapoint_type WHERE dpt_id = ?'
    ).get(dptId) as DpType | undefined;
  }

  // ──── Datapoint Elements ────

  getElementsByDptId(dptId: number): DpElement[] {
    return this.identDb!.prepare(
      'SELECT el_id, dpt_id, position_in_type, parent_el_id, datatype, referenced_type, source_dpt_id, source_el_id, canonical_name, modification_time FROM datapoint_element WHERE dpt_id = ? ORDER BY position_in_type'
    ).all(dptId) as DpElement[];
  }

  getElementByDptAndElId(dptId: number, elId: number): DpElement | undefined {
    return this.identDb!.prepare(
      'SELECT el_id, dpt_id, position_in_type, parent_el_id, datatype, referenced_type, source_dpt_id, source_el_id, canonical_name, modification_time FROM datapoint_element WHERE dpt_id = ? AND el_id = ?'
    ).get(dptId, elId) as DpElement | undefined;
  }

  /** Get element info by dp_id + el_id (looks up dpt_id from datapoint first) */
  getElementByIds(dpId: number, elId: number): DpElement | undefined {
    const dp = this.identDb!.prepare(
      'SELECT dpt_id FROM datapoint WHERE dp_id = ?'
    ).get(dpId) as { dpt_id: number } | undefined;
    if (!dp) return undefined;
    return this.getElementByDptAndElId(dp.dpt_id, elId);
  }

  /** Build the full element path from root to the given element (e.g., "alert.controlFuse") */
  getElementPath(dpId: number, elId: number): string | undefined {
    const dp = this.identDb!.prepare(
      'SELECT dpt_id FROM datapoint WHERE dp_id = ?'
    ).get(dpId) as { dpt_id: number } | undefined;
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
    return this.identDb!.prepare(
      'SELECT dp_id, dpt_id, canonical_name, modification_time FROM datapoint ORDER BY canonical_name'
    ).all() as Datapoint[];
  }

  getDatapointName(dpId: number): string | undefined {
    const row = this.identDb!.prepare(
      'SELECT canonical_name FROM datapoint WHERE dp_id = ?'
    ).get(dpId) as { canonical_name: string } | undefined;
    return row?.canonical_name;
  }

  getDatapointsByDptId(dptId: number): Datapoint[] {
    return this.identDb!.prepare(
      'SELECT dp_id, dpt_id, canonical_name, modification_time FROM datapoint WHERE dpt_id = ? ORDER BY canonical_name'
    ).all(dptId) as Datapoint[];
  }

  // ──── Display Names & Units ────

  getDisplayName(dpId: number, elId: number): DisplayName | undefined {
    return this.identDb!.prepare(
      'SELECT dp_id, el_id, language_id, text FROM display_name WHERE dp_id = ? AND el_id = ? LIMIT 1'
    ).get(dpId, elId) as DisplayName | undefined;
  }

  getUnitAndFormat(dpId: number, elId: number): UnitAndFormat | undefined {
    return this.identDb!.prepare(
      'SELECT dp_id, el_id, language_id, unit, format FROM unit_and_format WHERE dp_id = ? AND el_id = ? LIMIT 1'
    ).get(dpId, elId) as UnitAndFormat | undefined;
  }

  // ──── Configs ────

  getAddressConfig(dpId: number, elId: number): AddressConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM address WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as AddressConfig | undefined;
  }

  getAlertHdlConfig(dpId: number, elId: number): AlertHdlConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM alert_hdl WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as AlertHdlConfig | undefined;
  }

  getAlertHdlDetails(dpId: number, elId: number): AlertHdlDetail[] {
    return this.configDb!.prepare(
      'SELECT * FROM alert_hdl_detail WHERE dp_id = ? AND el_id = ? ORDER BY detail_nr'
    ).all(dpId, elId) as AlertHdlDetail[];
  }

  getArchiveConfig(dpId: number, elId: number): ArchiveConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM archive WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as ArchiveConfig | undefined;
  }

  getArchiveDetail(dpId: number, elId: number): ArchiveDetail | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM archive_detail WHERE dp_id = ? AND el_id = ? LIMIT 1'
    ).get(dpId, elId) as ArchiveDetail | undefined;
  }

  getPvRangeConfig(dpId: number, elId: number): PvRangeConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM pv_range WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as PvRangeConfig | undefined;
  }

  getSmoothConfig(dpId: number, elId: number): SmoothConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM smooth WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as SmoothConfig | undefined;
  }

  getDistribConfig(dpId: number, elId: number): DistribConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM distrib WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as DistribConfig | undefined;
  }

  // ──── Last Values ────

  getLastValue(dpId: number, elId: number): LastValue | undefined {
    // Timestamps and status_64 are 64-bit integers beyond JS MAX_SAFE_INTEGER.
    // Cast to TEXT in SQL to avoid precision loss.
    return this.lastValueDb!.prepare(
      `SELECT dp_id, el_id, dyn_idx, language_id, value, variable_type,
        CAST(original_time AS TEXT) as original_time,
        CAST(system_time AS TEXT) as system_time,
        CAST(status_64 AS TEXT) as status_64,
        user_id, manager_id
      FROM last_value WHERE dp_id = ? AND el_id = ? AND dyn_idx = 0 AND language_id = 0`
    ).get(dpId, elId) as LastValue | undefined;
  }

  // ──── Alerts ────

  /** Get active alert instances for a given dp element, with joined lang_text */
  getActiveAlerts(dpId: number, elId: number): AlertInstance[] {
    const rows = this.lastAlertDb!.prepare(
      `SELECT
        ai.alert_instance_id, ai.dp_id, ai.el_id, ai.detail_nr,
        ai.value_came, ai.value_went, ai.state_32,
        CAST(ai.came_time AS TEXT) as came_time,
        CAST(ai.went_time AS TEXT) as went_time,
        CAST(ai.ack_time_came AS TEXT) as ack_time_came,
        CAST(ai.ack_time_went AS TEXT) as ack_time_went,
        ai.class_dp_id, ai.class_dp_el_id
      FROM alert_instance ai
      WHERE ai.dp_id = ? AND ai.el_id = ?`
    ).all(dpId, elId) as AlertInstance[];

    // Enrich with lang_text (came/went texts)
    for (const alert of rows) {
      const texts = this.lastAlertDb!.prepare(
        `SELECT attribute_nr, text FROM lang_text
         WHERE alert_instance_id = ? AND language_id = 10001`
      ).all(alert.alert_instance_id) as { attribute_nr: number; text: string }[];

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
    return this.configDb!.prepare(
      `SELECT dp_id, el_id, ack_type, "prior",
        color_none, color_c_nack, color_c_ack, color_g_nack, color_c_g_nack,
        fore_color_none, fore_color_c_nack, fore_color_c_ack, fore_color_g_nack, fore_color_c_g_nack
      FROM alert_class WHERE dp_id = ? AND el_id = ?`
    ).get(dpId, elId) as AlertClass | undefined;
  }

  /** Get alert class canonical name from ident.sqlite datapoint table */
  getAlertClassName(dpId: number): string | undefined {
    const row = this.identDb!.prepare(
      'SELECT canonical_name FROM datapoint WHERE dp_id = ?'
    ).get(dpId) as { canonical_name: string } | undefined;
    return row?.canonical_name;
  }

}
