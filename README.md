# Laboratorio Espectral: Síntesis de Fourier y Timbre Instrumental

Un entorno interactivo para explorar la acústica física, la síntesis aditiva y la psicoacústica del sonido directamente en el navegador. 

Este proyecto permite visualizar y escuchar en tiempo real cómo la superposición de armónicos simples da lugar a la complejidad del timbre, desde ondas geométricas puras hasta la emulación espectral de instrumentos acústicos como el violín, el clarinete o la trompeta.

---

## Finalidad del proyecto

En acústica y teoría de señales, el teorema de Fourier establece que cualquier onda periódica compleja puede descomponerse en una suma de ondas senoidales puras (la frecuencia fundamental $f_0$ y sus armónicos múltiplos enteros $n \cdot f_0$). De igual forma, al sumar estas senoides individuales podemos construir cualquier timbre: esto es la **síntesis aditiva**.

El objetivo de esta aplicación es hacer tangible ese puente entre las matemáticas y la percepción auditiva:
- ¿Por qué un clarinete suena "hueco" o "amaderado" en comparación con un violín?
- ¿Qué ocurre en la forma de onda cuando invertimos la fase de ciertos armónicos?
- ¿Cómo se manifiesta el fenómeno de Gibbs en los saltos abruptos de una onda cuadrada o diente de sierra?
- ¿Qué relación guardan el centroide espectral y la distorsión armónica total (THD) con el brillo que percibe nuestro oído?

---

## Características principales

### 1. Osciloscopio y analizador de doble dominio sincronizado
- **Dominio del tiempo (arriba):** Muestra la onda resultante $x(t)$ renderizada a 60 FPS con estética de monitor de fósforo CRT. Permite alternar entre un modo de flujo continuo y una vista de periodo estático ($T_0$), además de descomponer visualmente cada uno de los armónicos constituyentes en colores individuales.
- **Dominio de la frecuencia (abajo):** Un banco interactivo de 8 barras espectrales ($A_1$ a $A_8$). Puedes hacer clic y arrastrar verticalmente sobre el propio lienzo para subir o bajar la amplitud de cada armónico de forma intuitiva, así como alternar la polaridad de fase ($+$ / $-$).

### 2. Motor de audio DSP (Web Audio API)
- Síntesis basada en `PeriodicWave` nativo con buffers `Float32Array`, garantizando alta fidelidad acústica sin sobrecargar la CPU.
- Dos modos de reproducción:
  - **Dron Continuo:** Mantiene un tono constante para analizar cambios armónicos en tiempo real.
  - **Teclado Virtual con Envolvente (ADSR):** Permite tocar notas musicales individuales mediante clics o atajos de teclado físico, con perfiles seleccionables de tipo sostenido (cuerda frotada/viento) o percusivo/pluck (cuerda pulsada).
- Control de ganancia con curvas exponenciales anti-clic para evitar chasquidos en transiciones bruscas.

### 3. Telemetría matemática y psicoacústica
Calcula de manera instantánea:
- **Ecuación de Fourier en tiempo real:** Representación de la función matemática y su fórmula equivalente lista para copiar en formato LaTeX.
- **Distribución de energía:** Proporción de energía concentrada en la fundamental frente al conjunto de armónicos superiores.
- **THD (Distorsión Armónica Total):** Porcentaje de desviación respecto a una senoide pura.
- **Balance par/impar:** Detección de resonadores cerrados (predominio impar) o distribuciones simétricas.
- **Centroide espectral y caracterización tímbrica:** Estimación del brillo aparente y clasificación cualitativa del sonido.

### 4. Presets instrumentales y formas de onda clásicas
Incluye configuraciones predefinidas con interpolación suave de parámetros:
- **Senoidal Pura:** Solo $A_1 = 1.0$, referencia básica sin sobretonos.
- **Flauta Traversa:** Caída espectral pronunciada propia de tubos abiertos.
- **Clarinete:** Predominio casi exclusivo de armónicos impares ($1, 3, 5, 7$), característico de un tubo cilíndrico cerrado en un extremo.
- **Violín:** Distribución progresiva de armónicos pares e impares ($1/n$), correspondiente a la física de la cuerda frotada (movimiento Helmholtz).
- **Trompeta / Cobre:** Formante brillante donde los armónicos medios ($A_2, A_3$) superan a la fundamental.
- **Onda Cuadrada Teórica:** Suma de impares decrecientes ($1/n$).
- **Onda Diente de Sierra:** Serie completa alternada que exhibe el clásico rizado y sobreimpulso del fenómeno de Gibbs.

---

## Cómo usar el teclado físico

Cuando el modo teclado está activo (o mientras exploras el teclado virtual), puedes usar las siguientes teclas de tu computadora para tocar notas:

| Nota musical | Tecla del computador | Frecuencia aproximada |
| :--- | :---: | :--- |
| La3 (A3) | **A** | 220 Hz |
| La#3 / Sib3 | **W** | 233 Hz |
| Si3 (B3) | **S** | 247 Hz |
| Do4 (C4) | **D** | 262 Hz |
| Do#4 / Reb4 | **E** | 277 Hz |
| Re4 (D4) | **F** | 294 Hz |
| Re#4 / Mib4 | **T** | 311 Hz |
| Mi4 (E4) | **G** | 330 Hz |
| Fa4 (F4) | **H** | 349 Hz |
| Fa#4 / Solb4 | **U** | 370 Hz |
| Sol4 (G4) | **J** | 392 Hz |
| Sol#4 / Lab4 | **I** | 415 Hz |
| La4 (A4) | **K** | 440 Hz |
| La#4 / Sib4 | **O** | 466 Hz |
| Si4 (B4) | **L** | 494 Hz |
| Do5 (C5) | **Ñ** | 523 Hz |

---

## Tecnologías utilizadas

- **Lenguaje:** TypeScript (código modular y tipado estricto).
- **Audio:** Web Audio API (`AudioContext`, `PeriodicWave`, `OscillatorNode`, `GainNode`, `AnalyserNode`).
- **Renderizado visual:** Canvas 2D API nativo optimizado con soporte para pantallas Hi-DPI / Retina.
- **Empaquetador y entorno:** [Vite](https://vitejs.dev/).
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/) configurado con paleta oscura técnica y tipografías monoespaciadas (`JetBrains Mono` e `Inter`).

---

## Requisitos previos

Para ejecutar este proyecto de forma local necesitas tener instalado en tu computadora:
- **Node.js:** Versión 18.0 o superior recomendada ([Descargar Node.js](https://nodejs.org/)).
- **npm:** Gestor de paquetes incluido automáticamente con Node.js.
- Un navegador moderno con soporte para Web Audio API (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari o Brave).

---

## Instalación y ejecución paso a paso

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/TU_USUARIO/laboratorio-espectral-fourier.git
   cd laboratorio-espectral-fourier
   ```

2. **Instalar las dependencias del proyecto:**
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

4. **Abrir en tu navegador:**
   La terminal te indicará una dirección local, usualmente:
   ```
   http://localhost:5173/
   ```
   Abre esa URL en tu navegador web.

5. **Activar el sonido:**
   Los navegadores modernos bloquean la reproducción de audio hasta que el usuario interactúa con la página. Haz clic en el botón superior **"INICIAR MOTOR DSP / DRON"** o toca cualquier tecla del teclado virtual para inicializar el motor de audio.

---

## Scripts disponibles

En el archivo `package.json` dispones de los siguientes comandos:

- `npm run dev`: Levanta el servidor local con recarga rápida en vivo (HMR).
- `npm run build`: Compila el código TypeScript y empaqueta la aplicación en la carpeta `dist/` para producción.
- `npm run preview`: Permite previsualizar localmente la versión de producción generada en `dist/`.

---

## Estructura del código

```
├── index.html                   # Interfaz de usuario estructurada en Tailwind CSS
├── package.json                 # Dependencias y scripts de Vite y TypeScript
├── tailwind.config.js           # Definición de colores del laboratorio y fuentes
├── tsconfig.json                # Configuración de compilación TypeScript
└── src/
    ├── main.ts                  # Punto de entrada principal e integración
    ├── style.css                # Estilos base, barras deslizantes y efectos CRT
    ├── audio/
    │   └── FourierSynthEngine.ts# Motor de síntesis aditiva y control de envolventes
    ├── graphics/
    │   └── SpectrumRenderer.ts  # Renderizado en Canvas del osciloscopio y barras espectrales
    └── ui/
        ├── Controls.ts          # Gestión de eventos, faders, teclado virtual y atajos
        └── PresetManager.ts     # Definición de instrumentos y cálculo de telemetría acústica
```

---

## Licencia

Este proyecto está disponible para fines educativos y de divulgación científica. Puedes modificarlo, extenderlo y utilizarlo libremente.
