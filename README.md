# Panel ML — Random Forest & Red Neuronal

Dashboard web para entrenar y probar dos modelos de Machine Learning con tus propios datos históricos, **directamente en el navegador** (sin backend, sin servidor de Python, sin instalar nada).

- 🌲 **Random Forest** — bosque de árboles de decisión (clasificación y regresión)
- 🧠 **Red Neuronal** — perceptrón multicapa entrenado con descenso de gradiente (clasificación y regresión)

Carga datos por **CSV** o agrégalos **fila por fila** desde un formulario. Define cualquier conjunto de columnas: el dashboard es elástico, no está atado a un dataset fijo.

---

## Cómo usarlo

1. Abre `index.html` (o el sitio publicado).
2. Ve a **Conjunto de datos**:
   - Sube un `.csv` (primera fila = nombres de columna), o
   - Crea columnas manualmente y agrega filas con el formulario, o
   - Usa los botones de ejemplo (clima→lluvia, casas→precio) para probar rápido.
3. Marca cuál columna es el **objetivo** (lo que quieres predecir). Las demás se usan como variables.
4. Ve a **Random Forest** o **Red Neuronal**, ajusta los parámetros si quieres, y dale **Entrenar**.
5. Baja a **Predicción al momento**, llena los valores nuevos y dale **Predecir**.

El tipo de problema (clasificación vs. regresión) se detecta automáticamente según los datos del objetivo: texto o pocos valores repetidos → clasificación; números continuos → regresión.

Todo el cálculo ocurre en tu navegador. Ningún dato se sube a ningún servidor.

---

## Estructura del proyecto

```
├── index.html          # estructura del dashboard
├── css/styles.css       # estilos
├── js/
│   ├── store.js         # estado del dataset (columnas, filas, CSV parser)
│   ├── forest.js        # Random Forest implementado desde cero (CART + bagging)
│   ├── neuralnet.js      # Red neuronal (MLP) implementada desde cero (backprop)
│   └── ui.js             # conecta todo con el DOM
└── assets/
```

Sin dependencias externas, sin `npm install`. Es HTML/CSS/JS puro.

---

## Desplegar en GitHub Pages

1. Sube esta carpeta a un repositorio de GitHub.
2. Ve a **Settings → Pages**.
3. En "Source", elige la rama (ej. `main`) y la carpeta raíz (`/`).
4. Guarda. En un par de minutos tu sitio estará en `https://tu-usuario.github.io/tu-repo/`.

## Desplegar en Render

1. Sube el proyecto a GitHub.
2. En Render, crea un **New → Static Site**.
3. Conecta el repositorio.
4. Build command: (vacío, no hace falta)
5. Publish directory: `.` (la raíz del proyecto)
6. Deploy.

También puedes usar el `render.yaml` incluido para que Render detecte la configuración automáticamente.

---

## Notas técnicas

- Las métricas mostradas (exactitud, RMSE, R²) son **in-sample** (evaluadas sobre los mismos datos de entrenamiento), pensado para un dashboard simple y educativo, no para validación rigurosa con datos de prueba separados.
- El Random Forest usa muestreo con reemplazo (bagging) y selección aleatoria de variables por división (~√n features), igual que la técnica clásica.
- La red neuronal tiene una sola capa oculta configurable, usa ReLU + softmax (clasificación) o salida lineal (regresión), y se entrena con descenso de gradiente estocástico.
- Con datasets muy pequeños (menos de ~10 filas) los modelos pueden sobreajustar fácilmente — es normal ver 100% de exactitud en esos casos.
