/**
 * SQLite Persistence Layer - KIKES HUEVO SECCIONAL CAUCA (ALKA 1, ALKA 2, ALKA PALMAS)
 * Almacena producción diaria por planta y galpón, marcando fechas cerradas ya importadas.
 */
const CaucaSQLite = (() => {
  const IDB_NAME = 'kikes_huevo_cauca_sqlite_idb';
  const IDB_STORE = 'db_files';
  const IDB_KEY = 'cauca_main_sqlite';

  let SQL = null;
  let db = null;

  function openIdb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(IDB_STORE)) {
          database.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function readBinaryFromIdb() {
    const idb = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function writeBinaryToIdb(uint8Array) {
    const idb = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).put(uint8Array, IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteBinaryFromIdb() {
    const idb = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).delete(IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function ensureSchema() {
    db.run(`
      CREATE TABLE IF NOT EXISTS seccionales (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plantas (
        id TEXT PRIMARY KEY,
        id_seccional TEXT NOT NULL,
        nombre TEXT NOT NULL,
        subtitulo TEXT,
        folder_id TEXT NOT NULL,
        orden INTEGER NOT NULL,
        FOREIGN KEY (id_seccional) REFERENCES seccionales(id)
      );

      CREATE TABLE IF NOT EXISTS galpones (
        planta TEXT NOT NULL,
        numero INTEGER NOT NULL,
        codigo TEXT NOT NULL,
        nombre TEXT NOT NULL,
        nucleo TEXT,
        PRIMARY KEY (planta, numero),
        FOREIGN KEY (planta) REFERENCES plantas(id)
      );

      CREATE TABLE IF NOT EXISTS fechas_importadas (
        planta TEXT NOT NULL,
        fecha TEXT NOT NULL,
        file_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        modified_time TEXT,
        cerrada INTEGER NOT NULL DEFAULT 0,
        total_planta INTEGER NOT NULL DEFAULT 0,
        fecha_importacion TEXT NOT NULL,
        PRIMARY KEY (planta, fecha),
        FOREIGN KEY (planta) REFERENCES plantas(id)
      );

      CREATE TABLE IF NOT EXISTS produccion_galpon (
        planta TEXT NOT NULL,
        fecha TEXT NOT NULL,
        numero_galpon INTEGER NOT NULL,
        codigo_galpon TEXT NOT NULL,
        nombre_galpon TEXT NOT NULL,
        total_produccion INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (planta, fecha, numero_galpon),
        FOREIGN KEY (planta, numero_galpon) REFERENCES galpones(planta, numero)
      );

      CREATE INDEX IF NOT EXISTS idx_cauca_prod_fecha ON produccion_galpon(fecha, planta);

      CREATE VIEW IF NOT EXISTS vw_produccion_cauca AS
      SELECT
        s.id AS id_seccional,
        s.nombre AS nombre_seccional,
        p.id AS planta,
        p.nombre AS nombre_planta,
        g.nucleo,
        pg.fecha,
        pg.numero_galpon,
        pg.codigo_galpon,
        pg.nombre_galpon,
        pg.total_produccion
      FROM produccion_galpon pg
      INNER JOIN plantas p ON p.id = pg.planta
      INNER JOIN seccionales s ON s.id = p.id_seccional
      LEFT JOIN galpones g ON g.planta = pg.planta AND g.numero = pg.numero_galpon;
    `);

    seedCatalogs();
  }

  function seedCatalogs() {
    db.run(`INSERT OR IGNORE INTO seccionales (id, nombre) VALUES ('CAUCA', 'Seccional Cauca')`);

    const plantasSeed = [
      ['ALKA1', 'CAUCA', 'ALKA 1', 'Producción 1 y 2', '1YH-koHjnW_SowWWF5bG_2YjTrjn_CHGo', 1],
      ['ALKA2', 'CAUCA', 'ALKA 2', 'Producción 3', '1pRKUndHR9qpDtfHAY__IIDChzHxxVUZl', 2],
      ['PALMAS', 'CAUCA', 'ALKA PALMAS', 'Hotraco Orion', '0AMF9kxJDWux9Uk9PVA', 3]
    ];
    const insP = db.prepare(`INSERT OR IGNORE INTO plantas (id, id_seccional, nombre, subtitulo, folder_id, orden) VALUES (?, ?, ?, ?, ?, ?)`);
    for (const p of plantasSeed) insP.run(p);
    insP.free();

    const insG = db.prepare(`INSERT OR IGNORE INTO galpones (planta, numero, codigo, nombre, nucleo) VALUES (?, ?, ?, ?, ?)`);
    for (let n = 1; n <= 20; n++) {
      insG.run(['ALKA1', n, `GALPON${n}`, `Galpón ${n}`, n <= 10 ? 'PRODUCCION1' : 'PRODUCCION2']);
    }
    for (let n = 21; n <= 30; n++) {
      insG.run(['ALKA2', n, `GALPON${n}`, `Galpón ${n}`, 'PRODUCCION3']);
    }
    for (let n = 1; n <= 8; n++) {
      insG.run(['PALMAS', n, `GALPON${n}`, `Galpón ${n}`, 'PALMAS']);
    }
    insG.free();
  }

  async function init() {
    if (db) return;
    if (typeof initSqlJs !== 'function') {
      throw new Error('No se cargó la librería sql.js (lib/sql-wasm.js).');
    }

    SQL = await initSqlJs({
      locateFile: (file) => `./lib/${file}`
    });

    const savedBytes = await readBinaryFromIdb();
    db = (savedBytes && savedBytes.byteLength > 0)
      ? new SQL.Database(new Uint8Array(savedBytes))
      : new SQL.Database();

    ensureSchema();
    await persist();
  }

  async function persist() {
    if (!db) return;
    await writeBinaryToIdb(db.export());
  }

  function queryAll(sql, params = []) {
    if (!db) return [];
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  function getImportedMapForPlant(planta) {
    const rows = queryAll(`SELECT * FROM fechas_importadas WHERE planta = ?`, [planta]);
    const map = new Map();
    for (const r of rows) {
      map.set(r.fecha, r);
    }
    return map;
  }

  function getAllImportedMeta(planta = 'TODAS') {
    if (planta && planta !== 'TODAS') {
      return queryAll(`SELECT * FROM fechas_importadas WHERE planta = ? ORDER BY fecha DESC, planta ASC`, [planta]);
    }
    return queryAll(`SELECT * FROM fechas_importadas ORDER BY fecha DESC, planta ASC`);
  }

  async function savePlantDay(planta, fecha, fileMeta, galponRows, totalPlanta, cerrada) {
    if (!db) return;
    const nowIso = new Date().toISOString();

    db.run('BEGIN TRANSACTION');
    try {
      db.run('DELETE FROM produccion_galpon WHERE planta = ? AND fecha = ?', [planta, fecha]);

      const insGalp = db.prepare(`INSERT OR IGNORE INTO galpones (planta, numero, codigo, nombre, nucleo) VALUES (?, ?, ?, ?, ?)`);
      const ins = db.prepare(`
        INSERT INTO produccion_galpon (planta, fecha, numero_galpon, codigo_galpon, nombre_galpon, total_produccion)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const r of galponRows) {
        insGalp.run([planta, r.numeroGalpon, r.codigoGalpon, r.nombreGalpon, planta]);
        ins.run([planta, fecha, r.numeroGalpon, r.codigoGalpon, r.nombreGalpon, r.totalProduccion]);
      }
      insGalp.free();
      ins.free();

      db.run(
        `INSERT OR REPLACE INTO fechas_importadas
         (planta, fecha, file_id, file_name, modified_time, cerrada, total_planta, fecha_importacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [planta, fecha, fileMeta.id, fileMeta.name, fileMeta.modifiedTime || '', cerrada ? 1 : 0, totalPlanta, nowIso]
      );

      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }

    await persist();
  }

  function queryProduction(planta = 'TODAS', fechaInicio = null, fechaFin = null, numeroGalpon = 0) {
    const where = [];
    const params = [];

    if (planta && planta !== 'TODAS') {
      where.push('planta = ?');
      params.push(planta);
    }
    if (fechaInicio) {
      where.push('fecha >= ?');
      params.push(fechaInicio);
    }
    if (fechaFin) {
      where.push('fecha <= ?');
      params.push(fechaFin);
    }
    if (numeroGalpon > 0) {
      where.push('numero_galpon = ?');
      params.push(numeroGalpon);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return queryAll(
      `SELECT planta, fecha, numero_galpon, codigo_galpon, nombre_galpon, total_produccion
       FROM produccion_galpon
       ${whereSql}
       ORDER BY fecha DESC, planta ASC, numero_galpon ASC`,
      params
    );
  }

  function getDayData(fecha, planta = 'TODAS') {
    return queryProduction(planta, fecha, fecha, 0);
  }

  function getPlantTotalsForDate(fecha) {
    const rows = queryAll(
      `SELECT planta, COALESCE(SUM(total_produccion), 0) AS total,
              COUNT(CASE WHEN total_produccion > 0 THEN 1 END) AS activos
       FROM produccion_galpon
       WHERE fecha = ?
       GROUP BY planta`,
      [fecha]
    );
    const map = {};
    for (const r of rows) {
      map[r.planta] = { total: Number(r.total || 0), activos: Number(r.activos || 0) };
    }
    return map;
  }

  function getAvailableDateBounds(planta = 'TODAS') {
    const sql = (planta && planta !== 'TODAS')
      ? `SELECT MIN(fecha) AS minFecha, MAX(fecha) AS maxFecha FROM fechas_importadas WHERE planta = ?`
      : `SELECT MIN(fecha) AS minFecha, MAX(fecha) AS maxFecha FROM fechas_importadas`;
    const rows = (planta && planta !== 'TODAS') ? queryAll(sql, [planta]) : queryAll(sql);
    return rows[0] || { minFecha: null, maxFecha: null };
  }

  function getSummaryStats(todayStr) {
    const dToday = new Date(todayStr + 'T12:00:00');
    const d7 = new Date(dToday);
    d7.setDate(d7.getDate() - 6);
    const last7Start = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`;
    const monthPrefix = `${todayStr.slice(0, 7)}%`;

    const hoyRow = queryAll(`SELECT COALESCE(SUM(total_produccion), 0) AS total, COUNT(CASE WHEN total_produccion > 0 THEN 1 END) AS activos FROM produccion_galpon WHERE fecha = ?`, [todayStr])[0];
    const weekRow = queryAll(`SELECT COALESCE(SUM(total_produccion), 0) AS total FROM produccion_galpon WHERE fecha >= ? AND fecha <= ?`, [last7Start, todayStr])[0];
    const monthRow = queryAll(`SELECT COALESCE(SUM(total_produccion), 0) AS total FROM produccion_galpon WHERE fecha LIKE ?`, [monthPrefix])[0];
    const metaRow = queryAll(`SELECT COUNT(*) AS registros, COALESCE(SUM(cerrada), 0) AS cerrados, COUNT(DISTINCT fecha) AS diasUnicos FROM fechas_importadas`)[0];
    const catRow = queryAll(`SELECT COUNT(*) AS totalGalpones FROM galpones`)[0];

    return {
      totalHoyCauca: Number(hoyRow?.total || 0),
      activosHoyCauca: Number(hoyRow?.activos || 0),
      total7DiasCauca: Number(weekRow?.total || 0),
      totalMesCauca: Number(monthRow?.total || 0),
      totalRegistrosImportados: Number(metaRow?.registros || 0),
      registrosCerrados: Number(metaRow?.cerrados || 0),
      diasUnicos: Number(metaRow?.diasUnicos || 0),
      totalGalponesCatalogo: Number(catRow?.totalGalpones || 38)
    };
  }

  function updatePlantFolderId(plantaId, folderId) {
    if (!db) return;
    db.run(`UPDATE plantas SET folder_id = ? WHERE id = ?`, [folderId, plantaId]);
  }

  function exportDatabaseBytes() {
    return db ? db.export() : null;
  }

  function getDatabaseSizeKb() {
    if (!db) return 0;
    return Math.round((db.export().byteLength / 1024) * 10) / 10;
  }

  async function clearDatabase() {
    if (db) {
      db.close();
      db = null;
    }
    await deleteBinaryFromIdb();
    db = new SQL.Database();
    ensureSchema();
    await persist();
  }

  return {
    init,
    persist,
    getImportedMapForPlant,
    getAllImportedMeta,
    savePlantDay,
    queryProduction,
    getDayData,
    getPlantTotalsForDate,
    getAvailableDateBounds,
    getSummaryStats,
    updatePlantFolderId,
    exportDatabaseBytes,
    getDatabaseSizeKb,
    clearDatabase
  };
})();
