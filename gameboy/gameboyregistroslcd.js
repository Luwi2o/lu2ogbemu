class Objeto {
    constructor(){
        this.y = 0x00;
        this.x = 0x00;
        this.tileIndice = 0x00;
        this.prioridad = false;
        this.xFlip = false;
        this.yFlip = false;
        this.paletaDMG = 0;
        this.banco = 0;
        this.paletaCGB = 0;

    }
}


class RegistrosLCD {


    /** Constructor
     * 
     * @param {*} 
     */
    constructor(tipoConsola, estado){

        this.vRAM = new Uint8Array(0x2000).fill(0); // RAM de video

        this.linea = 0;
        this.condicionWX = false;
        this.condicionWY = false;
        this.modo = 2;

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


        this.paletaBGVent = [0, 1, 2, 3];
        // https://gbdev.io/pandocs/Palettes.html#ff48ff49--obp0-obp1-non-cgb-mode-only-obj-palette-0-1-data
        this.paletaObj0 = [0, 1, 2, 3];
        this.paletaObj1 = [0, 1, 2, 3];

        this.objetos = new Array();
        for(var i = 0; i < 40; i++){
            this.objetos.push(new Object());
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
        this.LCDEnable = false;
        this.windowTileMapArea = false; //0=9800-9BFF, 1=9C00-9FFF
        this.windowEnable = false;
        this.BGWindowTileDataArea = false; //0=8800-97FF, 1=8000-8FFF
        this.BGTileMapArea = false; //0=9800-9BFF, 1=9C00-9FFF
        this.tamanyoObjeto = false;
        this.objEnable = false; 
        this.BGWindowEnable = false;

        // https://gbdev.io/pandocs/STAT.html
        this.bitSinUsoEstado = false;
        this.interrupcionEstadoEnLYCLY = false;
        this.interrupcionEstadoEnModo2 = false;
        this.interrupcionEstadoEnModo1 = false;
        this.interrupcionEstadoEnModo0 = false;
        this.LYCLYFlag = false;
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
     * 
     * @returns el dato del registro de control
     */
    leerLCDControl(){
        return (
            this.LCDEnable << 7 |
            this.windowTileMapArea << 6 |
            this.windowEnable << 5 |
            this.BGWindowTileDataArea << 4 |
            this.BGTileMapArea << 3 |
            this.tamanyoObjeto << 2 |
            this.objEnable << 1 |
            this.BGWindowEnable
        );
    }

    /**
     * 
     * @param {number} dato 
     */
    escribirLCDEstado(dato){
        // Bit 7
        this.bitSinUsoEstado = (dato & 0x80) == 0x80;
        // Bit 6
        this.interrupcionEstadoEnLYCLY = (dato & 0x40) == 0x40;
        // Bit 5
        this.interrupcionEstadoEnModo2 = (dato & 0x20) == 0x20;
        // Bit 4
        this.interrupcionEstadoEnModo1 = (dato & 0x10) == 0x10;
        // Bit 3
        this.interrupcionEstadoEnModo0 = (dato & 0x08) == 0x08;
        // Bit 2 LYC = LY Solo lectura
        // Bit 1 y 0 PPU modo Solo lectura
    }

    /**
     * 
     * @param {number} dato 
     */
    iniciarLCDEstado(dato){
        // Bit 7
        this.bitSinUsoEstado = (dato & 0x80) == 0x80;
        // Bit 6
        this.interrupcionEstadoEnLYCLY = (dato & 0x40) == 0x40;
        // Bit 5
        this.interrupcionEstadoEnModo2 = (dato & 0x20) == 0x20;
        // Bit 4
        this.interrupcionEstadoEnModo1 = (dato & 0x10) == 0x10;
        // Bit 3
        this.interrupcionEstadoEnModo0 = (dato & 0x08) == 0x08;
        // Bit 2
        this.LYCLYFlag = (dato & 0x04) == 0x04;
        // Bit 1 y 0
        this.ModeFlag = (dato & 0x03);
    }

    /**
     * 
     * @returns 
     */
    leerLCDEstado(){
        return (
            this.bitSinUsoEstado << 7 |
            this.interrupcionEstadoEnLYCLY << 6 |
            this.interrupcionEstadoEnModo2 << 5 |
            this.interrupcionEstadoEnModo1 << 4 |
            this.interrupcionEstadoEnModo0 << 3 |
            this.LYCLYFlag << 2 |
            this.ModeFlag
        );
    }

    /** https://gbdev.io/pandocs/Palettes.html#ff47--bgp-non-cgb-mode-only-bg-palette-data
     * Escribe los valores para la paleta de grises.
     * @param {*} dato Dato de la paleta.
     * @returns 
     */
    escribirPaletaBGVentana(dato){
        // Bit 0, 1: ID 0
        this.paletaBGVent[0] = dato & 0x03;
        // Bit 2, 3: ID 1
        this.paletaBGVent[1] = (dato >> 2) & 0x03;
        // Bit 4, 5: ID 2
        this.paletaBGVent[2] = (dato >> 4) & 0x03;
        // Bit 6, 7: ID 3
        this.paletaBGVent[3] = (dato >> 6) & 0x03;
        return;
    }

    leerPaletaBGVentana(){
        return(
            this.paletaBGVent[0] |
            (this.paletaBGVent[1] << 2) |
            (this.paletaBGVent[2] << 4) |
            (this.paletaBGVent[3] << 6)
        )
    }

    iniciarPaleta(dato){
        // Bit 0, 1: ID 0
        this.paletaBGVent[0] = dato & 0x03;
        // Bit 2, 3: ID 1
        this.paletaBGVent[1] = (dato >> 2) & 0x03;
        // Bit 4, 5: ID 2
        this.paletaBGVent[2] = (dato >> 4) & 0x03;
        // Bit 6, 7: ID 3
        this.paletaBGVent[3] = (dato >> 6) & 0x03;
        return;
    }

    escribirPaletaObj0(dato){
        // Bit 0, 1: ID 0
        this.paletaObj0[0] = dato & 0x03;
        // Bit 2, 3: ID 1
        this.paletaObj0[1] = (dato >> 2) & 0x03;
        // Bit 4, 5: ID 2
        this.paletaObj0[2] = (dato >> 4) & 0x03;
        // Bit 6, 7: ID 3
        this.paletaObj0[3] = (dato >> 6) & 0x03;
        return;
    }

    leerPaletaObj0(){
        return(
            this.paletaObj0[0] |
            (this.paletaObj0[1] << 2) |
            (this.paletaObj0[2] << 4) |
            (this.paletaObj0[3] << 6)
        )
    }

    escribirPaletaObj1(dato){
        // Bit 0, 1: ID 0
        this.paletaObj1[0] = dato & 0x03;
        // Bit 2, 3: ID 1
        this.paletaObj1[1] = (dato >> 2) & 0x03;
        // Bit 4, 5: ID 2
        this.paletaObj1[2] = (dato >> 4) & 0x03;
        // Bit 6, 7: ID 3
        this.paletaObj1[3] = (dato >> 6) & 0x03;
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

    setObjYPos(i, dato){
        this.objetos[i].y = dato
    }

    getObjYPos(i){
        return this.objetos[i].y & 0xFF;
    }

    setObjXPos(i, dato){
        this.objetos[i].x = dato
    }

    setObjTileIndice(i, dato){
        this.objetos[i].tileIndice = dato
    }

    /**
     * Se actualiza el valor de un
     * @param {*} i 
     * @param {*} dato 
     */
    setObjAtributos(i, dato){
        // Bit 7
        this.objetos[i].prioridad = (dato & 0x80) == 0x80;
        // Bit 6
        this.objetos[i].yFlip = (dato & 0x40) == 0x40;
        // Bit 5
        this.objetos[i].xFlip = (dato & 0x20) == 0x20;
        // Bit 4
        this.objetos[i].paletaDMG = (dato & 0x10) >> 4;
        // Bit 3
        this.objetos[i].banco = (dato & 0x08) == 0x08;
        // Bits 2, 1 y 0
        this.objetos[i].paletaCGB = dato & 0x07
    }

    getObjAtributos(i){
        return(
            this.objetos[i].prioridad << 7 |
            this.objetos[i].yFlip << 6 |
            this.objetos[i].xFlip << 5 |
            this.objetos[i].paletaDMG << 4 |
            this.objetos[i].banco << 3 |
            this.objetos[i].paletaCGB
        );
    }
}