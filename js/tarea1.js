/* =========================================================
   tarea1.js
   Replica exactamente la lógica de tarea1.c (C + SQLite) del profe:
   - Lee tabla "reportes" (mes, inversion, ventas) de un .db
   - Calcula pendiente m e intercepto b por MÍNIMOS CUADRADOS exactos
     (igual que el código C, NO gradiente descendente)
   - Permite ingresar una nueva inversión y predice las ventas
   - Guarda el nuevo registro (mes N+1, inversion, ventas_predichas)
     de vuelta en la misma BD en memoria (descargable)
   ========================================================= */

const Tarea1 = (() => {
  // Estado interno del módulo
  let _db = null;           // instancia sql.js de la BD cargada
  let _datos = [];          // [{ mes, inversion, ventas }] leídos de la BD
  let _m = 0;               // pendiente
  let _b = 0;               // intercepto
  let _conteo = 0;          // cantidad de registros históricos

  /* -------------------------------------------------------
     calcularRegresion()
     Réplica exacta del algoritmo de tarea1.c:
       1. Lee datos de la tabla reportes
       2. Calcula promedios
       3. Calcula sumatoria_x_y y sumatoria_x_cuadrado
       4. Deriva pendiente (m) e intercepto (b)
  ------------------------------------------------------- */
  function calcularRegresion(datos) {
    const n = datos.length;
    if (n === 0) throw new Error("La tabla 'reportes' está vacía.");

    let sumX = 0, sumY = 0;
    datos.forEach(d => { sumX += d.inversion; sumY += d.ventas; });

    const promX = sumX / n;
    const promY = sumY / n;

    let sumXY = 0, sumXX = 0;
    datos.forEach(d => {
      sumXY += (d.inversion - promX) * (d.ventas - promY);
      sumXX += (d.inversion - promX) * (d.inversion - promX);
    });

    if (sumXX === 0) throw new Error("Todas las inversiones son iguales, no se puede calcular la pendiente.");

    const pendiente  = sumXY / sumXX;
    const intercepto = promY - (pendiente * promX);

    return { pendiente, intercepto, promX, promY, n };
  }

  /* -------------------------------------------------------
     cargarDB(uint8Array)
     Abre la BD con sql.js y lee la tabla "reportes"
  ------------------------------------------------------- */
  async function cargarDB(uint8Array) {
    if (!window.initSqlJs) throw new Error('sql.js no está listo todavía. Espera un momento.');

    const SQL = await window.initSqlJs({
      locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`
    });

    _db = new SQL.Database(uint8Array);

    // Verificar que existe la tabla reportes
    const chk = _db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='reportes'");
    if (!chk.length || !chk[0].values.length) {
      throw new Error("La BD no tiene una tabla llamada 'reportes'. ¿Es el archivo correcto del profe?");
    }

    // Leer datos (igual que el SELECT del profe)
    const res = _db.exec("SELECT mes, inversion, ventas FROM reportes");
    if (!res.length) {
      _datos = [];
    } else {
      _datos = res[0].values.map(row => ({
        mes:       String(row[0]).trim(),
        inversion: parseFloat(row[1]),
        ventas:    parseFloat(row[2])
      }));
    }

    _conteo = _datos.length;

    // Calcular regresión inmediatamente al cargar
    const reg = calcularRegresion(_datos);
    _m = reg.pendiente;
    _b = reg.intercepto;

    return {
      datos: _datos,
      pendiente: _m,
      intercepto: _b,
      n: _conteo
    };
  }

  /* -------------------------------------------------------
     predecirYGuardar(nuevaInversion)
     Réplica de PASO 3 + PASO 4 de tarea1.c:
       - Predice ventas con y = mx + b
       - Nombra el nuevo mes como "mes N+1"
       - Inserta el registro en la BD en memoria
       - Relee la tabla para reflejar el cambio
  ------------------------------------------------------- */
  function predecirYGuardar(nuevaInversion) {
    if (!_db) throw new Error("Carga primero la base de datos.");

    const inv = parseFloat(nuevaInversion);
    if (isNaN(inv) || inv < 0) throw new Error("La inversión debe ser un número positivo.");

    const ventasPredichas = (_m * inv) + _b;

    // Nombre del mes automático (igual que tarea1.c: "mes N+1")
    const nuevoMes = `mes ${_conteo + 1}`;

    // INSERT (réplica del sql_insert de tarea1.c)
    const sql = `INSERT INTO reportes (mes, inversion, ventas) VALUES ('${nuevoMes}', ${inv.toFixed(2)}, ${ventasPredichas.toFixed(2)})`;
    _db.run(sql);

    // Releer para reflejar el nuevo registro
    const res = _db.exec("SELECT mes, inversion, ventas FROM reportes");
    _datos = res.length ? res[0].values.map(row => ({
      mes:       String(row[0]).trim(),
      inversion: parseFloat(row[1]),
      ventas:    parseFloat(row[2])
    })) : [];
    _conteo = _datos.length;

    // Recalcular regresión con el nuevo punto incluido
    const reg = calcularRegresion(_datos);
    _m = reg.pendiente;
    _b = reg.intercepto;

    return {
      nuevoMes,
      inversión: inv,
      ventasPredichas,
      datos: _datos,
      pendiente: _m,
      intercepto: _b
    };
  }

  /* -------------------------------------------------------
     exportarDB()
     Devuelve un Uint8Array con la BD actualizada para descarga
  ------------------------------------------------------- */
  function exportarDB() {
    if (!_db) throw new Error("No hay base de datos cargada.");
    return _db.export();
  }

  /* -------------------------------------------------------
     calcularR2()
     Coeficiente de determinación R² sobre los datos actuales
  ------------------------------------------------------- */
  function calcularR2() {
    if (!_datos.length) return 0;
    const promY = _datos.reduce((s, d) => s + d.ventas, 0) / _datos.length;
    let sse = 0, sst = 0;
    _datos.forEach(d => {
      const pred = _m * d.inversion + _b;
      sse += (d.ventas - pred) ** 2;
      sst += (d.ventas - promY) ** 2;
    });
    return sst > 0 ? 1 - sse / sst : 0;
  }

  function getDatos()      { return _datos; }
  function getPendiente()  { return _m; }
  function getIntercepto() { return _b; }
  function getConteo()     { return _conteo; }
  function isLoaded()      { return _db !== null; }

  return {
    cargarDB,
    predecirYGuardar,
    exportarDB,
    calcularR2,
    getDatos,
    getPendiente,
    getIntercepto,
    getConteo,
    isLoaded
  };
})();
