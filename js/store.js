/* =========================================================
   store.js
   Estado central del dataset: columnas, filas, tipo de target.
   Soporta carga desde CSV, Excel (.xlsx/.xls) y SQLite (.db).
   ========================================================= */

const Store = (() => {
  let columns = [];
  let rows = [];

  /* -------- utilidades internas -------- */
  function reset() { columns = []; rows = []; }

  function setColumnsFromHeader(headerNames) {
    columns = headerNames.map((name, i) => ({
      name: String(name).trim(),
      target: i === headerNames.length - 1,
      type: 'numeric'
    }));
  }

  function addColumn(name) {
    if (!name) return;
    if (columns.some(c => c.name === name)) return;
    columns.forEach(c => { c.target = false; });
    columns.push({ name, target: true, type: 'numeric' });
    rows.forEach(r => { r[name] = ''; });
  }

  function removeColumn(name) {
    columns = columns.filter(c => c.name !== name);
    rows.forEach(r => { delete r[name]; });
    if (columns.length && !columns.some(c => c.target))
      columns[columns.length - 1].target = true;
  }

  function setTarget(name) {
    columns.forEach(c => { c.target = (c.name === name); });
  }

  function addRow(rowObj) { rows.push(rowObj); recomputeTypes(); }
  function removeRowAt(index) { rows.splice(index, 1); }
  function clearAll() { reset(); }

  /* -------- CSV -------- */
  function loadCSV(text) {
    const parsed = parseCSV(text);
    if (!parsed.length) throw new Error('El CSV está vacío.');
    const header = parsed[0];
    setColumnsFromHeader(header);
    rows = parsed.slice(1)
      .filter(r => r.some(cell => cell !== '' && cell !== undefined))
      .map(r => {
        const obj = {};
        header.forEach((h, i) => { obj[h.trim()] = (r[i] !== undefined ? String(r[i]).trim() : ''); });
        return obj;
      });
    recomputeTypes();
  }

  function parseCSV(text) {
    const result = [];
    let row = [], field = '', inQuotes = false;
    const push = () => { row.push(field); field = ''; };
    const pushRow = () => { result.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQuotes = false; }
        else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') push();
        else if (c === '\r') { /* skip */ }
        else if (c === '\n') { push(); pushRow(); }
        else field += c;
      }
    }
    if (field.length || row.length) { push(); pushRow(); }
    return result.filter(r => r.length && !(r.length === 1 && r[0] === ''));
  }

  /* -------- Excel (.xlsx / .xls) via SheetJS -------- */
  // Recibe un ArrayBuffer del archivo
  function loadExcel(arrayBuffer, sheetName) {
    if (!window.XLSX) throw new Error('La librería SheetJS no está cargada todavía. Espera un momento y vuelve a intentarlo.');
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheet = sheetName
      ? wb.Sheets[sheetName]
      : wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new Error('No se encontró la hoja especificada en el archivo Excel.');

    // Convertir a array de arrays
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!raw.length) throw new Error('La hoja de Excel está vacía.');

    const header = raw[0].map(h => String(h).trim());
    setColumnsFromHeader(header);
    rows = raw.slice(1)
      .filter(r => r.some(cell => cell !== '' && cell !== null && cell !== undefined))
      .map(r => {
        const obj = {};
        header.forEach((h, i) => {
          let val = r[i] !== undefined && r[i] !== null ? r[i] : '';
          // Fechas de Excel → string ISO legible
          if (val instanceof Date) val = val.toISOString().slice(0, 10);
          obj[h] = String(val).trim();
        });
        return obj;
      });
    recomputeTypes();
    return wb.SheetNames; // devuelve lista de hojas para que UI pueda mostrar selector
  }

  /* -------- SQLite (.db) via sql.js -------- */
  // Recibe Uint8Array del archivo
  // Devuelve lista de tablas para que UI permita elegir
  async function loadSQLite(uint8Array) {
    if (!window.initSqlJs) throw new Error('La librería sql.js no está cargada todavía. Espera un momento y vuelve a intentarlo.');
    const SQL = await window.initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}` });
    const db = new SQL.Database(uint8Array);

    // Listar tablas
    const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const tables = tablesRes.length ? tablesRes[0].values.map(r => r[0]) : [];
    if (!tables.length) throw new Error('La base de datos no contiene tablas accesibles.');

    return { db, tables };
  }

  // Carga una tabla concreta desde un objeto DB ya abierto
  function loadSQLiteTable(db, tableName) {
    const res = db.exec(`SELECT * FROM "${tableName}" LIMIT 5000`);
    if (!res.length) throw new Error(`La tabla "${tableName}" está vacía.`);
    const { columns: cols, values } = res[0];

    setColumnsFromHeader(cols);
    rows = values.map(r => {
      const obj = {};
      cols.forEach((col, i) => {
        obj[col] = r[i] !== null && r[i] !== undefined ? String(r[i]) : '';
      });
      return obj;
    });
    recomputeTypes();
  }

  /* -------- tipos / getters -------- */
  function recomputeTypes() {
    columns.forEach(col => {
      const vals = rows.map(r => r[col.name]).filter(v => v !== '' && v !== undefined && v !== null);
      if (!vals.length) { col.type = 'numeric'; return; }
      col.type = vals.every(v => !isNaN(parseFloat(v)) && isFinite(v)) ? 'numeric' : 'categorical';
    });
  }

  function getColumns() { return columns; }
  function getRows() { return rows; }
  function getTargetColumn() { return columns.find(c => c.target) || null; }
  function getFeatureColumns() { return columns.filter(c => !c.target); }

  function getProblemType() {
    const target = getTargetColumn();
    if (!target) return null;
    if (target.type === 'categorical') return 'classification';
    const vals = rows.map(r => r[target.name]).filter(v => v !== '' && v !== undefined);
    const uniq = new Set(vals);
    if (uniq.size <= Math.min(10, Math.max(2, Math.floor(vals.length * 0.2)))) {
      const allInts = [...uniq].every(v => Number.isInteger(parseFloat(v)) && Math.abs(parseFloat(v)) < 1000);
      if (allInts && uniq.size <= 12) return 'classification';
    }
    return 'regression';
  }

  function getCleanRows() {
    return rows.filter(r => columns.every(c => r[c.name] !== '' && r[c.name] !== undefined && r[c.name] !== null));
  }

  return {
    reset, setColumnsFromHeader, addColumn, removeColumn, setTarget,
    addRow, removeRowAt, clearAll, loadCSV, loadExcel, loadSQLite, loadSQLiteTable,
    recomputeTypes, getColumns, getRows, getTargetColumn, getFeatureColumns,
    getProblemType, getCleanRows
  };
})();
