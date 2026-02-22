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
     * 
     */
    dibujarLinea(){
        const reg = this.regLCD;
        reg.condicionWX = false;

        if(!this.lcd) return;

        // Cachear vista 32-bit del framebuffer
        if(!this._lcd32 || this._lcd32.buffer !== this.lcd.data.buffer){
            this._lcd32 = new Uint32Array(this.lcd.data.buffer);
        }
        const out32 = this._lcd32;

        // Precalcular tabla de colores empaquetados (una vez)
        if(!reg.valorColor32){
            const vc = reg.valorColor; // [[r,g,b,a], ...]
            const vc32 = new Uint32Array(vc.length);
            const little = this._littleEndian ?? (new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44);

            for(let i=0;i<vc.length;i++){
                const c = vc[i];
                // En little-endian, escribir 0xAABBGGRR produce bytes [RR,GG,BB,AA]
                vc32[i] = little
                    ? (((c[3] << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0)
                    : (((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | c[3]) >>> 0);
            }
            // @ts-expect-error
            reg.valorColor32 = vc32;
        }
        const colors32 = reg.valorColor32;

        const mask = this._mask8;
        const bgIdx = this._bgIdx;

        const vram   = reg.vRAM;
        const bgPal  = reg.paletaBGVent;
        const objPal0 = reg.paletaObj0;
        const objPal1 = reg.paletaObj1;

        const line  = this.linea | 0;
        const lineY = reg.lineaY | 0;
        const base  = (line * GB_PANTALLA_ANCHO) | 0;

        // Lista de sprites en la línea (max 10)
        const objLine = this._objLine || (this._objLine = new Array(10));
        let objCount = 0;
        const alturaObj = reg.tamanyoObjeto ? 16 : 8;

        if(reg.objEnable){
            const objs = reg.objetos;
            for(let i=0; i<objs.length && objCount<10; i++){
                const o = objs[i];
                const top = (o.y|0) - 16;
                if(lineY >= top && lineY < top + alturaObj){
                    objLine[objCount++] = o;
                }
            }
        }

        // Condiciones de ventana
        if(lineY === reg.windowY) reg.condicionWY = true;

        const windowStart = ((reg.windowX|0) - 7) | 0;   // Primer x dentro de ventana
        const windowActive = reg.BGWindowEnable && reg.windowEnable && reg.condicionWY;
        const winStartX = windowActive ? Math.max(0, windowStart) : GB_PANTALLA_ANCHO;

        if(windowActive && winStartX < GB_PANTALLA_ANCHO) this.ventanaVisible = true;
        if((reg.windowX|0) <= 7) reg.condicionWX = true;

        // Fondo / Window
        if(reg.BGWindowEnable){
            const bgMapBase  = reg.BGTileMapArea ? 0x9C00 : 0x9800;
            const winMapBase = reg.windowTileMapArea ? 0x9C00 : 0x9800;
            const dataBase   = reg.BGWindowTileDataArea ? 0x8000 : 0x9000;

            // BG: y constante en la línea
            const yBG = (lineY + (reg.scrollY|0)) & 0xFF;
            const tileY = (yBG >> 3) & 31;
            const yInTile = yBG & 7;
            const scrollX = reg.scrollX | 0;

            // Segmento BG: [0, winStartX)
            let lastTileX = -1, low=0, high=0;
            for(let x=0; x<winStartX; x++){
                const pX = (scrollX + x) & 0xFF;
                const tileX = (pX >> 3) & 31;

                if(tileX !== lastTileX){
                    lastTileX = tileX;
                    let tileId = vram[(bgMapBase + (tileY<<5) + tileX) - 0x8000];

                    if(!reg.BGWindowTileDataArea) tileId = (tileId << 24) >> 24;

                    const addr = (dataBase + (tileId * 16) + (yInTile<<1)) - 0x8000;
                    low  = vram[addr];
                    high = vram[addr + 1];
                }

                const m = mask[pX & 7];
                const idx = ((low & m) ? 1 : 0) | ((high & m) ? 2 : 0);
                bgIdx[x] = idx;
                out32[base + x] = colors32[ bgPal[idx] ];
            }

            // Segmento Window: [winStartX, 160)
            if(windowActive && winStartX < GB_PANTALLA_ANCHO){
                reg.condicionWX = true; // al entrar en ventana, WX condition ya se considera activa

                const yW = this.lineaVentana | 0;
                const wTileY = (yW >> 3) & 31;
                const wRow = yW & 7;

                let lastWTX = -1; low=0; high=0;
                for(let x=winStartX; x<GB_PANTALLA_ANCHO; x++){
                    const pX = x - windowStart; // >= 0 en este segmento
                    const tileX = (pX >> 3) & 31;

                    if(tileX !== lastWTX){
                    lastWTX = tileX;
                    let tileId = vram[(winMapBase + (wTileY<<5) + tileX) - 0x8000];
                    if(!reg.BGWindowTileDataArea) tileId = (tileId << 24) >> 24;

                    const addr = (dataBase + (tileId * 16) + (wRow<<1)) - 0x8000;
                    low  = vram[addr];
                    high = vram[addr + 1];
                    }

                    const m = mask[pX & 7];
                    const idx = ((low & m) ? 1 : 0) | ((high & m) ? 2 : 0);
                    bgIdx[x] = idx;
                    out32[base + x] = colors32[ bgPal[idx] ];
                }
            }
        } else {
            // BG apagado a blanco
            const white = colors32[0];
            bgIdx.fill(0);
            for(let x=0; x<GB_PANTALLA_ANCHO; x++) out32[base + x] = white;
        }

        // Sprites: por pixel (lógica antigua)
        if (reg.objEnable && objCount) {
            // Debug del primer sprite en la línea
            const o0 = objLine[0];
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
                let yRel0 = lineY - ((o0.y | 0) - 16);
                if (o0.yFlip) yRel0 = (alturaObj - 1) - yRel0;
                let tile0 = o0.tileIndice | 0;
                if (alturaObj === 16) {
                    tile0 &= 0xFE;
                    if (yRel0 & 8) tile0 += 1;
                }
                const row0 = yRel0 & 7;
                const dir0 = (0x8000 + (tile0 * 16) + (row0 << 1)) - 0x8000;
                const low0 = vram[dir0];
                const high0 = vram[dir0 + 1];

                const dbg = this.debugSprite;
                dbg.x = o0.x | 0;
                dbg.y = o0.y | 0;
                dbg.tile = tile0 | 0;
                dbg.row = row0 | 0;
                dbg.low = low0 | 0;
                dbg.high = high0 | 0;
                dbg.pal = o0.paletaDMG | 0;
                const idxs = dbg.idxs;
                for (let px = 0; px < 8; px++) {
                    const m = mask[px];
                    idxs[px] = ((low0 & m) ? 1 : 0) | ((high0 & m) ? 2 : 0);
                }
            }

            for (let x = 0; x < GB_PANTALLA_ANCHO; x++) {
                for (let i = 0; i < objCount; i++) {
                    const o = objLine[i];
                    const ox = o.x | 0;
                    if (ox < x || ox >= (x + 8)) continue;

                    let posYRel = lineY - ((o.y | 0) - 16);
                    if (o.yFlip) posYRel = (alturaObj - 1) - posYRel;

                    let posXRel = 0;
                    if (!o.xFlip) {
                        posXRel = x - (ox - 7);
                    } else {
                        posXRel = 7 - (x - (ox - 7));
                    }

                    const baseTile = (alturaObj === 16) ? (o.tileIndice & 0xFE) : (o.tileIndice | 0);
                    const objTileAreaOffset = (baseTile * 16) + (posYRel * 2);
                    const dir = (0x8000 + objTileAreaOffset) - 0x8000;
                    const low = vram[dir];
                    const high = vram[dir + 1];

                    let idx = 0;
                    const bit = 0x80 >> (posXRel & 7);
                    if (low & bit) idx |= 1;
                    if (high & bit) idx |= 2;
                    if (idx === 0) continue; // Transparente

                    const pal = o.paletaDMG ? objPal1 : objPal0;
                    if (!o.prioridad || bgIdx[x] === 0) {
                        out32[base + x] = colors32[ pal[idx] ];
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
                    this.dibujarLinea();
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
                // Duracion 376 dots
                // Se puede acceder VRAM, OAM, y paletas CGB
                
                if(this.dots >= 376){
                    this.dots = 0;
                    this.linea++;

                    this.regLCD.lineaY = this.linea;
                    // Gameboy compara constantemente el valor de los registros LYC y LY.
                    // Cuando ambos valores son idénticos, el flag de LYC=LY se setea, y
                    // si se ha activado, se pide una interrupcion STAT.
                    // https://gbdev.io/pandocs/STAT.html#ff45--lyc-ly-compare
                    if(this.regLCD.lineaY == this.regLCD.lineaYComparar){
                        // Se actualiza el flag a set
                        this.regLCD.LYCLYFlag = true;
                        // Si esta activada la interrupcion en LYC=LY
                        if(this.regLCD.interrupcionEstadoEnLYCLY){
                            //console.log("interrupcion LYCLY " + this.regLCD.lineaY)
                            // Se pide una interrupcion de lcdstat
                            this.ints.regs.flagsInterrupcion[LCDSTAT_INT] = true;
                        }
                    }
                    else {
                        // Se actualiza a no set
                        this.regLCD.LYCLYFlag = false;
                    }

                    // La ventana es visible por lo tanto aumentamos el contador interno
                    if(this.ventanaVisible) this.lineaVentana++;
                    
                    this.ventanaVisible = false;
                    // Se pasa al modo de busqueda de OAM
                    if(this.linea <= 144){
                        this.regLCD.ModeFlag = 2;
                        this.modo = 2;
                        // TODO this.memoria.bloqueoOAM = true;
                        // Si está activada la interrupcion STAT en modo 2
                        if(this.regLCD.interrupcionEstadoEnModo2){
                            // Se pide una interrupcion de lcdstat
                            console.log("interrupcion modo2")
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
                            console.log("interrupcion modo1")
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
                if(this.dots > 456){
                    this.dots = 0;
                    this.linea++;
                    this.regLCD.lineaY = this.linea;
                    if(this.linea > 153){

                        this.terminada = true;
                        this.regLCD.ModeFlag = 2;
                        this.modo = 2;

                        this.linea = 0; // Contador de linea se reinicia
                        this.regLCD.lineaY = this.linea;
                        this.lineaVentana = 0; // Contador de linea de ventana se reinicia

                        //TODO this.memoria.bloqueoOAM = true;
                        // Si está activada la interrupcion STAT en modo 2
                        if(this.regLCD.interrupcionEstadoEnModo2){
                            // Se pide una interrupcion de lcdstat
                            console.log("interrupcion modo2")
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
