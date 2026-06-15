// @ts-check

import {RegistrosLCD} from '../memoria/registros/registros_lcd.js';
import {Interrupciones} from '../cpu/interrupciones.js';
import {
    GB_PANTALLA_ANCHO,
    GB_PANTALLA_ALTO,

    LCDSTAT_INT,
    VBLANK_INT
} from '../constantes.js';

// Paletas configurables
/** @type {Record<string, Array<[number, number, number, number]>>} */
export const PALETAS_LCD = {
    verde: [
        [226, 246, 171, 255],
        [157, 191, 91, 255],
        [82, 118, 54, 255],
        [25, 46, 32, 255]
    ],
    bolsillo: [
        [242, 239, 222, 255],
        [177, 174, 159, 255],
        [96, 96, 90, 255],
        [20, 22, 24, 255]
    ],
    gris: [
        [255, 255, 255, 255],
        [150, 150, 150, 255],
        [90, 90, 90, 255],
        [0, 0, 0, 255]
    ],
    azul: [
        [230, 248, 255, 255],
        [124, 195, 213, 255],
        [52, 103, 139, 255],
        [15, 31, 56, 255]
    ],
    ambar: [
        [255, 242, 177, 255],
        [226, 166, 73, 255],
        [139, 83, 37, 255],
        [45, 30, 24, 255]
    ]
};

/**
 * Emula la pantalla de la Gameboy
 */
export class Pantalla{

    /**
     * Constructor de Pantalla
     * @param {RegistrosLCD} regLCD Registros de PPU
     * @param {Interrupciones} ints Interrupciones
     * @param {Object} estado Estado, no implementado aún
     */
    constructor(regLCD, ints, estado){

        // Si existe un archivo de estado se cargan los datos de este
        this.modo = 2;
        this.dots = 0;
        this.linea = 0; // Contador de linea
        this.lineaVentana = 0; // Contador interno de linea de ventana
        this.ventanaVisible = false; // Condicion si la ventana ha sido visible en una linea
    

        // Detectar endianness una vez
        this._littleEndian = new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;


        if(estado) this.cargarEstado(estado); 
        this.regLCD = regLCD;
        this.ints = ints;

        this.escala = 1;

        this.terminada = false;
        this.scrollXLinea = 0;
        this.scrollYLinea = 0;
        this.windowXLinea = 0;
        this.windowYLinea = 0;
        this.duracionModo3 = 172;
        this.duracionModo0 = 204;
        this.BGTileMapAreaLinea = false;
        this.BGWindowTileDataAreaLinea = false;
        this._statLYCPrev = false;
        this.lcdEnableAnterior = this.regLCD.LCDEnable;
        this.debugColorearCapas = false; // Poner a false para volver al render normal
        this._debugColorCapas32 = null;
        this.paletaLCD = "verde";
        this.valorColor = PALETAS_LCD.verde;
        this.valorColor32 = null;
        this.ghostingLCD = 0.35;

        this.canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameboy-canvas"));
        this.contexto = this.canvas.getContext("2d", { alpha: false });
        this.lcd = this.contexto 
            ? this.contexto.createImageData(160, 144) : null; // Datos de los pixeles del lcd
        this.lcdSalida = this.contexto ? 
            this.contexto.createImageData(160, 144) : null; // Salida real del canvas
        this.lcdFantasma = this.lcd ? 
            new Uint8ClampedArray(this.lcd.data.length) : null; // Datos del efecto de ghosting
        this.lcdFantasmaInicializado = false;

        this._lcd32 = this.lcd ? new Uint32Array(this.lcd.data.buffer) : null;
        this._bgIdx = new Uint8Array(GB_PANTALLA_ANCHO);
        this._mask8 = new Uint8Array([0x80,0x40,0x20,0x10,0x08,0x04,0x02,0x01]);

        // Canvas trasero para escalado
        this.backCanvas = document.createElement("canvas");
        this.backCanvas.width  = 160;
        this.backCanvas.height = 144;
        this.backCtx = this.backCanvas.getContext("2d", { willReadFrequently: true });

        this.canvas.width  = 160 * this.escala;
        this.canvas.height = 144 * this.escala;
        if (this.contexto) {
            this.contexto.imageSmoothingEnabled = false;
        }

        this.actualizarCondicionWYInicioModo2();
    }

    /**
     * Captura los registros de posicion usados para renderizar la linea actual.
     * Los juegos pueden escribir SCX/SCY/WX/WY durante HBlank para preparar la
     * siguiente scanline; no debe cambiar retroactivamente una linea ya activa.
     */
    capturarScrollLinea(){
        this.scrollXLinea = this.regLCD.scrollX & 0xFF;
        this.scrollYLinea = this.regLCD.scrollY & 0xFF;
        this.windowXLinea = this.regLCD.windowX & 0xFF;
        this.windowYLinea = this.regLCD.windowY & 0xFF;
        this.BGTileMapAreaLinea = this.regLCD.BGTileMapArea;
        this.BGWindowTileDataAreaLinea = this.regLCD.BGWindowTileDataArea;
    }

    /**
     * Actualiza el flag LYC=LY. Se comprueba de forma continua porque una ROM
     * puede escribir LYC durante HBlank/ISR para programar la siguiente linea.
     */
    actualizarCoincidenciaLYC(){
        const match = this.regLCD.lineaY === this.regLCD.lineaYComparar;
        this.regLCD.LYCLYFlag = match;
        if(match && !this._statLYCPrev && this.regLCD.interrupcionEstadoEnLYCLY){
            this.ints.regs.flagsInterrupcion[LCDSTAT_INT] = true;
        }
        this._statLYCPrev = match;
    }

    /**
     * Comprueba la condición WY al inicio de Mode 2, que es cuando el hardware
     * decide si la ventana puede empezar a aparecer durante este frame.
     */
    actualizarCondicionWYInicioModo2(){
        const reg = this.regLCD;

        // La comparación WY/LY ocurre al comienzo de la búsqueda OAM. Que la
        // ventana se dibuje después depende de LCDC.0/LCDC.5 y de WX.
        if(reg.lineaY === reg.windowY){
            reg.condicionWY = true;
        }
    }

    /**
     * Aproxima cuánto dura Mode 3 para esta scanline. Muchas demos sincronizan
     * escrituras raster con HBlank, así que no puede ser siempre 172 ciclos.
     */
    calcularDuracionModo3Linea(){
        let duracion = 172;

        // El descarte inicial por SCX fino retrasa el momento en que empieza
        // HBlank. Sin esto, las interrupciones HBlank llegan demasiado pronto.
        duracion += this.scrollXLinea & 7;

        // Al entrar en Window se vacía el FIFO y se reinicia el fetcher, lo que
        // alarga Mode 3 en las líneas donde la ventana se ve.
        if(this.ventanaVisible) duracion += 8;

        // Mantener un máximo razonable evita que una aproximación deje una
        // línea sin tiempo suficiente de HBlank.
        return Math.min(289, duracion);
    }

    /**
     * Determina si la ventana llega a verse en la scanline actual.
     */
    esVentanaVisibleEnLinea(){
        const reg = this.regLCD;
        const windowStart = ((this.windowXLinea|0) - 7) | 0;
        const windowActive = reg.BGWindowEnable && reg.windowEnable && reg.condicionWY;
        const winStartX = windowActive ? Math.min(GB_PANTALLA_ANCHO, Math.max(0, windowStart)) : GB_PANTALLA_ANCHO;

        return windowActive && winStartX < GB_PANTALLA_ANCHO;
    }

    /**
     * Empaqueta un color RGBA para poder escribirlo directamente en ImageData
     * usando la vista Uint32 del framebuffer.
     * @param {[number, number, number, number]} color
     * @returns {number}
     */
    empaquetarColor32(color){
        // En little-endian, escribir 0xAABBGGRR produce bytes [RR,GG,BB,AA].
        return this._littleEndian
            ? (((color[3] << 24) | (color[2] << 16) | (color[1] << 8) | color[0]) >>> 0)
            : (((color[0] << 24) | (color[1] << 16) | (color[2] << 8) | color[3]) >>> 0);
    }

    /**
     * Mezcla el color real con un tinte de capa. Así el debug muestra de qué
     * capa viene el pixel sin perder los tonos de gris del tile renderizado.
     * @param {[number, number, number, number]} color
     * @param {[number, number, number]} tinte
     * @returns {number}
     */
    mezclarColorDebugCapa32(color, tinte){
        const pesoGris = 0.65;
        const pesoTinte = 1 - pesoGris;
        return this.empaquetarColor32([
            Math.round((color[0] * pesoGris) + (tinte[0] * pesoTinte)),
            Math.round((color[1] * pesoGris) + (tinte[1] * pesoTinte)),
            Math.round((color[2] * pesoGris) + (tinte[2] * pesoTinte)),
            color[3]
        ]);
    }

    /**
     * Colores tintados para depurar qué capa ha escrito cada pixel visible.
     * Fondo = azul, ventana = verde, sprites = rojo, manteniendo grises.
     * @param {Array<[number, number, number, number]>} coloresRGBA
     */
    obtenerColoresDebugCapas32(coloresRGBA){
        if(!this._debugColorCapas32 || this._debugColorCapas32.coloresRGBA !== coloresRGBA){
            const fondo = new Uint32Array(coloresRGBA.length);
            const ventana = new Uint32Array(coloresRGBA.length);
            const sprite = new Uint32Array(coloresRGBA.length);

            for(let i=0; i<coloresRGBA.length; i++){
                fondo[i] = this.mezclarColorDebugCapa32(coloresRGBA[i], [40, 90, 255]);
                ventana[i] = this.mezclarColorDebugCapa32(coloresRGBA[i], [40, 220, 90]);
                sprite[i] = this.mezclarColorDebugCapa32(coloresRGBA[i], [255, 60, 60]);
            }

            this._debugColorCapas32 = {
                coloresRGBA,
                fondo,
                ventana,
                sprite
            };
        }

        return this._debugColorCapas32;
    }

    /**
     * @returns {Uint32Array}
     */
    obtenerColores32(){
        if(!this.valorColor32){
            const colores32 = new Uint32Array(this.valorColor.length);
            for(let i=0; i<this.valorColor.length; i++){
                colores32[i] = this.empaquetarColor32(this.valorColor[i]);
            }
            this.valorColor32 = colores32;
        }

        return this.valorColor32;
    }

    /**
     * Cambia la paleta visual usada para convertir los 4 tonos DMG a RGBA.
     * Por defecto es "verde".
     * @param {string} nombre Nombre de la paleta
     */ 
    cambiarPaletaLCD(nombre){
        const paleta = PALETAS_LCD[nombre] || PALETAS_LCD.verde;
        this.paletaLCD = PALETAS_LCD[nombre] ? nombre : "verde";
        this.valorColor = paleta;
        this.valorColor32 = null;
        this._debugColorCapas32 = null;
        this.lcdFantasmaInicializado = false;
    }

    /**
     * Ajusta los efectos visuales de la pantalla LCD.
     * @param {{ghosting?: number}} opciones
     */
    cambiarEfectosLCD(opciones){
        if(typeof opciones.ghosting === "number"){
            this.ghostingLCD = Math.max(0, Math.min(0.9, opciones.ghosting));
        }
    }

    /**
     * Carga el estado de la pantalla
     * @param {Object} estado 
     */
    cargarEstado(estado){
        /**
        var s = estado.pantalla;
        
        this.modo = s.modo;
        this.dots = s.dots;
        this.linea = s.linea; // Contador de linea
        this.lineaVentana = s.lineaVentana; // Contador interno de linea de ventana
        this.ventanaVisible = s.ventanaVisible; // Condicion si la ventana ha sido visible en una linea
        **/
    }

    /**
     * Dibuja una scanline completa en el framebuffer interno.
     * Se hace por línea porque la PPU de Game Boy permite que scroll, ventana
     * y sprites cambien entre scanlines, y esas reglas afectan pixel a pixel.
     */
    dibujarLinea(){
        const reg = this.regLCD;
        // WX se recalcula desde cero en cada scanline: solo debe quedar activo
        // si la ventana llega a cumplirse para la línea que estamos dibujando.
        reg.condicionWX = false;

        if(!this.lcd) return;

        // Guardamos coordenadas y offsets de uso frecuente para evitar mezclar
        // la línea visible del framebuffer con LY, el contador interno de LCD.
        const anchoPantalla = GB_PANTALLA_ANCHO;
        const yPantalla = this.linea | 0;
        const lineaLCD = reg.lineaY | 0;
        const offsetLinea = (yPantalla * anchoPantalla) | 0;

        // Cachear vista 32-bit del framebuffer
        // ImageData usa bytes RGBA, pero escribir Uint32 reduce el trabajo por
        // pixel de cuatro asignaciones a una sola.
        if(!this._lcd32 || this._lcd32.buffer !== this.lcd.data.buffer){
            this._lcd32 = new Uint32Array(this.lcd.data.buffer);
        }
        const framebuffer32 = this._lcd32;

        const colores32 = this.obtenerColores32();
        const coloresDebugCapas = this.debugColorearCapas ? this.obtenerColoresDebugCapas32(this.valorColor) : null;

        // La máscara permite extraer el bit de color correspondiente dentro de
        // los dos bytes que forman una fila de tile. indicesBGLinea se guarda
        // para que luego los sprites sepan si el fondo era color 0.
        const mascaraBitPixel = this._mask8;
        const indicesBGLinea = this._bgIdx;

        const vram   = reg.vRAM;
        const paletaBGVentana  = reg.paletaBGVent;
        const paletaObj0 = reg.paletaObj0;
        const paletaObj1 = reg.paletaObj1;

        // Lista de sprites en la línea (max 10)
        // El hardware solo considera hasta 10 objetos por scanline; filtrar
        // aquí evita revisar toda la OAM para cada pixel.
        const objetosEnLinea = this._objLine || (this._objLine = new Array(10));
        let totalObjetosEnLinea = 0;
        const alturaObj = reg.tamanyoObjeto ? 16 : 8;

        if(reg.objEnable){
            const objs = reg.objetos;
            for(let i=0; i<objs.length && totalObjetosEnLinea<10; i++){
                const objeto = objs[i];
                const ySuperiorObjeto = (objeto.y|0) - 16;

                if(lineaLCD >= ySuperiorObjeto && lineaLCD < ySuperiorObjeto + alturaObj){
                    objetosEnLinea[totalObjetosEnLinea++] = objeto;
                }
            }

            // En DMG la prioridad entre los 10 candidatos depende primero de X
            // y, cuando X coincide, del orden original en OAM. La inserción es
            // estable, por lo que conserva ese orden en los empates.
            for(let i=1; i<totalObjetosEnLinea; i++){
                const objeto = objetosEnLinea[i];
                let j = i - 1;
                while(j >= 0 && (objetosEnLinea[j].x | 0) > (objeto.x | 0)){
                    objetosEnLinea[j + 1] = objetosEnLinea[j];
                    j--;
                }
                objetosEnLinea[j + 1] = objeto;
            }
        }

        // Condiciones de ventana
        // https://gbdev.io/pandocs/Window.html#window-rendering-criteria
        // WY no dibuja la ventana por sí solo: solo habilita la condición
        // vertical. La condición horizontal depende de WX y de llegar a su X.
        // La condición WY se actualiza al inicio de Mode 2, no aquí: hacerlo
        // durante el render permitiría activar la ventana demasiado tarde.

        const windowStart = ((this.windowXLinea|0) - 7) | 0;   // Primer x dentro de ventana
        const windowActive = reg.BGWindowEnable && reg.windowEnable && reg.condicionWY;
        const winStartX = windowActive ? Math.min(anchoPantalla, Math.max(0, windowStart)) : anchoPantalla;

        // ventanaVisible se usa fuera de esta función para avanzar el contador
        // interno de línea de ventana solo cuando realmente se ha dibujado.
        if(windowActive && winStartX < anchoPantalla) this.ventanaVisible = true;
        if((this.windowXLinea|0) <= 7) reg.condicionWX = true;

        // Fondo / Window
        if(reg.BGWindowEnable){
            // Los registros LCDC eligen qué mapa de tiles usar para BG/Window
            // y si los índices de tile se interpretan con base 0x8000 o 0x9000.
            const bgMapBase  = this.BGTileMapAreaLinea ? 0x9C00 : 0x9800;
            const winMapBase = reg.windowTileMapArea ? 0x9C00 : 0x9800;
            const bgDataBase = this.BGWindowTileDataAreaLinea ? 0x8000 : 0x9000;
            const winDataBase = reg.BGWindowTileDataArea ? 0x8000 : 0x9000;

            // BG: y constante en la línea
            // SCY/SCX desplazan el fondo circular de 256x256; por eso se
            // enmascara a 8 bits.
            const yBG = (lineaLCD + (this.scrollYLinea|0)) & 0xFF;
            const tileYBG = (yBG >> 3) & 31;
            const filaEnTileBG = yBG & 7;
            const scrollX = this.scrollXLinea | 0;

            // Segmento BG: [0, winStartX)
            // Mientras seguimos dentro del mismo tile reutilizamos sus dos
            // bytes de fila; solo se vuelve a leer VRAM al cruzar cada 8 pixels.
            let ultimoTileX = -1;
            let byteBajoTile = 0;
            let byteAltoTile = 0;
            for(let x=0; x<winStartX; x++){
                const xBG = (scrollX + x) & 0xFF;
                const tileX = (xBG >> 3) & 31;

                if(tileX !== ultimoTileX){
                    ultimoTileX = tileX;
                    let tileId = vram[(bgMapBase + (tileYBG<<5) + tileX) - 0x8000];

                    // En el modo 0x9000 el identificador del tile es signed:
                    // valores 128..255 apuntan a tiles negativos alrededor de 0x9000.
                    if(!this.BGWindowTileDataAreaLinea) tileId = (tileId << 24) >> 24;

                    const direccionTile = (bgDataBase + (tileId * 16) + (filaEnTileBG<<1)) - 0x8000;
                    byteBajoTile = vram[direccionTile];
                    byteAltoTile = vram[direccionTile + 1];
                }

                const mascaraPixel = mascaraBitPixel[xBG & 7];
                const indiceColor = ((byteBajoTile & mascaraPixel) ? 1 : 0) | ((byteAltoTile & mascaraPixel) ? 2 : 0);
                // Guardar el índice sin paleta mantiene la regla de prioridad
                // de sprites: solo importa si el BG era color 0 o no.
                indicesBGLinea[x] = indiceColor;
                // En modo debug interesa saber que este pixel viene del fondo,
                // manteniendo el tono de gris que habría usado la paleta real.
                framebuffer32[offsetLinea + x] = coloresDebugCapas
                    ? coloresDebugCapas.fondo[paletaBGVentana[indiceColor]]
                    : colores32[paletaBGVentana[indiceColor]];
            }

            // Segmento Window: [winStartX, 160)
            if(windowActive && winStartX < anchoPantalla){
                reg.condicionWX = true; // al entrar en ventana, WX condition ya se considera activa

                // La ventana no usa SCX/SCY: su Y sale de lineaVentana, que
                // avanza solo en las scanlines donde la ventana aparece.
                const yVentana = this.lineaVentana | 0;
                const tileYVentana = (yVentana >> 3) & 31;
                const filaEnTileVentana = yVentana & 7;

                let ultimoTileXVentana = -1;
                byteBajoTile = 0;
                byteAltoTile = 0;
                for(let x=winStartX; x<anchoPantalla; x++){
                    const xVentana = x - windowStart; // >= 0 en este segmento
                    const tileX = (xVentana >> 3) & 31;

                    if(tileX !== ultimoTileXVentana){
                        ultimoTileXVentana = tileX;
                        let tileId = vram[(winMapBase + (tileYVentana<<5) + tileX) - 0x8000];
                        // En el modo 0x9000 el identificador del tile es signed:
                        // valores 128..255 apuntan a tiles negativos alrededor de 0x9000.
                        if(!reg.BGWindowTileDataArea) tileId = (tileId << 24) >> 24;

                        const direccionTile = (winDataBase + (tileId * 16) + (filaEnTileVentana<<1)) - 0x8000;
                        byteBajoTile = vram[direccionTile];
                        byteAltoTile = vram[direccionTile + 1];
                    }

                    const mascaraPixel = mascaraBitPixel[xVentana & 7];
                    const indiceColor = ((byteBajoTile & mascaraPixel) ? 1 : 0) | ((byteAltoTile & mascaraPixel) ? 2 : 0);
                    indicesBGLinea[x] = indiceColor;
                    // En modo debug interesa separar claramente ventana de BG,
                    // manteniendo el tono de gris que habría usado la paleta real.
                    framebuffer32[offsetLinea + x] = coloresDebugCapas
                        ? coloresDebugCapas.ventana[paletaBGVentana[indiceColor]]
                        : colores32[paletaBGVentana[indiceColor]];
                }
            }
        } else {
            // BG apagado a blanco
            // Aunque el fondo esté desactivado, los sprites necesitan ver la
            // línea como color 0 para aplicar bien sus reglas de prioridad.
            const blanco = colores32[0];
            indicesBGLinea.fill(0);
            for(let x=0; x<anchoPantalla; x++){
                framebuffer32[offsetLinea + x] = coloresDebugCapas
                    ? coloresDebugCapas.fondo[0]
                    : blanco;
            }
        }

        // Sprites: por pixel (lógica antigua)
        if (reg.objEnable && totalObjetosEnLinea) {
            // Debug del primer sprite en la línea
            // Este bloque guarda una foto sencilla del primer objeto visible
            // para inspeccionar su tile/fila sin repetir cálculos desde fuera.
            const o0 = objetosEnLinea[0];
            if (o0) {
                if (!this.debugSprite) {
                    this.debugSprite = {
                        x: 0,
                        y: 0,
                        tile: 0,
                        row: 0,
                        low: 0,
                        high: 0,
                        pal: 0,
                        idxs: new Uint8Array(8)
                    };
                }
                let yRel0 = lineaLCD - ((o0.y | 0) - 16);
                if (o0.yFlip) yRel0 = (alturaObj - 1) - yRel0;
                let tile0 = o0.tileIndice | 0;
                if (alturaObj === 16) {
                    // En modo 8x16 el bit bajo del índice se ignora; el sprite
                    // usa dos tiles consecutivos y yRel0 decide cuál toca.
                    tile0 &= 0xFE;
                    if (yRel0 & 8) tile0 += 1;
                }
                const row0 = yRel0 & 7;
                const dirTileDebug = (0x8000 + (tile0 * 16) + (row0 << 1)) - 0x8000;
                const byteBajoDebug = vram[dirTileDebug];
                const byteAltoDebug = vram[dirTileDebug + 1];

                const dbg = this.debugSprite;
                dbg.x = o0.x | 0;
                dbg.y = o0.y | 0;
                dbg.tile = tile0 | 0;
                dbg.row = row0 | 0;
                dbg.low = byteBajoDebug | 0;
                dbg.high = byteAltoDebug | 0;
                dbg.pal = o0.paletaDMG | 0;
                const idxs = dbg.idxs;
                for (let px = 0; px < 8; px++) {
                    const mascaraPixel = mascaraBitPixel[px];
                    idxs[px] = ((byteBajoDebug & mascaraPixel) ? 1 : 0) | ((byteAltoDebug & mascaraPixel) ? 2 : 0);
                }
            }

            for (let x = 0; x < anchoPantalla; x++) {
                for (let i = 0; i < totalObjetosEnLinea; i++) {
                    const objeto = objetosEnLinea[i];
                    const xObjeto = objeto.x | 0;
                    // La coordenada OAM sitúa el borde izquierdo en X - 8.
                    const xPantallaObjeto = xObjeto - 8;
                    if (x < xPantallaObjeto || x >= xPantallaObjeto + 8) continue;

                    let yRelativaObjeto = lineaLCD - ((objeto.y | 0) - 16);
                    if (objeto.yFlip) yRelativaObjeto = (alturaObj - 1) - yRelativaObjeto;

                    let xRelativaObjeto = 0;
                    // Los flips no cambian el tile elegido, solo el pixel de la
                    // fila que se consulta dentro de ese tile.
                    if (!objeto.xFlip) {
                        xRelativaObjeto = x - xPantallaObjeto;
                    } else {
                        xRelativaObjeto = 7 - (x - xPantallaObjeto);
                    }

                    const tileBaseObjeto = (alturaObj === 16) ? (objeto.tileIndice & 0xFE) : (objeto.tileIndice | 0);
                    const offsetTileObjeto = (tileBaseObjeto * 16) + (yRelativaObjeto * 2);
                    const direccionTileObjeto = (0x8000 + offsetTileObjeto) - 0x8000;
                    const byteBajoObjeto = vram[direccionTileObjeto];
                    const byteAltoObjeto = vram[direccionTileObjeto + 1];

                    let indiceColor = 0;
                    const bitPixel = 0x80 >> (xRelativaObjeto & 7);
                    if (byteBajoObjeto & bitPixel) indiceColor |= 1;
                    if (byteAltoObjeto & bitPixel) indiceColor |= 2;
                    if (indiceColor === 0) continue; // Transparente

                    const paletaObjeto = objeto.paletaDMG ? paletaObj1 : paletaObj0;
                    // Si prioridad está activa, el sprite solo tapa al fondo
                    // cuando el pixel de BG/Window era color 0.
                    if (!objeto.prioridad || indicesBGLinea[x] === 0) {
                        // En modo debug solo coloreamos sprites visibles: si el
                        // sprite queda oculto por prioridad, se conserva BG/Window.
                        framebuffer32[offsetLinea + x] = coloresDebugCapas
                            ? coloresDebugCapas.sprite[paletaObjeto[indiceColor]]
                            : colores32[paletaObjeto[indiceColor]];
                    }

                    // El primer píxel OBJ no transparente gana. Si queda detrás
                    // del BG por prioridad, un objeto inferior tampoco se ve.
                    break;
                }
            }
        }
    }


    /**
     * Cambia la escala de la pantalla
     * @param {number} escala 
     */
    cambiarEscala(escala){
        this.escala = Math.max(1, escala|0);
        this.canvas.width  = 160 * this.escala;
        this.canvas.height = 144 * this.escala;
        if (this.contexto)
            this.contexto.imageSmoothingEnabled = false;
    }

    /**
     * Dibuja la pantalla escalada
     * @returns 
     */
    dibujarPantalla(){
        let imagenLCD = this.lcd;

        if(this.lcd && this.lcdSalida && this.lcdFantasma && this.ghostingLCD > 0){
            const entrada = this.lcd.data;
            const salida = this.lcdSalida.data;
            const fantasma = this.lcdFantasma;
            const pesoAnterior = this.ghostingLCD;
            const pesoActual = 1 - pesoAnterior;

            if(!this.lcdFantasmaInicializado){
                fantasma.set(entrada);
                this.lcdFantasmaInicializado = true;
            }

            // Para simular ghosting se le suman a los valores actuales de encendido de la lcd
            //  los valores anteriores ponderados por un valor ajustable
            for(let i=0; i<entrada.length; i+=4){
                salida[i] = (entrada[i] * pesoActual) + (fantasma[i] * pesoAnterior);
                salida[i + 1] = (entrada[i + 1] * pesoActual) + (fantasma[i + 1] * pesoAnterior);
                salida[i + 2] = (entrada[i + 2] * pesoActual) + (fantasma[i + 2] * pesoAnterior);
                salida[i + 3] = 255;
            }
            fantasma.set(salida);
            imagenLCD = this.lcdSalida;
        } else if(this.lcd && this.lcdFantasma) {
            this.lcdFantasma.set(this.lcd.data);
            this.lcdFantasmaInicializado = true;
        }

        // Volcar el ImageData al buffer trasero
        if (this.backCtx && imagenLCD) {
            this.backCtx.putImageData(imagenLCD, 0, 0);
        }

        // Escalar con la GPU al canvas visible
        const w = this.canvas.width, h = this.canvas.height;
        if (!this.contexto) return;
        this.contexto.imageSmoothingEnabled = false; // nearest-neighbor
        this.contexto.clearRect(0, 0, w, h);
        this.contexto.drawImage(this.backCanvas, 0, 0, 160, 144, 0, 0, w, h);
    }

    /**
     * Emula los ciclos de la cpu en la pantalla
     * @param {number} ciclos 
     */
    enCiclos(ciclos){
        // Cuando LCDC.7 esta apagado, la PPU se detiene: LY queda en 0 y no
        // se dibujan lineas. Algunos juegos usan este periodo para reescribir
        // VRAM.
        if(!this.regLCD.LCDEnable){
            this.lcdEnableAnterior = false;
            this.dots = 0;
            this.linea = 0;
            this.lineaVentana = 0;
            this.ventanaVisible = false;
            this.regLCD.lineaY = 0;
            this.regLCD.ModeFlag = 0;
            this.regLCD.filaOAM = -1;
            this.modo = 0;
            this.regLCD.condicionWY = false;
            this.actualizarCoincidenciaLYC();
            return;
        }

        // Al reactivar la LCD el hardware empieza un nuevo frame desde Mode 2.
        // Reiniciar estos contadores evita arrastrar el estado anterior de PPU.
        if(!this.lcdEnableAnterior){
            this.lcdEnableAnterior = true;
            // En DMG, la primera scanline tras habilitar LCDC.7 queda adelantada
            // cuatro dots respecto a una línea normal. Este desfase sitúa el
            // cambio de LY entre los delay 109 y 110 de Blargg lcd_sync.
            this.dots = 4;
            this.linea = 0;
            this.lineaVentana = 0;
            this.ventanaVisible = false;
            this.regLCD.lineaY = 0;
            this.regLCD.ModeFlag = 2;
            this.regLCD.filaOAM = Math.floor(this.dots / 4);
            this.modo = 2;
            this.regLCD.condicionWY = false;
            this.actualizarCondicionWYInicioModo2();
            this.actualizarCoincidenciaLYC();
        }

        // https://gbdev.io/pandocs/pixel_fifo.html
        // En cada ciclo de cpu a velocidad normal hay 4 dots
        this.dots += ciclos;
        this.terminada = false;
        this.actualizarCoincidenciaLYC();
        if(this.modo === 2){
            this.regLCD.filaOAM = Math.min(19, Math.floor(this.dots / 4));
        }
        switch(this.modo){
            // Escaneo OAM
            case 2:
                // Se buscan los objetos que superponen a esta lista
                // Duracion 80 dots, 0-80 dots
                // Se puede acceder la VRAM en este modo

                // Se pasa al modo 3
                if(this.dots >= 80){
                    this.dots -= 80;
                    this.regLCD.ModeFlag = 3;
                    this.regLCD.filaOAM = -1;
                    this.modo = 3; // Modo de dibujo de pixeles
                    this.capturarScrollLinea();
                    this.ventanaVisible = this.esVentanaVisibleEnLinea();
                    this.duracionModo3 = this.calcularDuracionModo3Linea();
                    this.duracionModo0 = 456 - 80 - this.duracionModo3;
                    // TODO this.memoria.bloqueoVRAM = true; // Se desbloquea la RAM
                }
                break;
            // Dibujando Pixeles
            case 3:
                // Se mandan pixeles a el LCD
                // Duracion entre 172 y 289 dots
                // No se puede acceder a VRAM ni a OAM

                // Se pasa al modo 0
                if(this.dots >= this.duracionModo3){
                    this.dots -= this.duracionModo3;
                    this.dibujarLinea();
                    this.regLCD.ModeFlag = 0;
                    this.modo = 0;
                    // Si está activada la interrupcion STAT en modo 0
                    if(this.regLCD.interrupcionEstadoEnModo0){
                        // Se pide una interrupcion de lcdstat
                        this.ints.regs.flagsInterrupcion[LCDSTAT_INT] = true;
                    }
                }
                break;
            // Horizontal Blank
            case 0:
                // Se espera al final de la linea
                // Duracion base 204 dots. Una linea completa son 456 dots:
                // OAM 80 + pixel transfer variable + HBlank ajustado.
                // Se puede acceder VRAM, OAM, y paletas CGB
                
                if(this.dots >= this.duracionModo0){
                    this.dots -= this.duracionModo0;
                    this.linea++;

                    this.regLCD.lineaY = this.linea;
                    this.actualizarCoincidenciaLYC();

                    // La ventana es visible por lo tanto aumentamos el contador interno
                    if(this.ventanaVisible) this.lineaVentana++;
                    
                    this.ventanaVisible = false;
                    // Se pasa al modo de busqueda de OAM
                    if(this.linea < 144){
                        this.regLCD.ModeFlag = 2;
                        this.regLCD.filaOAM = Math.min(19, Math.floor(this.dots / 4));
                        this.modo = 2;
                        this.actualizarCondicionWYInicioModo2();
                        // TODO this.memoria.bloqueoOAM = true;
                        // Si está activada la interrupcion STAT en modo 2
                        if(this.regLCD.interrupcionEstadoEnModo2){
                            // Se pide una interrupcion de lcdstat
                            this.ints.regs.flagsInterrupcion[LCDSTAT_INT] = true;
                        }

                    // Si la linea es la 144 se pasa al VBlank
                    } else {
                        // Pasa a VBlank
                        this.regLCD.ModeFlag = 1;
                        this.regLCD.filaOAM = -1;
                        this.modo = 1;
                        // Si está activada la interrupcion STAT en modo 1
                        if(this.regLCD.interrupcionEstadoEnModo1){
                            // Se pide una interrupcion de lcdstat
                            this.ints.regs.flagsInterrupcion[LCDSTAT_INT] = true;
                        }
                        // https://gbdev.io/pandocs/Interrupt_Sources.html#int-40--vblank-interrupt
                        // La interrupcion VBlank se pide cada vez que se entra en el modo 1 (VBLANK)
                        this.ints.regs.flagsInterrupcion[VBLANK_INT] = true;
                        this.regLCD.condicionWY = false;
                        this.dibujarPantalla();
            
                    }
                }
                break;
            // Vertical Blank
            case 1:
                // Se espera hasta el siguiente frame
                // Duracion 4560 dots (456 * 10)
                // Se puede acceder VRAM, OAM, y paletas CGB
                if(this.dots >= 456){
                    this.dots -= 456;
                    this.linea++;
                    this.regLCD.lineaY = this.linea;
                    this.actualizarCoincidenciaLYC();
                    if(this.linea > 153){

                        this.terminada = true;
                        this.regLCD.ModeFlag = 2;
                        this.regLCD.filaOAM = Math.min(19, Math.floor(this.dots / 4));
                        this.modo = 2;

                        this.linea = 0; // Contador de linea se reinicia
                        this.regLCD.lineaY = this.linea;
                        this.actualizarCoincidenciaLYC();
                        this.regLCD.condicionWY = false;
                        this.actualizarCondicionWYInicioModo2();
                        this.lineaVentana = 0; // Contador de linea de ventana se reinicia

                        //TODO this.memoria.bloqueoOAM = true;
                        // Si está activada la interrupcion STAT en modo 2
                        if(this.regLCD.interrupcionEstadoEnModo2){
                            // Se pide una interrupcion de lcdstat
                            this.ints.regs.flagsInterrupcion[LCDSTAT_INT] = true;
                        }
                    }
                }
                break;
            default:
                console.error("Modo LCD no esperado. modo=", this.modo); 
                break;
        }
    }

}
