/* =========================================================
   neuralnet.js
   Perceptrón multicapa (1 capa oculta) entrenado con
   descenso de gradiente / backpropagation, desde cero.
   Soporta clasificación (softmax + cross-entropy) y
   regresión (lineal + MSE).
   ========================================================= */

const NeuralModel = (() => {
  let W1, b1, W2, b2;
  let featureNames = [];
  let featureTypes = {};
  let targetName = '';
  let problemType = 'classification';
  let classes = [];
  // normalización
  let featStats = {}; // name -> {mean, std} (numeric) | {map} (categorical one-hot index)
  let catMaps = {};   // name -> {value: index}
  let inputDim = 0;
  let hiddenSize = 8;
  let lossHistory = [];
  let yMean = 0, yStd = 1; // para regresión

  function randMatrix(rows, cols, scale) {
    const m = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) row.push((Math.random() * 2 - 1) * scale);
      m.push(row);
    }
    return m;
  }

  function zeros(n) { return new Array(n).fill(0); }

  function relu(x) { return x > 0 ? x : 0; }
  function reluDeriv(x) { return x > 0 ? 1 : 0; }

  function softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map(v => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(v => v / sum);
  }

  // Construye el vector de entrada normalizado para una fila cruda
  function buildInputVector(rawRow) {
    const vec = [];
    featureNames.forEach(f => {
      if (featureTypes[f] === 'numeric') {
        const v = parseFloat(rawRow[f]);
        const { mean, std } = featStats[f];
        vec.push(std > 0 ? (v - mean) / std : 0);
      } else {
        const map = catMaps[f];
        const oneHot = new Array(Object.keys(map).length).fill(0);
        const idx = map[rawRow[f]];
        if (idx !== undefined) oneHot[idx] = 1;
        vec.push(...oneHot);
      }
    });
    return vec;
  }

  function computeStats(rows, features, types) {
    featStats = {};
    catMaps = {};
    features.forEach(f => {
      if (types[f] === 'numeric') {
        const vals = rows.map(r => parseFloat(r[f]));
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
        featStats[f] = { mean, std: Math.sqrt(variance) || 1 };
      } else {
        const uniq = [...new Set(rows.map(r => r[f]))];
        const map = {};
        uniq.forEach((v, i) => map[v] = i);
        catMaps[f] = map;
      }
    });
  }

  function forward(x) {
    // capa oculta
    const z1 = new Array(hiddenSize).fill(0);
    for (let j = 0; j < hiddenSize; j++) {
      let s = b1[j];
      for (let i = 0; i < x.length; i++) s += x[i] * W1[i][j];
      z1[j] = s;
    }
    const a1 = z1.map(relu);

    // capa salida
    const outDim = problemType === 'classification' ? classes.length : 1;
    const z2 = new Array(outDim).fill(0);
    for (let k = 0; k < outDim; k++) {
      let s = b2[k];
      for (let j = 0; j < hiddenSize; j++) s += a1[j] * W2[j][k];
      z2[k] = s;
    }
    let a2;
    if (problemType === 'classification') a2 = softmax(z2);
    else a2 = z2; // lineal

    return { x, z1, a1, z2, a2 };
  }

  function train({ rows, features, target, types, hiddenUnits, epochs, lr, onEpoch }) {
    if (rows.length < 4) throw new Error('Necesitas al menos 4 filas de datos limpios para entrenar.');
    featureNames = features;
    featureTypes = types;
    targetName = target.name;
    problemType = target.problemType;
    hiddenSize = hiddenUnits;

    computeStats(rows, features, types);

    if (problemType === 'classification') {
      classes = [...new Set(rows.map(r => r[target.name]))];
    } else {
      const yvals = rows.map(r => parseFloat(r[target.name]));
      yMean = yvals.reduce((a, b) => a + b, 0) / yvals.length;
      const variance = yvals.reduce((a, b) => a + (b - yMean) ** 2, 0) / yvals.length;
      yStd = Math.sqrt(variance) || 1;
    }

    // dimensión de entrada (suma de numéricas=1 y categóricas=nº categorías)
    inputDim = features.reduce((acc, f) => {
      return acc + (types[f] === 'numeric' ? 1 : Object.keys(catMaps[f]).length);
    }, 0);

    const outDim = problemType === 'classification' ? classes.length : 1;
    const scale1 = Math.sqrt(2 / inputDim);
    const scale2 = Math.sqrt(2 / hiddenSize);
    W1 = randMatrix(inputDim, hiddenSize, scale1);
    b1 = zeros(hiddenSize);
    W2 = randMatrix(hiddenSize, outDim, scale2);
    b2 = zeros(outDim);

    const dataset = rows.map(r => {
      const x = buildInputVector(r);
      let y;
      if (problemType === 'classification') {
        y = new Array(classes.length).fill(0);
        y[classes.indexOf(r[target.name])] = 1;
      } else {
        y = [(parseFloat(r[target.name]) - yMean) / yStd];
      }
      return { x, y };
    });

    lossHistory = [];

    for (let epoch = 0; epoch < epochs; epoch++) {
      // shuffle
      const shuffled = [...dataset].sort(() => Math.random() - 0.5);
      let epochLoss = 0;

      shuffled.forEach(({ x, y }) => {
        const { z1, a1, a2 } = forward(x);

        // pérdida
        if (problemType === 'classification') {
          epochLoss += -y.reduce((s, yi, i) => s + yi * Math.log(Math.max(a2[i], 1e-9)), 0);
        } else {
          epochLoss += 0.5 * (a2[0] - y[0]) ** 2;
        }

        // --- backprop ---
        const outDim2 = a2.length;
        // dL/dz2
        const dz2 = new Array(outDim2);
        if (problemType === 'classification') {
          for (let k = 0; k < outDim2; k++) dz2[k] = a2[k] - y[k];
        } else {
          dz2[0] = (a2[0] - y[0]);
        }

        // gradientes W2, b2
        const dW2 = randMatrix(hiddenSize, outDim2, 0).map(r => r.map(() => 0));
        for (let j = 0; j < hiddenSize; j++) {
          for (let k = 0; k < outDim2; k++) {
            dW2[j][k] = a1[j] * dz2[k];
          }
        }
        const db2 = dz2.slice();

        // dL/da1
        const da1 = new Array(hiddenSize).fill(0);
        for (let j = 0; j < hiddenSize; j++) {
          let s = 0;
          for (let k = 0; k < outDim2; k++) s += W2[j][k] * dz2[k];
          da1[j] = s;
        }
        const dz1 = da1.map((v, j) => v * reluDeriv(z1[j]));

        const dW1 = [];
        for (let i = 0; i < inputDim; i++) {
          const row = new Array(hiddenSize);
          for (let j = 0; j < hiddenSize; j++) row[j] = x[i] * dz1[j];
          dW1.push(row);
        }
        const db1 = dz1.slice();

        // update
        for (let j = 0; j < hiddenSize; j++) {
          for (let k = 0; k < outDim2; k++) W2[j][k] -= lr * dW2[j][k];
        }
        for (let k = 0; k < outDim2; k++) b2[k] -= lr * db2[k];
        for (let i = 0; i < inputDim; i++) {
          for (let j = 0; j < hiddenSize; j++) W1[i][j] -= lr * dW1[i][j];
        }
        for (let j = 0; j < hiddenSize; j++) b1[j] -= lr * db1[j];
      });

      const avgLoss = epochLoss / shuffled.length;
      lossHistory.push(avgLoss);
      if (onEpoch && epoch % Math.max(1, Math.floor(epochs / 30)) === 0) {
        onEpoch(epoch, avgLoss);
      }
    }

    return evaluate(dataset);
  }

  function evaluate(dataset) {
    if (problemType === 'classification') {
      let correct = 0;
      dataset.forEach(({ x, y }) => {
        const { a2 } = forward(x);
        const predIdx = a2.indexOf(Math.max(...a2));
        const trueIdx = y.indexOf(1);
        if (predIdx === trueIdx) correct++;
      });
      return { accuracy: correct / dataset.length };
    } else {
      let sse = 0, sst = 0;
      const meanY = 0; // y ya normalizada con media 0 en espacio estándar
      const trueYs = dataset.map(d => d.y[0]);
      const meanTrueY = trueYs.reduce((a, b) => a + b, 0) / trueYs.length;
      dataset.forEach(({ x, y }) => {
        const { a2 } = forward(x);
        sse += (a2[0] - y[0]) ** 2;
        sst += (y[0] - meanTrueY) ** 2;
      });
      const rmseNorm = Math.sqrt(sse / dataset.length);
      const rmse = rmseNorm * yStd; // des-normalizado aprox
      const r2 = sst > 0 ? 1 - sse / sst : 0;
      return { rmse, r2 };
    }
  }

  function predict(rawRow) {
    const x = buildInputVector(rawRow);
    const { a2 } = forward(x);
    if (problemType === 'classification') {
      const idx = a2.indexOf(Math.max(...a2));
      return { value: classes[idx], confidence: a2[idx], probs: classes.map((c, i) => [c, a2[i]]) };
    } else {
      return { value: a2[0] * yStd + yMean };
    }
  }

  function getLossHistory() { return lossHistory; }
  function getMeta() { return { hiddenSize, inputDim, outDim: problemType === 'classification' ? classes.length : 1 }; }
  function getProblemType() { return problemType; }
  function getClasses() { return classes; }
  function isTrained() { return !!W1; }

  return { train, predict, getLossHistory, getMeta, getProblemType, getClasses, isTrained };
})();
