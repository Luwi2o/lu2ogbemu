//Pantalla de GB

// La pantalla usada por el Chip-8 era monocromatica y tenia una resolucion de 64x32 pixeles.
// Chip-8 dibuja en la pantalla por medio de sprites. Los sprites se forman de bytes que
// representan la imagen a dibujar. Un sprite puede estar formado de hasta 15 bytes.
const ALTO_PANTALLA = 144
const ANCHO_PANTALLA = 160
class Pantalla{

    /** Constructor
     * 
     * @param {Memoria} memoria 
     * @param {RegistrosLCD} regLCD 
     * @param {Interrupciones} ints
     */
    constructor(regLCD, ints, estado){

        // Si existe un archivo de estado se cargan los datos de este
        if(estado){
            this.cargarEstado(estado);
        } else {
            this.modo = 2;
            this.dots = 0;
            this.linea = 0; // Contador de linea
            this.lineaVentana = 0; // Contador interno de linea de ventana
            this.ventanaVisible = false; // Condicion si la ventana ha sido visible en una linea
        }
        this.regLCD = regLCD;
        this.ints = ints;

        this.escala = 1;

        this.terminada = false;

        this.canvas = document.getElementById("gameboy-canvas");
        this.contexto = this.canvas.getContext("2d", { alpha: false });
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.lcd = this.contexto.createImageData(160, 144);
    }

    cargarEstado(estado){
        var s = estado.pantalla;
        
        this.modo = s.modo;
        this.dots = s.dots;
        this.linea = s.linea; // Contador de linea
        this.lineaVentana = s.lineaVentana; // Contador interno de linea de ventana
        this.ventanaVisible = s.ventanaVisible; // Condicion si la ventana ha sido visible en una linea
    }

    /**
     * 
     */
    dibujarLinea(){

        // this.memoria.actualizarReg8bits(GB_PANTALLA_REG_LY_COORD, this.linea);
        this.regLCD.condicionWX = false;


        // La ventana tiene un contador interno de linea cuya funcionalidad es similar a la 
        // de LY, y se incrementa con ella. Sin embargo solo se incrementa si la
        // ventana es visible.
        // Este contador determina que linea hay que renderizar en la linea actual.


        // En cada escaneo del OAM la PPU compara LY con las posiciones de hasta 10 objetos
        // para ser dibujados en cada linea

        var listaObjetos = []
        var numObjetosEnLinea = 0;
        var alturaObjeto = !this.regLCD.tamanyoObjeto ? 8 : 16;
        // Hasta que se hayan recorrido todos los objetos del oam o el num de objetos sea mayor a 10
        for(var i = 0; i < this.regLCD.objetos.length && numObjetosEnLinea < 10; i++){

            var objeto = this.regLCD.objetos[i]
            if(this.regLCD.lineaY >= (objeto.y - 16)
                    && this.regLCD.lineaY < (objeto.y - 16) + alturaObjeto){
                //Objeto en linea
                listaObjetos.push(objeto);
                numObjetosEnLinea++;
            }
        }

        if(this.regLCD.windowX <= 7) this.regLCD.condicionWX = true;

        for(var x = 0; x < GB_PANTALLA_ANCHO; x++){
            var tileX = 0;
            var tileY = 0;

            this.regLCD.currentX = x;

            var pixel = 0;
            var indicePaleta = 0;

            //
            if(this.regLCD.BGWindowEnable){

                // https://gbdev.io/pandocs/pixel_fifo.html#get-tile
                // Este paso determina de que tile de bg/window se consigue el pixel.
                // Por defecto el tilemap que se usa es el 0x9800 pero algunas condiciones pueden
                // cambiar esto.
                var tileMapInicio = 0x9800;

                // WY condition was triggered: i.e. at some point in this frame the value of 
                // WY was equal to LY (checked at the start of Mode 2 only)
                if(this.regLCD.windowY == this.regLCD.lineaY) {
                    this.regLCD.condicionWY = true;
                }

                // CondicionWX se ha activado. La coordenada de X actual que se esta renderizando
                // es igual a WX
                if(this.regLCD.currentX + 7 == this.regLCD.windowX){
                    this.regLCD.condicionWX = true;
                }

                // Se encuentra dentro de una ventana si las dos condiciones se dan a la vez
                var dentroDeVentana = this.regLCD.condicionWY && this.regLCD.condicionWX && this.regLCD.windowEnable;
                if(dentroDeVentana){
                    this.ventanaVisible = true;
                }
                
                // Si el bit 3 de LCDC (BGTileMapArea) esta activado
                // y la coordenada X de la linea de scan actual no se encuentra de dentro de la ventana
                // entonces se usa el tilemap 0x9C00.
                if(!dentroDeVentana && this.regLCD.BGTileMapArea){
                    tileMapInicio = 0x9C00;
                }

                // Si el bit 6 de LCDC (windowTileMapArea) esta activado 
                // y la coordenada X de la linea de scan actual se encuentra dentro de la ventana 
                // entonces se usa el tilemap 0x9C00
                if(dentroDeVentana && this.regLCD.windowTileMapArea){
                    tileMapInicio = 0x9C00;
                }

                // Seleccinando el indice del tile en VRAM
                if(dentroDeVentana){
                    // Si se encuentra dentro de una ventana
                    // +7 para compensar el offset a la izquierda de la ventana
                    var pXTile = x - this.regLCD.windowX + 7; 
                    var pYTile = this.lineaVentana;
                    tileX = (Math.floor((pXTile / 8)));
                    tileY = (Math.floor((pYTile / 8)));
                } else if(!dentroDeVentana){
                    var pXTile = this.regLCD.scrollX + x;
                    var pYTile = this.regLCD.lineaY + this.regLCD.scrollY;
                    tileX = (Math.floor((pXTile)/8)) % 32;
                    tileY = (Math.floor((pYTile)/8)) % 32
                }
                var dirTileFetch = tileMapInicio + (tileY * 32) + tileX;
                // Se carga el tile de VRAM
                var tileFetch = this.regLCD.vRAM[dirTileFetch - 0x8000];

                // Check LCDC.4 for which tilemap to use. Once the tilemap, 
                // VRAM and vertical flip is calculated the tile data is retrieved from VRAM.
                // However, if the PPU’s access to VRAM is blocked then the tile data is read as $FF.
                // The tile data retrieved in this step will be used in the push steps.
                // BG and Window tile data area

                var BGWindowAreaInicio = 0x8000;

                // https://gbdev.io/pandocs/Tile_Data.html
                // Hay dos metodos para indexar, el primero usa 0x8000 como puntero y utiliza una 
                // direccion sin signo, significando que las tiles 0-127 estan en el bloque 0, y
                // las tiles 128-255
                if(this.regLCD.BGWindowTileDataArea){
                    BGWindowAreaInicio = 0x8000;
                    tileFetch = tileFetch;
                } else {
                    BGWindowAreaInicio = 0x9000;
                    if(tileFetch >= 128) {
                        tileFetch = tileFetch - 256;
                    } else {
                        tileFetch = tileFetch;
                    }
                }

                // Indice del dato de
                var indiceByte = 0;
                if(dentroDeVentana){
                    indiceByte = ((tileFetch * 0x10) + ((this.lineaVentana * 2) % 16));
                } else {
                    indiceByte = ((tileFetch * 16) + (((this.linea + this.regLCD.scrollY) * 2) % 16));
                }

                var tileDataLowFetch = this.regLCD.vRAM[(BGWindowAreaInicio + indiceByte) - 0x8000];
                var tileDataHighFetch = this.regLCD.vRAM[(BGWindowAreaInicio + indiceByte + 1) - 0x8000];

                // Se coge el indice del pixel
                var indicePixel = 0;
                if(dentroDeVentana){
                    indicePixel = (x - this.regLCD.windowX + 7) % 8
                } else {
                    indicePixel = (x + this.regLCD.scrollX) % 8
                }

                if((tileDataLowFetch & (0x80 >> indicePixel)) != 0) indicePaleta += 0x01;
                if((tileDataHighFetch & (0x80 >> indicePixel)) != 0) indicePaleta += 0x02;

                // Se elige el color del valor
                if(dentroDeVentana){
                    pixel = this.regLCD.valorColorRojo[this.regLCD.paletaBGVent[indicePaleta]];
                }
                else{
                    pixel = this.regLCD.valorColor[this.regLCD.paletaBGVent[indicePaleta]];
                }

            }
            else {
                // Pixel blanco
                pixel = this.regLCD.valorColor[0];
            }


            if(this.regLCD.objEnable){
                // Escaneo de objetos
                // Se recorren todos los objetos que se pueden dibujar en la linea
                for(var o = 0; o < listaObjetos.length; o++){
                    // Si la coordenada x se encuentra dentro del objeto este se dibuja
                    if(listaObjetos[o].x >= x && listaObjetos[o].x < (x + 8)){
                        var objIndicePaleta = 0;
                        var objAreaInicio = 0x8000;

                        var objTileFetch = (!this.regLCD.tamanyoObjeto) ?
                            listaObjetos[o].tileIndice :
                            (listaObjetos[o].tileIndice & 0xfe); 
                            // ^ Se ignora el bit 0 para objetos 8x16
                        

                        // pos y del pixel dentro del obj
                        var posYRel = 0;
                        var numeroByte = 0;
                        if(!listaObjetos[o].yFlip){
                            posYRel = this.regLCD.lineaY - (listaObjetos[o].y - 16);
                            numeroByte = Math.floor(posYRel / 8);
                        } else {
                            posYRel = (alturaObjeto - 1) - (this.regLCD.lineaY - (listaObjetos[o].y - 16));
                            numeroByte = 1 - Math.floor(posYRel / 8);
                        }
                        // Si el objeto esta formado por dos tiles se calcula cual de los dos son

                        var posXRel = 0;
                        if(!listaObjetos[o].xFlip){
                            // pos x del pixel dentro del obj, - 7 para compensar el offset en x
                            posXRel = x - (listaObjetos[o].x - 7); 
                        } else {
                            posXRel = 7 - ( x - (listaObjetos[o].x - 7)); 
                        }
                        
                        // [puntero inicio tile] = [indice tile] * [tamanyo de tiles(16 bytes)]
                        // [offset tile] = [posicion y coordenada relativa y] * [num bytes por(posrelativa) (2)]
                        // [offsetinicioenbytesdelprincipio] = [puntero inicio tile] + [offset tile] % 16
                        var objTileAreaOffset =  (objTileFetch * 16) + ((posYRel * 2) + (numeroByte * 16) % 16)

                        var objTileDataLowFetch = 
                            this.regLCD.vRAM[objAreaInicio + objTileAreaOffset - 0x8000];
                        var objTileDataHighFetch = 
                            this.regLCD.vRAM[objAreaInicio + objTileAreaOffset + 1 - 0x8000];

                        if((objTileDataLowFetch & (0x80 >> (posXRel % 8))) != 0) objIndicePaleta += 0x01;
                        if((objTileDataHighFetch & (0x80 >> (posXRel % 8))) != 0) objIndicePaleta += 0x02;

                        var valorObj = 0;
                        // Paleta de Objeto 0
                        if(listaObjetos[o].paletaDMG == 0){
                            valorObj = this.regLCD.paletaObj0[objIndicePaleta];
                        // Paleta de Objeto 1
                        } else {
                            valorObj = this.regLCD.paletaObj1[objIndicePaleta];
                        }
                        
                        if(!listaObjetos[o].prioridad){
                            // El indice 0 es transparente por lo que se ignora
                            if(objIndicePaleta != 0) pixel = this.regLCD.valorColor[valorObj];
                        } else if (pixel == this.regLCD.valorColor[0]) {
                            if(objIndicePaleta != 0) pixel = this.regLCD.valorColor[valorObj];
                        }

                    }
                }
            }

            // Se dibuja el pixel que sea en el canvas
            var indiceCanvas = (x + this.linea * GB_PANTALLA_ANCHO) * 4;
            this.lcd.data[ indiceCanvas ] = pixel[0];
            this.lcd.data[ indiceCanvas + 1] = pixel[1];
            this.lcd.data[ indiceCanvas + 2] = pixel[2];
            this.lcd.data[ indiceCanvas + 3] = pixel[3];

            if(this.regLCD.lineaY == 79){
                this.lcd.data[ indiceCanvas ] = 10;
                this.lcd.data[ indiceCanvas + 1] = 100;
                this.lcd.data[ indiceCanvas + 2] = 10;
                this.lcd.data[ indiceCanvas + 3] = 255;
            }

        }
    }

    cambiarEscala(escala){
        this.escala = escala;
    }

    dibujarPantalla(){
        this.contexto.putImageData(this.scaleImageData(this.lcd, this.escala), 0, 0);
    }

    scaleImageData(imageData, scale) {
        var scaled = this.contexto.createImageData(imageData.width * scale, imageData.height * scale);
      
        for(var row = 0; row < imageData.height; row++) {
            for(var col = 0; col < imageData.width; col++) {
                var sourcePixel = [
                    imageData.data[(row * imageData.width + col) * 4 + 0],
                    imageData.data[(row * imageData.width + col) * 4 + 1],
                    imageData.data[(row * imageData.width + col) * 4 + 2],
                    imageData.data[(row * imageData.width + col) * 4 + 3]
                ];
                for(var y = 0; y < scale; y++) {
                    var destRow = row * scale + y;
                    for(var x = 0; x < scale; x++) {
                        var destCol = col * scale + x;
                        for(var i = 0; i < 4; i++) {
                            scaled.data[(destRow * scaled.width + destCol) * 4 + i] =
                                sourcePixel[i];
                        }
                    }
                }
            }
        }
        return scaled;
    }


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
                        console.log("interrupcion modo0 ")
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
                            console.log("interrupcion LYCLY " + this.regLCD.lineaY)
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

