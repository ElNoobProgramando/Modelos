/* =========================================================
   ui.js — v2: añade Regresión Lineal, Excel y SQLite
   ========================================================= */

(() => {
  const $ = sel => document.querySelector(sel);
  const $all = sel => Array.from(document.querySelectorAll(sel));

  /* -------- Toast -------- */
  function showToast(msg, type = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast is-visible' + (type ? ' is-' + type : '');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { t.className = 'toast'; }, 3500);
  }

  function escHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  /* -------- Navegación -------- */
  function setView(id) {
    $all('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + id));
    $all('.nav__item').forEach(b => b.classList.toggle('is-active', b.dataset.view === id));
  }
  $all('.nav__item').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  /* ========================================================
     SAMPLES
  ======================================================== */
  const SAMPLE_CSV_CLASS = `temperatura,humedad,viento,nublado,llueve
30,65,10,No,No
25,80,15,Si,Si
28,70,5,No,No
18,90,25,Si,Si
22,85,20,Si,Si
33,40,8,No,No
20,95,30,Si,Si
27,60,12,No,No
24,88,22,Si,Si
31,55,9,No,No
19,92,28,Si,Si
29,50,6,No,No
21,89,26,Si,Si
26,65,14,No,No
23,91,24,Si,Si
32,45,7,No,No`;

  const SAMPLE_CSV_REG = `metros_cuadrados,habitaciones,antiguedad,distancia_centro,precio
65,2,10,5,145000
120,4,3,2,310000
80,3,15,8,175000
45,1,25,12,95000
150,5,1,1,420000
95,3,8,6,205000
70,2,20,10,140000
110,4,5,3,280000
55,2,18,9,115000
135,4,2,2,360000
85,3,12,7,190000
60,2,22,11,125000
125,4,4,3,300000
40,1,30,15,85000
100,3,6,4,225000
75,3,16,8,165000`;

  /* ========================================================
     RENDER: tabla de datos + badges
  ======================================================== */
  function renderDataTable() {
    const cols = Store.getColumns();
    const rows = Store.getRows();
    const thead = $('#dataTable thead');
    const tbody = $('#dataTable tbody');

    if (!cols.length) {
      thead.innerHTML = '<tr><th class="table-empty-th">Sin datos todavía</th></tr>';
      tbody.innerHTML = '';
    } else {
      thead.innerHTML = '<tr>' +
        cols.map(c => `<th class="${c.target ? 'is-target' : ''}">${escHtml(c.name)}${c.target ? ' ★' : ''}</th>`).join('') +
        '<th></th></tr>';

      const preview = rows.slice(0, 200);
      tbody.innerHTML = preview.map((r, idx) => {
        const cells = cols.map(c => `<td>${escHtml(r[c.name] ?? '')}</td>`).join('');
        return `<tr>${cells}<td><button class="row-del" data-idx="${idx}" title="Eliminar">✕</button></td></tr>`;
      }).join('');

      if (rows.length > 200) {
        const note = tbody.insertRow();
        const td = note.insertCell();
        td.colSpan = cols.length + 1;
        td.style.cssText = 'color:var(--text-mute);font-size:11px;padding:8px 12px;';
        td.textContent = `Mostrando 200 de ${rows.length} filas.`;
      }
    }

    $('#dataBadge').textContent = `${rows.length} filas · ${cols.length} columnas`;
    $('#rowCountTag').textContent = `${rows.length} filas`;

    tbody.querySelectorAll('.row-del').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.removeRowAt(parseInt(btn.dataset.idx, 10));
        renderAll();
      });
    });
  }

  function renderColumnConfig() {
    const cols = Store.getColumns();
    const panel = $('#configPanel');
    const wrap = $('#colConfig');
    if (!cols.length) { panel.hidden = true; return; }
    panel.hidden = false;

    wrap.innerHTML = cols.map(c => `
      <div class="col-row">
        <input type="text" value="${escHtml(c.name)}" data-action="rename" data-col="${escHtml(c.name)}">
        <span style="color:var(--text-mute);font-size:11px;">${c.type === 'numeric' ? 'numérica' : 'categórica'}</span>
        <label class="target-radio">
          <input type="radio" name="targetCol" data-action="target" data-col="${escHtml(c.name)}" ${c.target ? 'checked' : ''}>
          objetivo
        </label>
        <button data-action="remove" data-col="${escHtml(c.name)}" title="Eliminar columna">✕</button>
      </div>`).join('');

    wrap.querySelectorAll('[data-action="target"]').forEach(el =>
      el.addEventListener('change', () => { Store.setTarget(el.dataset.col); renderAll(); }));

    wrap.querySelectorAll('[data-action="remove"]').forEach(el =>
      el.addEventListener('click', () => { Store.removeColumn(el.dataset.col); renderAll(); }));

    wrap.querySelectorAll('[data-action="rename"]').forEach(el => {
      el.addEventListener('change', () => {
        const old = el.dataset.col, neu = el.value.trim();
        if (!neu || neu === old) { el.value = old; return; }
        const col = Store.getColumns().find(c => c.name === old);
        if (!col) return;
        if (Store.getColumns().some(c => c.name === neu)) {
          showToast('Ya existe una columna con ese nombre', 'error');
          el.value = old; return;
        }
        col.name = neu;
        Store.getRows().forEach(r => { r[neu] = r[old]; delete r[old]; });
        renderAll();
      });
    });
  }

  function renderManualForm() {
    const cols = Store.getColumns();
    const form = $('#manualForm');
    const hint = $('#manualHint');
    if (!cols.length) { form.hidden = true; hint.hidden = false; return; }
    hint.hidden = true;
    form.hidden = false;
    form.innerHTML = cols.map(c => `
      <div class="field ${c.target ? 'field--target' : ''}">
        <label>${escHtml(c.name)}${c.target ? ' (objetivo)' : ''}</label>
        <input type="text" data-col="${escHtml(c.name)}" placeholder="${c.type === 'numeric' ? '0' : 'valor'}">
      </div>`).join('') +
      `<button class="btn btn--primary btn--forest" id="submitManualRow" type="button" style="align-self:flex-end;">Agregar fila</button>`;

    $('#submitManualRow').addEventListener('click', () => {
      const obj = {};
      let ok = true;
      form.querySelectorAll('input[data-col]').forEach(inp => {
        obj[inp.dataset.col] = inp.value.trim();
        if (!inp.value.trim()) ok = false;
      });
      if (!ok) { showToast('Llena todos los campos antes de agregar', 'error'); return; }
      Store.addRow(obj);
      form.querySelectorAll('input[data-col]').forEach(inp => inp.value = '');
      renderAll();
      showToast('Fila agregada', 'success');
    });
  }

  function renderPredictForms() {
    const features = Store.getFeatureColumns();
    const html = features.length
      ? features.map(f => `
        <div class="field">
          <label>${escHtml(f.name)}</label>
          <input type="text" data-col="${escHtml(f.name)}" placeholder="${f.type === 'numeric' ? '0' : 'valor'}">
        </div>`).join('')
      : '<p class="viz-empty">Carga datos primero.</p>';

    $('#forestPredictForm').innerHTML = html;
    $('#nnPredictForm').innerHTML = html;
    $('#linregPredictForm').innerHTML = html;
  }

  function renderAll() {
    Store.recomputeTypes();
    renderDataTable();
    renderColumnConfig();
    renderManualForm();
    renderPredictForms();
  }

  function readPredictForm(sel) {
    const obj = {};
    $all(sel + ' input[data-col]').forEach(inp => { obj[inp.dataset.col] = inp.value.trim(); });
    return obj;
  }

  /* ========================================================
     CARGA DE ARCHIVOS — unificada para CSV / Excel / SQLite
  ======================================================== */
  let _excelBuffer = null;
  let _sqliteDb = null;

  const dropzone = $('#dropzone');
  const fileInput = $('#fileInput');

  function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();

    // Ocultar selectores previos
    $('#sheetSelectorWrap').hidden = true;
    $('#tableSelectorWrap').hidden = true;

    if (name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.loadCSV(reader.result);
          renderAll();
          showToast(`CSV cargado: ${Store.getRows().length} filas`, 'success');
        } catch (e) { showToast(e.message, 'error'); }
      };
      reader.readAsText(file);

    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          _excelBuffer = e.target.result;
          const sheets = Store.loadExcel(_excelBuffer);
          if (sheets.length === 1) {
            // Solo una hoja: carga directa
            showToast(`Excel cargado: ${Store.getRows().length} filas`, 'success');
            renderAll();
          } else {
            // Múltiples hojas: mostrar selector
            const sel = $('#sheetSelector');
            sel.innerHTML = sheets.map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
            $('#sheetSelectorWrap').hidden = false;
            showToast(`Excel con ${sheets.length} hojas — elige una hoja`, 'success');
            renderAll(); // carga la primera hoja por defecto
          }
        } catch (e) { showToast(e.message, 'error'); }
      };
      reader.readAsArrayBuffer(file);

    } else if (name.endsWith('.db') || name.endsWith('.sqlite') || name.endsWith('.sqlite3')) {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          showToast('Cargando base de datos…');
          const uint8 = new Uint8Array(e.target.result);
          const { db, tables } = await Store.loadSQLite(uint8);
          _sqliteDb = db;

          const sel = $('#tableSelector');
          sel.innerHTML = tables.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');
          $('#tableSelectorWrap').hidden = false;

          if (tables.length === 1) {
            Store.loadSQLiteTable(db, tables[0]);
            renderAll();
            showToast(`SQLite cargado: tabla "${tables[0]}" · ${Store.getRows().length} filas`, 'success');
          } else {
            showToast(`SQLite con ${tables.length} tablas — elige una tabla`, 'success');
          }
        } catch (e) { showToast('Error SQLite: ' + e.message, 'error'); }
      };
      reader.readAsArrayBuffer(file);

    } else {
      showToast('Formato no soportado. Usa .csv, .xlsx, .xls o .db', 'error');
    }
  }

  // Cargar hoja de Excel seleccionada
  $('#loadSheetBtn').addEventListener('click', () => {
    if (!_excelBuffer) return;
    const sheetName = $('#sheetSelector').value;
    try {
      Store.loadExcel(_excelBuffer, sheetName);
      renderAll();
      showToast(`Hoja "${sheetName}" cargada: ${Store.getRows().length} filas`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Cargar tabla SQLite seleccionada
  $('#loadTableBtn').addEventListener('click', () => {
    if (!_sqliteDb) return;
    const tableName = $('#tableSelector').value;
    try {
      Store.loadSQLiteTable(_sqliteDb, tableName);
      renderAll();
      showToast(`Tabla "${tableName}" cargada: ${Store.getRows().length} filas`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

  ['dragover','dragenter'].forEach(ev =>
    dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('is-dragover'); }));
  ['dragleave','drop'].forEach(ev =>
    dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('is-dragover'); }));
  dropzone.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));

  $('#loadSampleBtn').addEventListener('click', () => {
    try { Store.loadCSV(SAMPLE_CSV_CLASS); renderAll(); showToast('Ejemplo clima cargado', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
  });
  $('#loadSampleRegBtn').addEventListener('click', () => {
    try { Store.loadCSV(SAMPLE_CSV_REG); renderAll(); showToast('Ejemplo casas cargado', 'success'); }
    catch (e) { showToast(e.message, 'error'); }
  });

  $('#addColBtn').addEventListener('click', () => {
    const name = prompt('Nombre de la nueva columna:');
    if (name && name.trim()) { Store.addColumn(name.trim()); renderAll(); }
  });

  $('#clearDataBtn').addEventListener('click', () => {
    if (!confirm('¿Seguro que quieres borrar todos los datos cargados?')) return;
    Store.clearAll();
    _excelBuffer = null; _sqliteDb = null;
    $('#sheetSelectorWrap').hidden = true;
    $('#tableSelectorWrap').hidden = true;
    renderAll();
    showToast('Datos eliminados', 'success');
  });

  /* ========================================================
     CONTEXTO COMÚN DE ENTRENAMIENTO
  ======================================================== */
  function getTrainingContext() {
    const target = Store.getTargetColumn();
    const features = Store.getFeatureColumns();
    const cleanRows = Store.getCleanRows();
    if (!target) throw new Error('Define una columna objetivo en la sección de Datos.');
    if (!features.length) throw new Error('Necesitas al menos una columna de variables (features).');
    if (cleanRows.length < 4) throw new Error('Necesitas al menos 4 filas completas de datos.');
    const types = {};
    features.forEach(f => { types[f.name] = f.type; });
    return {
      rows: cleanRows,
      features: features.map(f => f.name),
      types,
      target: { name: target.name, problemType: Store.getProblemType() }
    };
  }

  function renderPredictResult(selector, result, problemType, targetName, accentClass) {
    const box = $(selector);
    if (problemType === 'classification') {
      box.innerHTML = `<div class="result-card ${accentClass}">
        <span class="result-label">${escHtml(targetName)} predicho</span>
        <span class="result-value">${escHtml(result.value)}</span>
        <span class="result-detail">confianza: ${(result.confidence * 100).toFixed(1)}%</span>
      </div>`;
    } else {
      box.innerHTML = `<div class="result-card ${accentClass}">
        <span class="result-label">${escHtml(targetName)} predicho</span>
        <span class="result-value">${result.value.toFixed(4)}</span>
      </div>`;
    }
  }

  /* ========================================================
     RANDOM FOREST
  ======================================================== */
  $('#trainForestBtn').addEventListener('click', () => {
    let ctx;
    try { ctx = getTrainingContext(); } catch (e) { showToast(e.message, 'error'); return; }
    const nTrees = Math.max(1, Math.min(200, parseInt($('#forestTreesInput').value) || 25));
    const maxDepth = Math.max(1, Math.min(30, parseInt($('#forestDepthInput').value) || 8));
    try {
      const m = ForestModel.train({ ...ctx, nTrees, maxDepth });
      renderForestMetrics(m);
      renderForestImportance();
      renderForestViz();
      showToast(`Bosque entrenado con ${nTrees} árboles`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  function renderForestMetrics(m) {
    const box = $('#forestMetrics');
    if (ForestModel.getProblemType() === 'classification') {
      box.innerHTML = `
        <div class="metric-card is-forest"><div class="label">Exactitud (in-sample)</div><div class="value">${(m.accuracy*100).toFixed(1)}%</div></div>
        <div class="metric-card is-forest"><div class="label">Árboles</div><div class="value">${ForestModel.getMeta().nTrees}</div></div>
        <div class="metric-card is-forest"><div class="label">Clases</div><div class="value">${ForestModel.getClasses().length}</div></div>`;
    } else {
      box.innerHTML = `
        <div class="metric-card is-forest"><div class="label">RMSE</div><div class="value">${m.rmse.toFixed(2)}</div></div>
        <div class="metric-card is-forest"><div class="label">R²</div><div class="value">${m.r2.toFixed(3)}</div></div>
        <div class="metric-card is-forest"><div class="label">Árboles</div><div class="value">${ForestModel.getMeta().nTrees}</div></div>`;
    }
  }

  function renderForestImportance() {
    const imp = ForestModel.getImportance();
    const entries = Object.entries(imp).sort((a,b) => b[1]-a[1]);
    $('#forestImportance').innerHTML = entries.length
      ? entries.map(([name, val]) => `
          <div class="imp-row">
            <span class="name" title="${escHtml(name)}">${escHtml(name)}</span>
            <span class="imp-bar-track"><span class="imp-bar-fill" style="width:${(val*100).toFixed(1)}%"></span></span>
            <span class="imp-pct">${(val*100).toFixed(0)}%</span>
          </div>`).join('')
      : '<p class="viz-empty">—</p>';
  }

  function renderForestViz() {
    const trees = ForestModel.getTrees();
    const wrap = $('#forestViz');
    if (!trees.length) { wrap.innerHTML = '<p class="viz-empty">Entrena el modelo para ver los árboles generados.</p>'; return; }
    const n = Math.min(6, trees.length);
    const container = document.createElement('div');
    container.className = 'forest-trees';
    for (let i = 0; i < n; i++) {
      const card = document.createElement('div');
      card.className = 'forest-tree-card';
      card.innerHTML = treeToSVG(trees[i]) + `<p class="tree-card-label">árbol ${i+1}</p>`;
      container.appendChild(card);
    }
    wrap.innerHTML = '';
    wrap.appendChild(container);
    if (trees.length > n) {
      const note = document.createElement('p');
      note.className = 'viz-empty'; note.style.width='100%'; note.style.marginTop='8px';
      note.textContent = `Mostrando ${n} de ${trees.length} árboles.`;
      wrap.appendChild(note);
    }
  }

  function treeToSVG(root) {
    const W=190, H=150, levelH=28, nodeR=4;
    const nodes=[], links=[];
    function layout(node, depth, xMin, xMax) {
      if (depth > 4) { nodes.push({x:(xMin+xMax)/2,y:14+depth*levelH,isLeaf:true,label:'…'}); return {x:(xMin+xMax)/2,y:14+depth*levelH}; }
      const x=(xMin+xMax)/2, y=14+depth*levelH;
      if (node.isLeaf) {
        const label = typeof node.value==='number' ? node.value.toFixed(1) : String(node.value).slice(0,6);
        nodes.push({x,y,isLeaf:true,label}); return {x,y};
      }
      nodes.push({x,y,isLeaf:false,label:shortFeatLabel(node)});
      const l=layout(node.left,depth+1,xMin,x), r=layout(node.right,depth+1,x,xMax);
      links.push({x1:x,y1:y,x2:l.x,y2:l.y}); links.push({x1:x,y1:y,x2:r.x,y2:r.y});
      return {x,y};
    }
    layout(root,0,6,W-6);
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      ${links.map(l=>`<line class="tree-link" x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"/>`).join('')}
      ${nodes.map(n=>`<circle class="tree-node ${n.isLeaf?'is-leaf':''}" cx="${n.x}" cy="${n.y}" r="${nodeR}"/>
        <text class="${n.isLeaf?'tree-leaf-label':'tree-label'}" x="${n.x}" y="${n.y-7}" text-anchor="middle">${escHtml(n.label)}</text>`).join('')}
    </svg>`;
  }
  function shortFeatLabel(node) {
    const name = node.feature.length>8 ? node.feature.slice(0,7)+'…' : node.feature;
    if (node.isNumeric) return `${name}≤${Math.round(node.threshold*10)/10}`;
    const cat = String(node.category).length>5 ? String(node.category).slice(0,4)+'…' : node.category;
    return `${name}=${cat}`;
  }

  $('#forestPredictBtn').addEventListener('click', () => {
    if (!ForestModel.isTrained()) { showToast('Entrena el bosque primero', 'error'); return; }
    const raw = readPredictForm('#forestPredictForm');
    if (Store.getFeatureColumns().some(f => !raw[f.name])) { showToast('Llena todas las variables', 'error'); return; }
    const result = ForestModel.predict(raw);
    renderPredictResult('#forestPredictResult', result, ForestModel.getProblemType(), Store.getTargetColumn().name, '');
  });

  /* ========================================================
     RED NEURONAL
  ======================================================== */
  $('#trainNnBtn').addEventListener('click', () => {
    let ctx;
    try { ctx = getTrainingContext(); } catch (e) { showToast(e.message, 'error'); return; }
    const hiddenUnits = Math.max(1, Math.min(64, parseInt($('#nnHiddenInput').value)||8));
    const epochs = Math.max(10, Math.min(5000, parseInt($('#nnEpochsInput').value)||400));
    const lr = Math.max(0.001, Math.min(1, parseFloat($('#nnLrInput').value)||0.05));
    renderNnArch(ctx, hiddenUnits, []);
    try {
      const m = NeuralModel.train({ ...ctx, hiddenUnits, epochs, lr });
      renderNnMetrics(m);
      renderNnArch(ctx, hiddenUnits, NeuralModel.getLossHistory());
      renderLossCurve('#nnLossViz', NeuralModel.getLossHistory(), 'var(--neuron)');
      showToast(`Red entrenada (${epochs} épocas)`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  function renderNnMetrics(m) {
    const box = $('#nnMetrics');
    if (NeuralModel.getProblemType()==='classification') {
      box.innerHTML = `
        <div class="metric-card is-neuron"><div class="label">Exactitud (in-sample)</div><div class="value">${(m.accuracy*100).toFixed(1)}%</div></div>
        <div class="metric-card is-neuron"><div class="label">Neuronas ocultas</div><div class="value">${NeuralModel.getMeta().hiddenSize}</div></div>
        <div class="metric-card is-neuron"><div class="label">Clases</div><div class="value">${NeuralModel.getClasses().length}</div></div>`;
    } else {
      box.innerHTML = `
        <div class="metric-card is-neuron"><div class="label">RMSE</div><div class="value">${m.rmse.toFixed(2)}</div></div>
        <div class="metric-card is-neuron"><div class="label">R²</div><div class="value">${m.r2.toFixed(3)}</div></div>
        <div class="metric-card is-neuron"><div class="label">Neuronas ocultas</div><div class="value">${NeuralModel.getMeta().hiddenSize}</div></div>`;
    }
  }

  function renderNnArch(ctx, hiddenUnits, lossHistory) {
    const wrap = $('#nnViz');
    const inCount = ctx.features.length;
    const outCount = ctx.target.problemType==='classification'
      ? new Set(ctx.rows.map(r=>r[ctx.target.name])).size : 1;
    const W=460, H=270;
    const lx={in:70,hid:230,out:390};
    const trained = lossHistory.length>0;
    const ys = (n,H) => { const g=H/(n+1); return Array.from({length:n},(_,i)=>g*(i+1)); };
    const inYs=ys(Math.min(inCount,8),H), hidYs=ys(Math.min(hiddenUnits,10),H), outYs=ys(Math.min(outCount,6),H);
    const inputNames=ctx.features.slice(0,8).map(f=>f.length>9?f.slice(0,8)+'…':f);
    let links='';
    inYs.forEach(y1=>hidYs.forEach(y2=>{links+=`<line class="nn-link" x1="${lx.in}" y1="${y1}" x2="${lx.hid}" y2="${y2}" opacity="${trained?.45:.2}"/>`;}));
    hidYs.forEach(y1=>outYs.forEach(y2=>{links+=`<line class="nn-link" x1="${lx.hid}" y1="${y1}" x2="${lx.out}" y2="${y2}" opacity="${trained?.45:.2}"/>`;}));
    const nodes=(xs,ys,names)=>ys.map((y,i)=>`<circle class="nn-node" cx="${xs}" cy="${y}" r="9"/>
      ${names?`<text class="nn-node-label" x="${xs-14}" y="${y+3}" text-anchor="end">${escHtml(names[i]||'')}</text>`:''}`).join('');
    wrap.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      ${links}${nodes(lx.in,inYs,inputNames)}${nodes(lx.hid,hidYs,null)}${nodes(lx.out,outYs,null)}
      <text x="${lx.in}" y="${H-4}" text-anchor="middle" class="nn-node-label">entrada</text>
      <text x="${lx.hid}" y="${H-4}" text-anchor="middle" class="nn-node-label">oculta</text>
      <text x="${lx.out}" y="${H-4}" text-anchor="middle" class="nn-node-label">salida</text>
    </svg>`;
  }

  function renderLossCurve(selector, history, color) {
    const wrap = $(selector);
    if (!history.length) { wrap.innerHTML='<p class="viz-empty">—</p>'; return; }
    const W=460, H=120, pad=18;
    const maxL=Math.max(...history), minL=Math.min(...history), range=(maxL-minL)||1;
    const pts=history.map((v,i)=>{
      const x=pad+(i/(history.length-1))*(W-pad*2);
      const y=H-pad-((v-minL)/range)*(H-pad*2);
      return `${x},${y}`;
    }).join(' ');
    wrap.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8"/>
      <text x="${pad}" y="14" class="nn-node-label">inicial: ${history[0].toFixed(4)}</text>
      <text x="${W-pad}" y="14" text-anchor="end" class="nn-node-label">final: ${history[history.length-1].toFixed(4)}</text>
    </svg>`;
  }

  $('#nnPredictBtn').addEventListener('click', () => {
    if (!NeuralModel.isTrained()) { showToast('Entrena la red primero', 'error'); return; }
    const raw = readPredictForm('#nnPredictForm');
    if (Store.getFeatureColumns().some(f => !raw[f.name])) { showToast('Llena todas las variables', 'error'); return; }
    const result = NeuralModel.predict(raw);
    renderPredictResult('#nnPredictResult', result, NeuralModel.getProblemType(), Store.getTargetColumn().name, 'is-neuron');
  });

  /* ========================================================
     REGRESIÓN LINEAL
  ======================================================== */
  $('#trainLinRegBtn').addEventListener('click', () => {
    let ctx;
    try { ctx = getTrainingContext(); } catch (e) { showToast(e.message, 'error'); return; }

    if (ctx.target.problemType !== 'regression') {
      showToast('La Regresión Lineal solo funciona con objetivos numéricos (regresión). Cambia la columna objetivo o usa otro modelo.', 'error');
      return;
    }

    const epochs = Math.max(10, Math.min(10000, parseInt($('#lrEpochsInput').value)||500));
    const lr = Math.max(0.0001, Math.min(1, parseFloat($('#lrLrInput').value)||0.01));
    const batchSize = Math.max(1, Math.min(512, parseInt($('#lrBatchInput').value)||16));

    try {
      const m = LinRegModel.train({ ...ctx, epochs, lr, batchSize });
      renderLinRegMetrics(m);
      renderLinRegEquation();
      renderLinRegCoefficients();
      renderLossCurve('#linregLossViz', LinRegModel.getLossHistory(), 'var(--linreg)');
      showToast(`Regresión lineal entrenada (${epochs} épocas)`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  function renderLinRegMetrics(m) {
    $('#linregMetrics').innerHTML = `
      <div class="metric-card is-linreg"><div class="label">RMSE</div><div class="value">${m.rmse.toFixed(2)}</div></div>
      <div class="metric-card is-linreg"><div class="label">R²</div><div class="value">${m.r2.toFixed(3)}</div></div>
      <div class="metric-card is-linreg"><div class="label">R (corr.)</div><div class="value">${(m.r2 >= 0 ? Math.sqrt(m.r2) : 0).toFixed(3)}</div></div>`;
  }

  function renderLinRegEquation() {
    const eq = LinRegModel.getEquation();
    const target = Store.getTargetColumn();
    const wrap = $('#linregEqViz');
    if (!eq) { wrap.innerHTML='<p class="viz-empty">—</p>'; return; }

    let terms = `<strong>${escHtml(target.name)}</strong> = ${eq.intercept.toFixed(2)}`;
    eq.coeffs.forEach(({ name, coeff }) => {
      const sign = coeff >= 0 ? ' + ' : ' − ';
      terms += `${sign}${Math.abs(coeff).toFixed(4)} × <strong>${escHtml(name)}</strong>`;
    });

    wrap.innerHTML = `
      <div class="eq-line">${terms}</div>
      <p style="font-size:11px;color:var(--text-mute);margin:0;">
        Solo muestra variables numéricas des-normalizadas. Las categóricas (one-hot) se muestran en los coeficientes internos abajo.
      </p>`;
  }

  function renderLinRegCoefficients() {
    const coeffs = LinRegModel.getCoefficients();
    const maxAbs = Math.max(...coeffs.map(c => Math.abs(c.weightReal)), 0.001);

    $('#linregCoeffs').innerHTML = coeffs.map(({ label, weightReal }) => {
      const pct = Math.abs(weightReal) / maxAbs * 100;
      const barClass = weightReal >= 0 ? 'eq-coeff-bar-pos' : 'eq-coeff-bar-neg';
      return `<div class="eq-coeff-row">
        <span class="name" title="${escHtml(label)}">${escHtml(label)}</span>
        <span class="coeff-bar-track"><span class="${barClass}" style="width:${pct.toFixed(1)}%"></span></span>
        <span class="val">${weightReal >= 0 ? '+' : ''}${weightReal.toFixed(3)}</span>
      </div>`;
    }).join('');
  }

  $('#linregPredictBtn').addEventListener('click', () => {
    if (!LinRegModel.isTrained()) { showToast('Entrena la regresión primero', 'error'); return; }
    const raw = readPredictForm('#linregPredictForm');
    if (Store.getFeatureColumns().some(f => !raw[f.name])) { showToast('Llena todas las variables', 'error'); return; }
    const result = LinRegModel.predict(raw);
    renderPredictResult('#linregPredictResult', result, 'regression', Store.getTargetColumn().name, 'is-linreg');
  });

  /* ========================================================
     ESTILOS DINÁMICOS: is-linreg en predict-result
  ======================================================== */
  const style = document.createElement('style');
  style.textContent = `
    .result-card.is-linreg { border-left-color: var(--linreg); }
    .result-card.is-linreg .result-value { color: var(--linreg); }
    .coeff-bar-track { flex:1; height:7px; background:var(--bg); border-radius:100px; overflow:hidden; }
  `;
  document.head.appendChild(style);

  /* ========================================================
     TAREA 1 — Regresión Lineal Inversiones vs Ventas (profe)
  ======================================================== */

  // ---- Helpers de render ----
  function t1RenderTabla(datos, totalOriginal) {
    // totalOriginal = cuántos registros había ANTES del último insert
    // Filas nuevas (index >= totalOriginal) se marcan con .is-new
    const tbody = $('#t1Tbody');
    if (!datos.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="table-empty-th">Sin datos</td></tr>';
      return;
    }
    tbody.innerHTML = datos.map((d, i) => {
      const esNuevo = i >= totalOriginal;
      return `<tr class="${esNuevo ? 'is-new' : ''}">
        <td>${escHtml(d.mes)}</td>
        <td>$${d.inversion.toFixed(2)}</td>
        <td>${d.ventas.toFixed(2)}</td>
      </tr>`;
    }).join('');
    $('#t1RowBadge').textContent = `${datos.length} registros`;
  }

  function t1RenderEcuacion(m, b, r2) {
    const signo = b >= 0 ? '+' : '−';
    const bAbs  = Math.abs(b).toFixed(4);
    $('#t1Ecuacion').innerHTML = `
      <div class="eq-titulo">Ecuación de la recta — Mínimos cuadrados</div>
      <div class="eq-formula">
        <span>Ventas</span> = <span>${m.toFixed(4)}</span> × Inversión ${signo} <span>${bAbs}</span>
      </div>
      <div class="eq-formula" style="font-size:12px;color:var(--text-dim);margin-top:4px;">
        y = m·x + b
      </div>
      <div class="eq-valores">
        Pendiente (m) = ${m.toFixed(4)} &nbsp;|&nbsp; Intercepto (b) = ${b.toFixed(4)} &nbsp;|&nbsp; R² = ${r2.toFixed(4)}
      </div>`;
  }

  function t1RenderMetricas(datos, m, b) {
    const n = datos.length;
    const r2 = Tarea1.calcularR2();
    const promX = datos.reduce((s,d) => s+d.inversion,0) / n;
    const promY = datos.reduce((s,d) => s+d.ventas,0)     / n;
    $('#t1Metricas').innerHTML = `
      <div class="metric-card is-tarea"><div class="label">Registros (n)</div><div class="value">${n}</div></div>
      <div class="metric-card is-tarea"><div class="label">R²</div><div class="value">${r2.toFixed(3)}</div></div>
      <div class="metric-card is-tarea"><div class="label">Pendiente (m)</div><div class="value">${m.toFixed(3)}</div></div>
      <div class="metric-card is-tarea"><div class="label">Intercepto (b)</div><div class="value">${b.toFixed(2)}</div></div>
      <div class="metric-card is-tarea"><div class="label">Promedio X</div><div class="value">${promX.toFixed(1)}</div></div>
      <div class="metric-card is-tarea"><div class="label">Promedio Y</div><div class="value">${promY.toFixed(1)}</div></div>`;
  }

  function t1RenderGrafica(datos, m, b) {
    const wrap = $('#t1Grafica');
    if (!datos.length) { wrap.innerHTML='<p class="viz-empty">—</p>'; return; }

    const W = 500, H = 160, padL = 50, padB = 30, padT = 16, padR = 20;
    const xs = datos.map(d => d.inversion);
    const ys = datos.map(d => d.ventas);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = (maxX - minX) || 1;
    const rangeY = (maxY - minY) || 1;
    const cx = x => padL + ((x - minX) / rangeX) * (W - padL - padR);
    const cy = y => padT + (1 - (y - minY) / rangeY) * (H - padT - padB);

    // Línea de regresión
    const x0 = minX, x1 = maxX;
    const y0 = m*x0+b, y1 = m*x1+b;

    const puntos = datos.map((d, i) => {
      const esNuevo = i >= (datos.length - 1) && $('#t1Tbody .is-new');
      return `<circle cx="${cx(d.inversion).toFixed(1)}" cy="${cy(d.ventas).toFixed(1)}" r="4"
        fill="${esNuevo ? 'var(--tarea)' : 'var(--text-dim)'}" opacity=".85"
        title="${d.mes}: inv=${d.inversion}, ventas=${d.ventas}"/>`;
    }).join('');

    // Ejes
    const ejX = `<line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--line)" stroke-width="1"/>`;
    const ejY = `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="var(--line)" stroke-width="1"/>`;
    const lblX = `<text x="${W/2}" y="${H-2}" text-anchor="middle" class="nn-node-label">Inversión (X)</text>`;
    const lblY = `<text x="10" y="${H/2}" text-anchor="middle" class="nn-node-label" transform="rotate(-90,10,${H/2})">Ventas (Y)</text>`;

    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      ${ejX}${ejY}${lblX}${lblY}
      <line x1="${cx(x0).toFixed(1)}" y1="${cy(y0).toFixed(1)}" x2="${cx(x1).toFixed(1)}" y2="${cy(y1).toFixed(1)}"
        stroke="var(--tarea)" stroke-width="1.8" stroke-dasharray="4 3" opacity=".8"/>
      ${puntos}
    </svg>`;
  }

  function t1RenderFull(datos, totalAntes) {
    const m  = Tarea1.getPendiente();
    const b  = Tarea1.getIntercepto();
    const r2 = Tarea1.calcularR2();
    t1RenderTabla(datos, totalAntes);
    t1RenderEcuacion(m, b, r2);
    t1RenderMetricas(datos, m, b);
    t1RenderGrafica(datos, m, b);
    // Actualizar nombre de mes sugerido
    $('#t1NuevoMes').value = `mes ${datos.length + 1}`;
  }

  // ---- Carga del .db del profe ----
  let _t1TotalOriginal = 0; // cuántos registros había antes del primer insert en esta sesión

  $('#dbInputTarea1').addEventListener('change', async () => {
    const file = $('#dbInputTarea1').files[0];
    if (!file) return;

    showToast('Cargando base de datos del profe…');
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const uint8 = new Uint8Array(e.target.result);
        const { datos, pendiente, intercepto, n } = await Tarea1.cargarDB(uint8);
        _t1TotalOriginal = n;

        t1RenderFull(datos, _t1TotalOriginal);

        // Habilitar panel de predicción
        const panel = $('#t1PredPanel');
        panel.style.opacity = '1';
        panel.style.pointerEvents = 'auto';

        // Actualizar label del dropzone
        const lbl = $('#dbInputLabel');
        lbl.innerHTML = `<strong>✓ ${escHtml(file.name)}</strong> cargado`;
        document.querySelector('.dropzone-mini').classList.add('is-loaded');

        showToast(`BD cargada: ${n} registros históricos, m=${pendiente.toFixed(4)}, b=${intercepto.toFixed(4)}`, 'success');
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // ---- Predicción y guardado ----
  $('#t1PredBtn').addEventListener('click', () => {
    if (!Tarea1.isLoaded()) { showToast('Carga la BD primero', 'error'); return; }
    const inv = $('#t1NuevaInversion').value.trim();
    if (!inv) { showToast('Ingresa la cantidad a invertir', 'error'); return; }

    try {
      const totalAntes = Tarea1.getConteo();
      const res = Tarea1.predecirYGuardar(inv);

      // Mostrar resultado (mismo mensaje que el printf del profe)
      const signo = res.ventasPredichas >= 0 ? '' : '';
      $('#t1Resultado').innerHTML = `
        <div class="res-titulo">>>> CÁLCULO PREDICTIVO AUTOMÁTICO <<<</div>
        <div class="res-main">Ventas estimadas: $${res.ventasPredichas.toFixed(2)}</div>
        <div class="res-detail">
          Para el <strong>${escHtml(res.nuevoMes)}</strong> con una inversión de
          <strong>$${res.inversión.toFixed(2)}</strong>,<br>
          las ventas estimadas son: <strong>${res.ventasPredichas.toFixed(2)}</strong>
        </div>
        <div class="res-query">
          Query ejecutada: INSERT INTO reportes (mes, inversion, ventas) VALUES
          ('${escHtml(res.nuevoMes)}', ${res.inversión.toFixed(2)}, ${res.ventasPredichas.toFixed(2)})
        </div>`;

      $('#t1ResultadoWrap').hidden = false;

      // Re-renderizar tabla y gráfica con el nuevo punto marcado
      t1RenderFull(res.datos, totalAntes);

      // Limpiar input
      $('#t1NuevaInversion').value = '';
      showToast(`¡Registro guardado! ${escHtml(res.nuevoMes)}: ventas=$${res.ventasPredichas.toFixed(2)}`, 'success');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  // ---- Descarga de BD actualizada ----
  $('#t1DescargarBtn').addEventListener('click', () => {
    try {
      const bytes = Tarea1.exportarDB();
      const blob  = new Blob([bytes], { type: 'application/octet-stream' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href = url;
      a.download = 'inversiones_ventas_actualizada.db';
      a.click();
      URL.revokeObjectURL(url);
      showToast('BD descargada correctamente', 'success');
    } catch (err) {
      showToast('Error al descargar: ' + err.message, 'error');
    }
  });

  /* ========================================================
     INIT
  ======================================================== */
  renderAll();
  setView('forest');
})();
