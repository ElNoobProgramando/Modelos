/* =========================================================
   forest.js
   Random Forest implementado desde cero:
   - Árboles CART (clasificación: Gini, regresión: MSE)
   - Bagging (muestreo con reemplazo por árbol)
   - Selección aleatoria de features por split (sqrt(n) aprox)
   ========================================================= */

const ForestModel = (() => {
  let trees = [];
  let featureNames = [];
  let featureTypes = {}; // name -> 'numeric' | 'categorical'
  let targetName = '';
  let problemType = 'classification'; // 'classification' | 'regression'
  let classes = []; // para clasificación
  let trainedMeta = { nTrees: 0, maxDepth: 0, nRows: 0 };
  let lastImportance = {};

  function sampleWithReplacement(rows) {
    const n = rows.length;
    const out = [];
    for (let i = 0; i < n; i++) out.push(rows[Math.floor(Math.random() * n)]);
    return out;
  }

  function gini(rowsY) {
    const counts = {};
    rowsY.forEach(y => counts[y] = (counts[y] || 0) + 1);
    const n = rowsY.length;
    let imp = 1;
    for (const k in counts) {
      const p = counts[k] / n;
      imp -= p * p;
    }
    return imp;
  }

  function mse(rowsY) {
    if (!rowsY.length) return 0;
    const mean = rowsY.reduce((a, b) => a + b, 0) / rowsY.length;
    return rowsY.reduce((a, b) => a + (b - mean) ** 2, 0) / rowsY.length;
  }

  function pickRandomFeatures(allFeatures) {
    const k = Math.max(1, Math.round(Math.sqrt(allFeatures.length)));
    const shuffled = [...allFeatures].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, k);
  }

  function bestSplit(rows, candidateFeatures) {
    let best = null;
    const impurityFn = problemType === 'classification' ? gini : mse;
    const yAll = rows.map(r => r.__y);
    const parentImpurity = impurityFn(yAll);

    candidateFeatures.forEach(feat => {
      const isNumeric = featureTypes[feat] === 'numeric';
      if (isNumeric) {
        const values = [...new Set(rows.map(r => r[feat]))].sort((a, b) => a - b);
        for (let i = 0; i < values.length - 1; i++) {
          const threshold = (values[i] + values[i + 1]) / 2;
          const left = rows.filter(r => r[feat] <= threshold);
          const right = rows.filter(r => r[feat] > threshold);
          if (!left.length || !right.length) continue;
          const wImp = (left.length / rows.length) * impurityFn(left.map(r => r.__y)) +
                       (right.length / rows.length) * impurityFn(right.map(r => r.__y));
          const gain = parentImpurity - wImp;
          if (!best || gain > best.gain) {
            best = { feature: feat, isNumeric: true, threshold, gain, left, right };
          }
        }
      } else {
        const cats = [...new Set(rows.map(r => r[feat]))];
        cats.forEach(cat => {
          const left = rows.filter(r => r[feat] === cat);
          const right = rows.filter(r => r[feat] !== cat);
          if (!left.length || !right.length) return;
          const wImp = (left.length / rows.length) * impurityFn(left.map(r => r.__y)) +
                       (right.length / rows.length) * impurityFn(right.map(r => r.__y));
          const gain = parentImpurity - wImp;
          if (!best || gain > best.gain) {
            best = { feature: feat, isNumeric: false, category: cat, gain, left, right };
          }
        });
      }
    });
    return best;
  }

  function leafValue(rows) {
    const ys = rows.map(r => r.__y);
    if (problemType === 'classification') {
      const counts = {};
      ys.forEach(y => counts[y] = (counts[y] || 0) + 1);
      let best = ys[0], bestCount = -1;
      for (const k in counts) if (counts[k] > bestCount) { best = k; bestCount = counts[k]; }
      return { value: best, counts, n: ys.length };
    } else {
      const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
      return { value: mean, n: ys.length };
    }
  }

  function buildTree(rows, depth, maxDepth, allFeatures, importanceAcc) {
    const ys = rows.map(r => r.__y);
    const pureEnough = problemType === 'classification'
      ? new Set(ys).size === 1
      : mse(ys) < 1e-9;

    if (depth >= maxDepth || rows.length < 2 || pureEnough) {
      return { isLeaf: true, ...leafValue(rows) };
    }

    const candidates = pickRandomFeatures(allFeatures);
    const split = bestSplit(rows, candidates);
    if (!split || split.gain <= 1e-12) {
      return { isLeaf: true, ...leafValue(rows) };
    }

    importanceAcc[split.feature] = (importanceAcc[split.feature] || 0) + split.gain * rows.length;

    const node = {
      isLeaf: false,
      feature: split.feature,
      isNumeric: split.isNumeric,
      threshold: split.isNumeric ? split.threshold : undefined,
      category: split.isNumeric ? undefined : split.category,
      n: rows.length
    };
    node.left = buildTree(split.left, depth + 1, maxDepth, allFeatures, importanceAcc);
    node.right = buildTree(split.right, depth + 1, maxDepth, allFeatures, importanceAcc);
    return node;
  }

  function predictTree(node, sample) {
    if (node.isLeaf) return node.value;
    const v = sample[node.feature];
    let goLeft;
    if (node.isNumeric) goLeft = v <= node.threshold;
    else goLeft = v === node.category;
    return predictTree(goLeft ? node.left : node.right, sample);
  }

  function coerceRow(rawRow, features) {
    const out = {};
    features.forEach(f => {
      const t = featureTypes[f];
      out[f] = t === 'numeric' ? parseFloat(rawRow[f]) : rawRow[f];
    });
    return out;
  }

  function train({ rows, features, target, types, nTrees, maxDepth }) {
    if (rows.length < 4) throw new Error('Necesitas al menos 4 filas de datos limpios para entrenar.');
    featureNames = features;
    featureTypes = types;
    targetName = target.name;
    problemType = target.problemType;

    const prepared = rows.map(r => {
      const obj = coerceRow(r, features);
      obj.__y = problemType === 'classification' ? r[target.name] : parseFloat(r[target.name]);
      return obj;
    });

    if (problemType === 'classification') {
      classes = [...new Set(prepared.map(r => r.__y))];
    }

    trees = [];
    const importanceAcc = {};
    for (let t = 0; t < nTrees; t++) {
      const sample = sampleWithReplacement(prepared);
      const tree = buildTree(sample, 0, maxDepth, features, importanceAcc);
      trees.push(tree);
    }

    // normaliza importancias
    const totalImp = Object.values(importanceAcc).reduce((a, b) => a + b, 0) || 1;
    lastImportance = {};
    features.forEach(f => { lastImportance[f] = (importanceAcc[f] || 0) / totalImp; });

    trainedMeta = { nTrees, maxDepth, nRows: rows.length };

    // métricas: evaluación in-sample (OOB simplificado se omite por simplicidad/peso)
    return evaluate(prepared);
  }

  function evaluate(preparedRows) {
    if (problemType === 'classification') {
      let correct = 0;
      preparedRows.forEach(r => {
        const pred = predictRaw(r);
        if (pred.value === r.__y) correct++;
      });
      return { accuracy: correct / preparedRows.length };
    } else {
      let sse = 0, sst = 0;
      const mean = preparedRows.reduce((a, r) => a + r.__y, 0) / preparedRows.length;
      preparedRows.forEach(r => {
        const pred = predictRaw(r);
        sse += (r.__y - pred.value) ** 2;
        sst += (r.__y - mean) ** 2;
      });
      const rmse = Math.sqrt(sse / preparedRows.length);
      const r2 = sst > 0 ? 1 - sse / sst : 0;
      return { rmse, r2 };
    }
  }

  function predictRaw(sample) {
    const preds = trees.map(t => predictTree(t, sample));
    if (problemType === 'classification') {
      const counts = {};
      preds.forEach(p => counts[p] = (counts[p] || 0) + 1);
      let best = preds[0], bestCount = -1;
      for (const k in counts) if (counts[k] > bestCount) { best = k; bestCount = counts[k]; }
      const confidence = bestCount / preds.length;
      return { value: best, confidence, votes: counts };
    } else {
      const mean = preds.reduce((a, b) => a + b, 0) / preds.length;
      return { value: mean };
    }
  }

  function predict(rawSample) {
    const sample = coerceRow(rawSample, featureNames);
    return predictRaw(sample);
  }

  function getTrees() { return trees; }
  function getImportance() { return lastImportance; }
  function getMeta() { return trainedMeta; }
  function getProblemType() { return problemType; }
  function getClasses() { return classes; }
  function isTrained() { return trees.length > 0; }

  return { train, predict, getTrees, getImportance, getMeta, getProblemType, getClasses, isTrained };
})();
