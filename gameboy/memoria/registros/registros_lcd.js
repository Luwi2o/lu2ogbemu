// @ts-check

import { BGB_DMG0 } from "../../constantes.js";

class Objeto {
    constructor(){
        this.y = /**@type {number}*/ 0x00;
        this.x = /**@type {number}*/ 0x00;
        this.tileIndice = /**@type {number}*/ 0x00;
        this.prioridad = /**@type {boolean}*/ false;
        this.xFlip = /**@type {boolean}*/ false;
        this.yFlip = /**@type {boolean}*/ false;
        this.paletaDMG = /**@type {number}*/ 0;
        this.banco = /**@type {number}*/ 0;
        this.paletaCGB = /**@type {number}*/ 0;

    }
}


export class RegistrosLCD {


    /**
     * Constructor de RegistrosLCD
     * @param {number} tipoConsola 
     * @param {Object} estado 
     */
    constructor(tipoConsola, estado){

        this.vRAM = new Uint8Array(0x2000).fill(0); // RAM de video

        this.linea = /**@type {number}*/ 0;
        this.condicionWX = /**@type {boolean}*/ false;
        this.condicionWY = /**@type {boolean}*/ false;
        this.modo = /**@type {number}*/ 2;

        this.currentX = 0;

        // https://gbdev.io/pandocs/Palettes.html#ff47--bgp-non-cgb-mode-only-bg-palette-data
        this.valorColor = [
            [255,255,255,255], // 0: Blanco
            [150,150,150,255], // 1: Gris claro
            [90,90,90,255],    // 2: Gris oscuro
            [0,0,0,255]        // 3: Negro
        ]

        this.valorColorRojo = [
            [255,122,122,255], // 0: Blanco
            [150,75,75,255], // 1: Gris claro
            [90,45,45,255],    // 2: Gris oscuro
            [10,0,0,255]        // 3: Negro
        ]

        this.valorColor32 = /** @type {Uint32Array<ArrayBuffer>} */ [
            0xFFFFFFFF, // 0: Blanco
            0xFF969696, // 1: Gris claro
            0xFF5A5A5A, // 2: Gris oscuro
            0xFF000000  // 3: Negro
        ] 


        // https://gbdev.io/pandocs/Palettes.html#ff47--bgp-non-cgb-mode-only-bg-palette-data
        this.paletaBGVent = [0, 1, 2, 3];
        // https://gbdev.io/pandocs/Palettes.html#ff48ff49--obp0-obp1-non-cgb-mode-only-obj-palette-0-1-data
        this.paletaObj0 = [0, 1, 2, 3];
        this.paletaObj1 = [0, 1, 2, 3];
        // Debug: seguimiento de escrituras de paletas OBJ
        this.debugObp0Writes = 0;
        this.debugObp1Writes = 0;
        this.debugLastObp0 = 0x00;
        this.debugLastObp1 = 0x00;

        /** @type {Objeto[]} */
        this.objetos = new Array();
        for(var i = 0; i < 40; i++){
            this.objetos.push(new Objeto());
        }


        // https://gbdev.io/pandocs/Scrolling.html#ff4aff4b--wy-wx-window-y-position-x-position-plus-7
        this.scrollX = 0;
        this.scrollY = 0;

        this.lineaY = 0;
        this.lineaYComparar = 0;
        
        // https://gbdev.io/pandocs/Scrolling.html#ff4aff4b--wy-wx-window-y-position-x-position-plus-7
        this.windowX = 0;
        this.windowY = 0;

        //https://gbdev.io/pandocs/LCDC.html
        this.LCDEnable = /**@type {boolean}*/ false;
        this.windowTileMapArea = /**@type {boolean}*/ false; //0=9800-9BFF, 1=9C00-9FFF
        this.windowEnable = /**@type {boolean}*/ false;
        this.BGWindowTileDataArea = /**@type {boolean}*/ false; //0=8800-97FF, 1=8000-8FFF
        this.BGTileMapArea = /**@type {boolean}*/ false; //0=9800-9BFF, 1=9C00-9FFF
        this.tamanyoObjeto = /**@type {boolean}*/ false;
        this.objEnable = false; 
        this.BGWindowEnable = false;

        // https://gbdev.io/pandocs/STAT.html
        this.bitSinUsoEstado = /**@type {boolean}*/ false;
        this.interrupcionEstadoEnLYCLY = /**@type {boolean}*/ false;
        this.interrupcionEstadoEnModo2 = /**@type {boolean}*/ false;
        this.interrupcionEstadoEnModo1 = /**@type {boolean}*/ false;
        this.interrupcionEstadoEnModo0 = /**@type {boolean}*/ false;
        this.LYCLYFlag = /**@type {boolean}*/ false;
        this.ModeFlag = 0;

        if(estado){ 
            this.cargarEstado(estado)
        } else {
            // https://gbdev.io/pandocs/Power_Up_Sequence.html#power-up-sequence
            if (tipoConsola == BGB_DMG0){
                this.lineaY = 0x0;
                this.iniciarPaleta(0xFC);
                this.iniciarLCDControl(0x91);
                this.iniciarLCDEstado(0x85);
            }
        }
    }

    /**
     * Carga el estado de los registros del LCD
     * @param {*} estado 
     */
    cargarEstado(estado){
        var s = estado.registrosLCD;
        
        this.vRAM = s.vRAM;
        this.linea = s.linea;
        this.condicionWX = s.condicionWX;
        this.condicionWY = s.condicionWY;
        this.modo = s.modo;
        this.paletaBGVent = s.paleta;
        this.paletaObj0 = s.paletaObj0;
        this.paletaObj1 = s.paletaObj1;
        this.objetos = new Array();
        for(var i = 0; i < 40; i++) this.objetos.push(s.objetos[i]);
        this.scrollX = s.scrollX;
        this.scrollY = s.scrollY;
        this.lineaY = s.lineaY;
        this.lineaYComparar = s.lineaYComparar;
        this.windowX = s.windowX;
        this.windowY = s.windowY;
        this.LCDEnable = s.LCDEnable;
        this.windowTileMapArea = s.windowTileMapArea;
        this.windowEnable = s.windowEnable;
        this.BGWindowTileDataArea = s.BGWindowTileDataArea;
        this.BGTileMapArea = s.BGTileMapArea;
        this.tamanyoObjeto = s.objSize;
        this.objEnable = s.objEnable; 
        this.BGWindowEnable = s.BGWindowEnable;
        this.bitSinUsoEstado = s.bitSinUsoEstado;
        this.interrupcionEstadoEnLYCLY = s.interrupcionEstadoEnLYCLY;
        this.interrupcionEstadoEnModo2 = s.interrupcionEstadoEnModo2;
        this.interrupcionEstadoEnModo1 = s.interrupcionEstadoEnModo1;
        this.interrupcionEstadoEnModo0 = s.interrupcionEstadoEnModo0;
        this.LYCLYFlag = s.LYCLYFlag;
        this.ModeFlag = s.ModeFlag;
    }

    /**
     * Actualiza los datos de control del LCD
     * @param {number} dato dato
     */
    escribirLCDControl(dato){
        this.LCDEnable = (dato & 0x80) == 0x80; // Bit 7
        this.windowTileMapArea = (dato & 0x40) == 0x40; // Bit 6
        this.windowEnable = (dato & 0x20) == 0x20; // Bit 5
        this.BGWindowTileDataArea = (dato & 0x10) == 0x10; // Bit 4
        this.BGTileMapArea = (dato & 0x08) == 0x08; // Bit 3
        this.tamanyoObjeto = (dato & 0x04) == 0x04; // Bit 2
        this.objEnable = (dato & 0x02) == 0x02; // Bit 1
        this.BGWindowEnable = (dato & 0x01) == 0x01; // Bit 0
    }

    /**
     * Iniciar los registros del LCD
     * @param {number} dato 
     */
    iniciarLCDControl(dato){
        this.LCDEnable = (dato & 0x80) == 0x80; // Bit 7
        this.windowTileMapArea = (dato & 0x40) == 0x40; // Bit 6
        this.windowEnable = (dato & 0x20) == 0x20; // Bit 5
        this.BGWindowTileDataArea = (dato & 0x10) == 0x10; // Bit 4
        this.BGTileMapArea = (dato & 0x08) == 0x08; // Bit 3
        this.tamanyoObjeto = (dato & 0x04) == 0x04; // Bit 2
        this.objEnable = (dato & 0x02) == 0x02; // Bit 1
        this.BGWindowEnable = (dato & 0x01) == 0x01; // Bit 0 
    }

    /**
     * Lee el registro de control
     * @returns el dato del registro de control
     */
    leerLCDControl(){
        return (
            (this.LCDEnable ? 1:0) << 7 |
            (this.windowTileMapArea ? 1:0) << 6 |
            (this.windowEnable ? 1:0) << 5 |
            (this.BGWindowTileDataArea ? 1:0) << 4 |
            (this.BGTileMapArea ? 1:0) << 3 |
            (this.tamanyoObjeto ? 1:0) << 2 |
            (this.objEnable ? 1:0) << 1 |
            (this.BGWindowEnable ? 1:0)
        );
    }

    /**
     * Escribe el registro de control
     * @param {number} dato 
     */
    escribirLCDEstado(dato){
        this.bitSinUsoEstado = (dato & 0x80) == 0x80; // Bit 7
        this.interrupcionEstadoEnLYCLY = (dato & 0x40) == 0x40; // Bit 6
        this.interrupcionEstadoEnModo2 = (dato & 0x20) == 0x20; // Bit 5
        this.interrupcionEstadoEnModo1 = (dato & 0x10) == 0x10; // Bit 4
        this.interrupcionEstadoEnModo0 = (dato & 0x08) == 0x08; // Bit 3
        // Bit 2 LYC = LY Solo lectura
        // Bit 1 y 0 PPU modo Solo lectura
    }

    /**
     * Inicia el estado del LCD
     * @param {number} dato 
     */
    iniciarLCDEstado(dato){
        this.bitSinUsoEstado = (dato & 0x80) == 0x80; // Bit 7
        this.interrupcionEstadoEnLYCLY = (dato & 0x40) == 0x40; // Bit 6
        this.interrupcionEstadoEnModo2 = (dato & 0x20) == 0x20; // Bit 5
        this.interrupcionEstadoEnModo1 = (dato & 0x10) == 0x10; // Bit 4
        this.interrupcionEstadoEnModo0 = (dato & 0x08) == 0x08; // Bit 3
        this.LYCLYFlag = (dato & 0x04) == 0x04; // Bit 2
        this.ModeFlag = (dato & 0x03); // Bit 1 y 0
    }

    /**
     * Lee el estado del LCD
     * @returns 
     */
    leerLCDEstado(){
        return (
            (this.bitSinUsoEstado ? 1:0) << 7 |
            (this.interrupcionEstadoEnLYCLY ? 1:0) << 6 |
            (this.interrupcionEstadoEnModo2 ? 1:0) << 5 |
            (this.interrupcionEstadoEnModo1 ? 1:0) << 4 |
            (this.interrupcionEstadoEnModo0 ? 1:0) << 3 |
            (this.LYCLYFlag ? 1:0) << 2 |
            this.ModeFlag
        );
    }

    /** https://gbdev.io/pandocs/Palettes.html#ff47--bgp-non-cgb-mode-only-bg-palette-data
     * Escribe los valores para la paleta de grises.
     * @param {*} dato Dato de la paleta.
     * @returns 
     */
    escribirPaletaBGVentana(dato){
        this.paletaBGVent[0] = dato & 0x03; // Bit 0, 1: ID 0
        this.paletaBGVent[1] = (dato >> 2) & 0x03; // Bit 2, 3: ID 1
        this.paletaBGVent[2] = (dato >> 4) & 0x03; // Bit 4, 5: ID 2
        this.paletaBGVent[3] = (dato >> 6) & 0x03; // Bit 6, 7: ID 3
        return;
    }

    /**
     * Lee el valor de la paleta de grises.
     * @returns 
     */
    leerPaletaBGVentana(){
        return(
            this.paletaBGVent[0] |
            (this.paletaBGVent[1] << 2) |
            (this.paletaBGVent[2] << 4) |
            (this.paletaBGVent[3] << 6)
        )
    }

    /**
     * Inicia los registros de paleta
     * @param {number} dato 
     * @returns 
     */
    iniciarPaleta(dato){
        this.paletaBGVent[0] = dato & 0x03; // Bit 0, 1: ID 0
        this.paletaBGVent[1] = (dato >> 2) & 0x03; // Bit 2, 3: ID 1
        this.paletaBGVent[2] = (dato >> 4) & 0x03; // Bit 4, 5: ID 2
        this.paletaBGVent[3] = (dato >> 6) & 0x03; // Bit 6, 7: ID 3
        return;
    }

    /**
     * Escribe en el registro de paleta de objeto 0
     * @param {number} dato 
     * @returns 
     */
    escribirPaletaObj0(dato){
        this.paletaObj0[0] = dato & 0x03; // Bit 0, 1: ID 0
        this.paletaObj0[1] = (dato >> 2) & 0x03; // Bit 2, 3: ID 1
        this.paletaObj0[2] = (dato >> 4) & 0x03; // Bit 4, 5: ID 2
        this.paletaObj0[3] = (dato >> 6) & 0x03; // Bit 6, 7: ID 3
        return;
    }

    /**
     * Lee el registro de paleta de objeto 0
     * @returns 
     */
    leerPaletaObj0(){
        return(
            this.paletaObj0[0] |
            (this.paletaObj0[1] << 2) |
            (this.paletaObj0[2] << 4) |
            (this.paletaObj0[3] << 6)
        )
    }

    /**
     * Escribe el registro de paleta de objeto 1
     * @param {number} dato 
     * @returns 
     */
    escribirPaletaObj1(dato){
        this.paletaObj1[0] = dato & 0x03; // Bit 0, 1: ID 0
        this.paletaObj1[1] = (dato >> 2) & 0x03; // Bit 2, 3: ID 1
        this.paletaObj1[2] = (dato >> 4) & 0x03; // Bit 4, 5: ID 2
        this.paletaObj1[3] = (dato >> 6) & 0x03; // Bit 6, 7: ID 3
        return;
    }

    leerPaletaObj1(){
        return(
            this.paletaObj1[0] |
            (this.paletaObj1[1] << 2) |
            (this.paletaObj1[2] << 4) |
            (this.paletaObj1[3] << 6)
        )
    }

    /**
     * Define la posicion Y del objeto número i
     * @param {number} i 
     * @param {number} dato 
     */
    setObjYPos(i, dato){
        this.objetos[i].y = dato
    }

    /**
     * Devuelve la posicion Y del objeto número i
     * @param {number} i 
     * @returns 
     */
    getObjYPos(i){
        return this.objetos[i].y & 0xFF;
    }

    /**
     * Define la posicion X del objeto número i
     * @param {number} i 
     * @param {number} dato 
     */
    setObjXPos(i, dato){
        this.objetos[i].x = dato
    }

    /**
     * Define el indice del tile para el objeto i
     * @param {number} i 
     * @param {*} dato 
     */
    setObjTileIndice(i, dato){
        this.objetos[i].tileIndice = dato
    }

    /**
     * Se actualiza el valor de un objeto
     * @param {*} i 
     * @param {*} dato 
     */
    setObjAtributos(i, dato){
        this.objetos[i].prioridad = (dato & 0x80) == 0x80; // Bit 7
        this.objetos[i].yFlip = (dato & 0x40) == 0x40; // Bit 6
        this.objetos[i].xFlip = (dato & 0x20) == 0x20; // Bit 5
        this.objetos[i].paletaDMG = (dato & 0x10) >> 4; // Bit 4
        this.objetos[i].banco = (dato & 0x08) == 0x08; // Bit 3
        this.objetos[i].paletaCGB = dato & 0x07 // Bits 2, 1 y 0
    }

    /**
     * Se devuelven los atributos del objeto i
     * @param {number} i 
     * @returns 
     */
    getObjAtributos(i){
        return(
            (this.objetos[i].prioridad ? 1:0) << 7 |
            (this.objetos[i].yFlip ? 1:0) << 6 |
            (this.objetos[i].xFlip ? 1:0) << 5 |
            this.objetos[i].paletaDMG << 4 |
            this.objetos[i].banco << 3 |
            this.objetos[i].paletaCGB
        );
    }
}
