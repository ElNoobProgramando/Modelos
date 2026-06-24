/* =========================================================
   linreg.js
   Regresión Lineal Múltiple implementada desde cero:
   - Gradiente descendente estocástico por mini-batches
   - Normalización automática de features (z-score)
   - One-hot encoding de variables categóricas
   - Solo soporta regresión (output numérico)
   - Devuelve coeficientes, R², RMSE, ecuación legible
   ========================================================= */

const LinRegModel = (() => {
  let weights = [];   // [w0(bias), w1, w2, ...]
  let featureNames = [];
  let featureTypes = {};
  let targetName = '';
  let catMaps = {};   // name -> { value: index }
  let featStats = {}; // name -> { mean, std }
  let yMean = 0, yStd = 1;
  let inputDim = 0;
  let lossHistory = [];
  let coefficientLabels = []; // nombres legibles para cada peso (incluye one-hot)

  function computeStats(rows, features, types) {
    featStats = {};
    catMaps = {};
    features.forEach(f => {
      if (types[f] === 'numeric') {
        const vals = rows.map(r => parseFloat(r[f]));
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
        featStats[f] = { mean, std };
      } else {
        const uniq = [...new Set(rows.map(r => r[f]))].sort();
        const map = {};
        uniq.forEach((v, i) => { map[v] = i; });
        catMaps[f] = map;
      }
    });
  }

  function buildInputVector(rawRow) {
    const vec = [1]; // bias
    featureNames.forEach(f => {
      if (featureTypes[f] === 'numeric') {
        const v = parseFloat(rawRow[f]);
        const { mean, std } = featStats[f];
        vec.push((v - mean) / std);
      } else {
        const map = catMaps[f];
        const n = Object.keys(map).length;
        const oneHot = new Array(n).fill(0);
        const idx = map[rawRow[f]];
        if (idx !== undefined) oneHot[idx] = 1;
        vec.push(...oneHot);
      }
    });
    return vec;
  }

  function buildCoefficientLabels(features, types) {
    const labels = ['(intercepto)'];
    features.forEach(f => {
      if (types[f] === 'numeric') {
        labels.push(f);
      } else {
        const map = catMaps[f];
        Object.keys(map).sort().forEach(v => labels.push(`${f}=${v}`));
      }
    });
    return labels;
  }

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function train({ rows, features, target, types, epochs, lr, batchSize }) {
    if (rows.length < 3) throw new Error('Necesitas al menos 3 filas de datos limpios para entrenar.');

    featureNames = features;
    featureTypes = types;
    targetName = target.name;

    // Estadísticas de normalización
    computeStats(rows, features, types);

    // Normalización del target
    const yVals = rows.map(r => parseFloat(r[target.name]));
    yMean = yVals.reduce((a, b) => a + b, 0) / yVals.length;
    yStd = Math.sqrt(yVals.reduce((a, b) => a + (b - yMean) ** 2, 0) / yVals.length) || 1;

    // Dimensión de entrada (1 bias + features expandidas)
    const sampleVec = buildInputVector(rows[0]);
    inputDim = sampleVec.length;

    // Inicializar pesos en cero (regresión lineal converge bien desde 0)
    weights = new Array(inputDim).fill(0);
    coefficientLabels = buildCoefficientLabels(features, types);

    // Preparar dataset normalizado
    const dataset = rows.map(r => ({
      x: buildInputVector(r),
      y: (parseFloat(r[target.name]) - yMean) / yStd
    }));

    lossHistory = [];
    const bs = Math.max(1, Math.min(batchSize || 16, dataset.length));

    for (let epoch = 0; epoch < epochs; epoch++) {
      // shuffle
      const shuffled = [...dataset].sort(() => Math.random() - 0.5);
      let epochLoss = 0;

      for (let i = 0; i < shuffled.length; i += bs) {
        const batch = shuffled.slice(i, i + bs);
        const grads = new Array(inputDim).fill(0);

        batch.forEach(({ x, y }) => {
          const pred = dot(weights, x);
          const err = pred - y;
          epochLoss += err * err;
          for (let j = 0; j < inputDim; j++) {
            grads[j] += (2 / batch.length) * err * x[j];
          }
        });

        for (let j = 0; j < inputDim; j++) {
          weights[j] -= lr * (grads[j] / batch.length);
        }
      }

      lossHistory.push(epochLoss / shuffled.length);
    }

    return evaluate(dataset);
  }

  function evaluate(dataset) {
    const ys = dataset.map(d => d.y);
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sse = 0, sst = 0;

    dataset.forEach(({ x, y }) => {
      const pred = dot(weights, x);
      sse += (pred - y) ** 2;
      sst += (y - meanY) ** 2;
    });

    const rmse = Math.sqrt(sse / dataset.length) * yStd;
    const r2 = sst > 0 ? 1 - sse / sst : 0;
    return { rmse, r2 };
  }

  function predict(rawRow) {
    const x = buildInputVector(rawRow);
    const predNorm = dot(weights, x);
    return { value: predNorm * yStd + yMean };
  }

  // Devuelve coeficientes "des-normalizados" para mostrar la ecuación
  function getEquation() {
    if (!weights.length) return null;

    // Des-normalizar: y_real = (w·x_norm)*yStd + yMean
    // Para el intercepto: w[0]*yStd + yMean (ajustando los demás)
    const coeffs = [];
    // Intercepto ajustado: w0*yStd + yMean - sum(wi * mean_i / std_i * yStd)
    let intercept = weights[0] * yStd + yMean;
    let wIdx = 1;
    featureNames.forEach(f => {
      if (featureTypes[f] === 'numeric') {
        const { mean, std } = featStats[f];
        const coeff = weights[wIdx] * yStd / std;
        intercept -= coeff * mean;
        coeffs.push({ name: f, coeff });
        wIdx++;
      } else {
        const map = catMaps[f];
        Object.keys(map).sort().forEach(() => { wIdx++; }); // one-hot no se des-normaliza fácil
      }
    });

    return { intercept, coeffs };
  }

  function getCoefficients() {
    return weights.map((w, i) => ({
      label: coefficientLabels[i] || `w${i}`,
      weightNorm: w,
      weightReal: i === 0 ? w * yStd + yMean : w * yStd
    }));
  }

  function getLossHistory() { return lossHistory; }
  function isTrained() { return weights.length > 0; }
  function getProblemType() { return 'regression'; }

  return { train, predict, getLossHistory, getEquation, getCoefficients, isTrained, getProblemType };
})();
