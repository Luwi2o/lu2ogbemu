// @ts-check

import {RegistrosLCD} from '../memoria/registros/registros_lcd.js';
import {Interrupciones} from '../cpu/interrupciones.js';
import {
    GB_PANTALLA_ANCHO,
    GB_PANTALLA_ALTO,

    LCDSTAT_INT,
    VBLANK_INT
} from '../constantes.js';

/**
 * Emula la pantalla de la Gameboy
 */
export class Pantalla{

    /**
     * Constructor de Pantalla
     * @param {RegistrosLCD} regLCD 
     * @param {Interrupciones} ints
     * @param {Object} estado
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
        this._statLYCPrev = false;

        this.canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameboy-canvas"));
        this.contexto = this.canvas.getContext("2d", { alpha: false });
        this.lcd = this.contexto ? this.contexto.createImageData(160, 144) : null;

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
    }

    /**
     * Captura los registros de scroll usados para renderizar la linea actual.
     * Los juegos pueden escribir SCX/SCY durante HBlank para preparar la
     * siguiente scanline; no debe cambiar retroactivamente una linea ya activa.
     */
    capturarScrollLinea(){
        this.scrollXLinea = this.regLCD.scrollX & 0xFF;
        this.scrollYLinea = this.regLCD.scrollY & 0xFF;
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

        // Precalcular tabla de colores empaquetados (una vez)
        // Las paletas del DMG devuelven índices de color; esta tabla convierte
        // esos índices directamente al formato que espera el framebuffer.
        if(!reg.valorColor32){
            const coloresRGBA = reg.valorColor; // [[r,g,b,a], ...]
            const colores32 = new Uint32Array(coloresRGBA.length);
            const little = this._littleEndian ?? (new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44);

            for(let i=0;i<coloresRGBA.length;i++){
                const c = coloresRGBA[i];
                // En little-endian, escribir 0xAABBGGRR produce bytes [RR,GG,BB,AA]
                colores32[i] = little
                    ? (((c[3] << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0)
                    : (((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | c[3]) >>> 0);
            }
            // @ts-expect-error
            reg.valorColor32 = colores32;
        }
        const colores32 = reg.valorColor32;

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
        }

        // Condiciones de ventana
        // https://gbdev.io/pandocs/Window.html#window-rendering-criteria
        // WY no dibuja la ventana por sí solo: solo habilita la condición
        // vertical. La condición horizontal depende de WX y de llegar a su X.
        if(lineaLCD === reg.windowY) reg.condicionWY = true;

        const windowStart = ((reg.windowX|0) - 7) | 0;   // Primer x dentro de ventana
        const windowActive = reg.BGWindowEnable && reg.windowEnable && reg.condicionWY;
        const winStartX = windowActive ? Math.max(0, windowStart) : anchoPantalla;

        // ventanaVisible se usa fuera de esta función para avanzar el contador
        // interno de línea de ventana solo cuando realmente se ha dibujado.
        if(windowActive && winStartX < anchoPantalla) this.ventanaVisible = true;
        if((reg.windowX|0) <= 7) reg.condicionWX = true;

        // Fondo / Window
        if(reg.BGWindowEnable){
            // Los registros LCDC eligen qué mapa de tiles usar para BG/Window
            // y si los índices de tile se interpretan con base 0x8000 o 0x9000.
            const bgMapBase  = reg.BGTileMapArea ? 0x9C00 : 0x9800;
            const winMapBase = reg.windowTileMapArea ? 0x9C00 : 0x9800;
            const dataBase   = reg.BGWindowTileDataArea ? 0x8000 : 0x9000;

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
                    if(!reg.BGWindowTileDataArea) tileId = (tileId << 24) >> 24;

                    const direccionTile = (dataBase + (tileId * 16) + (filaEnTileBG<<1)) - 0x8000;
                    byteBajoTile = vram[direccionTile];
                    byteAltoTile = vram[direccionTile + 1];
                }

                const mascaraPixel = mascaraBitPixel[xBG & 7];
                const indiceColor = ((byteBajoTile & mascaraPixel) ? 1 : 0) | ((byteAltoTile & mascaraPixel) ? 2 : 0);
                // Guardar el índice sin paleta mantiene la regla de prioridad
                // de sprites: solo importa si el BG era color 0 o no.
                indicesBGLinea[x] = indiceColor;
                framebuffer32[offsetLinea + x] = colores32[paletaBGVentana[indiceColor]];
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

                        const direccionTile = (dataBase + (tileId * 16) + (filaEnTileVentana<<1)) - 0x8000;
                        byteBajoTile = vram[direccionTile];
                        byteAltoTile = vram[direccionTile + 1];
                    }

                    const mascaraPixel = mascaraBitPixel[xVentana & 7];
                    const indiceColor = ((byteBajoTile & mascaraPixel) ? 1 : 0) | ((byteAltoTile & mascaraPixel) ? 2 : 0);
                    indicesBGLinea[x] = indiceColor;
                    framebuffer32[offsetLinea + x] = colores32[paletaBGVentana[indiceColor]];
                }
            }
        } else {
            // BG apagado a blanco
            // Aunque el fondo esté desactivado, los sprites necesitan ver la
            // línea como color 0 para aplicar bien sus reglas de prioridad.
            const blanco = colores32[0];
            indicesBGLinea.fill(0);
            for(let x=0; x<anchoPantalla; x++) framebuffer32[offsetLinea + x] = blanco;
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
                    // En OAM, X está desplazada 8 pixels. La comparación
                    // conserva la misma convención que el cálculo xObjeto - 7.
                    if (xObjeto < x || xObjeto >= (x + 8)) continue;

                    let yRelativaObjeto = lineaLCD - ((objeto.y | 0) - 16);
                    if (objeto.yFlip) yRelativaObjeto = (alturaObj - 1) - yRelativaObjeto;

                    let xRelativaObjeto = 0;
                    // Los flips no cambian el tile elegido, solo el pixel de la
                    // fila que se consulta dentro de ese tile.
                    if (!objeto.xFlip) {
                        xRelativaObjeto = x - (xObjeto - 7);
                    } else {
                        xRelativaObjeto = 7 - (x - (xObjeto - 7));
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
                        framebuffer32[offsetLinea + x] = colores32[paletaObjeto[indiceColor]];
                    }
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
        // Volcar el ImageData pequeño al buffer trasero
        if (this.backCtx && this.lcd) {
            this.backCtx.putImageData(this.lcd, 0, 0);
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
        // https://gbdev.io/pandocs/pixel_fifo.html
        // En cada ciclo de cpu a velocidad normal hay 4 dots
        this.dots += ciclos;
        this.terminada = false;
        this.actualizarCoincidenciaLYC();
        switch(this.modo){
            // Escaneo OAM
            case 2:
                // Se buscan los objetos que superponen a esta lista
                // Duracion 80 dots, 0-80 dots
                // Se puede acceder la VRAM en este modo

                // Se pasa al modo 3
                if(this.dots >= 80){
                    this.dots = 0; // Se resetea la cuenta de dots
                    this.regLCD.ModeFlag = 3;
                    this.modo = 3; // Modo de dibujo de pixeles
                    this.capturarScrollLinea();
                    this.dibujarLinea();
                    // TODO this.memoria.bloqueoVRAM = true; // Se desbloquea la RAM
                }
                break;
            // Dibujando Pixeles
            case 3:
                // Se mandan pixeles a el LCD
                // Duracion entre 172 y 289 dots
                // No se puede acceder a VRAM ni a OAM

                // Se pasa al modo 0
                if(this.dots >= 172){
                    this.dots = 0;
                    this.regLCD.ModeFlag = 0;
                    this.modo = 0;
                    // Si está activada la interrupcion STAT en modo 0
                    if(this.regLCD.interrupcionEstadoEnModo0){
                        // Se pide una interrupcion de lcdstat
                        //console.log("interrupcion modo0 ")
                        this.ints.regs.flagsInterrupcion[LCDSTAT_INT] = true;
                    }
                }
                break;
            // Horizontal Blank
            case 0:
                // Se espera al final de la linea
                // Duracion 204 dots. Una linea completa son 456 dots:
                // OAM 80 + pixel transfer 172 + HBlank 204.
                // Se puede acceder VRAM, OAM, y paletas CGB
                
                if(this.dots >= 204){
                    this.dots = 0;
                    this.linea++;

                    this.regLCD.lineaY = this.linea;
                    this.actualizarCoincidenciaLYC();

                    // La ventana es visible por lo tanto aumentamos el contador interno
                    if(this.ventanaVisible) this.lineaVentana++;
                    
                    this.ventanaVisible = false;
                    // Se pasa al modo de busqueda de OAM
                    if(this.linea < 144){
                        this.regLCD.ModeFlag = 2;
                        this.modo = 2;
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
                    this.dots = 0;
                    this.linea++;
                    this.regLCD.lineaY = this.linea;
                    this.actualizarCoincidenciaLYC();
                    if(this.linea > 153){

                        this.terminada = true;
                        this.regLCD.ModeFlag = 2;
                        this.modo = 2;

                        this.linea = 0; // Contador de linea se reinicia
                        this.regLCD.lineaY = this.linea;
                        this.actualizarCoincidenciaLYC();
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
