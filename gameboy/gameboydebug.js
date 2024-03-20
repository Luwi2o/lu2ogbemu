class Debug{

    constructor(gameboy){
        this.canvas = document.getElementById("gameboy-debug-canvas");
        this.contexto = this.canvas.getContext("2d", { alpha: false });
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.gameboy = gameboy;
        this.lineY = 0;

        document.getElementById("boton-paso").addEventListener("mousedown", ()=>{
            if(this.gameboy.cPUDebug.pausado){
                this.gameboy.paso();
            } else {
                console.log("CPU no esta pausada")
            }
        });

        document.getElementById("boton-continuar").addEventListener("mousedown", ()=>{
            if(this.gameboy.cPUDebug.pausado){
                this.gameboy.continuar();
            } else {
                this.gameboy.pausar();
            }
        });

        document.getElementById("boton-continuar-sinpausa").addEventListener("mousedown", ()=>{
            if(this.gameboy.cPUDebug.pausado){
                this.gameboy.continuarSinPausa();
            } else {
                this.gameboy.pausar();
            }
        });

    }


    
    empezar(){

        var gameboy = this.gameboy;
        var contexto = this.contexto;

        function crearImagenVRAM(){

            var lineY = 0;
            
            for(var y = 0; y < GB_PANTALLA_ALTO; y++){
                for(var x = 0; x < GB_PANTALLA_ANCHO; x++){
                    lineY = y;
                    var pixel = 0;
                    var tileMapInicio = 0x9800;
                    //(byte 8 bits), 16bits *
                    //var fetchX = (Math.floor(0 / 8) + x) & 0x1F;
                    //var fetchY = (y + 0) & 255

                    //var dirTileFetch = tileMapInicio + (fetchY * 255) + fetchX;
                    var dirTileFetch = Math.floor(x / 8)// + (32) * y
                    var tileFetch = gameboy.memoria.leer8Bits(tileMapInicio + dirTileFetch);

                    //Check LCDC.4 for which tilemap to use. Once the tilemap, 
                    //VRAM and vertical flip is calculated the tile data is retrieved from VRAM.
                    //However, if the PPU’s access to VRAM is blocked then the tile data is read as $FF.
                    //The tile data retrieved in this step will be used in the push steps.
                    //BG and Window tile data area
                    var fuckX = (Math.floor( (x*2) / 16) * 16)
                    var fuckY = (y*2) % 16 + Math.floor(y/8) * (32 * 10)
                    var fuck = fuckX + fuckY
                    var tileDataLowFetch = gameboy.memoria.leer8Bits(tileFetch);
                    var tileDataHighFetch = gameboy.memoria.leer8Bits(tileFetch + 1);
                    var tileDataLowFetch = gameboy.memoria.leer8Bits(0x8360 + fuck );
                    var tileDataHighFetch = gameboy.memoria.leer8Bits(0x8360 + fuck + 1 );
                    //if(tileDataHighFetch > 0)console.log("ha dibujado ALGO")

                    pixel = 0;
                    if((tileDataLowFetch & (0x80 >> (x % 8))) != 0) pixel += 0x01;
                    if((tileDataHighFetch & (0x80 >> (x % 8))) != 0) pixel += 0x02;

                    switch(pixel){
                        case 0: contexto.fillStyle = '#000000'; break;
                        case 1: contexto.fillStyle = '#888888'; break;
                        case 2: contexto.fillStyle = '#CCCCCC'; break;
                        case 3: contexto.fillStyle = '#FFFFFF'; break;
                        default: console.error("Error dibujando, tipo de pixel no valido")
                    }
                    contexto.fillRect(x * GB_PANTALLA_ESCALADO, y * GB_PANTALLA_ESCALADO,
                        GB_PANTALLA_ESCALADO, GB_PANTALLA_ESCALADO);
                    
                }
            }
            for(var y = 144; y < 153; y++){
            }
        }

        function mostrarRegistrosCPU(){
            document.getElementById("regAF").innerHTML =
                gameboy.cpu.registros.R[A].toString(16).padStart(2, '0') + 
                gameboy.cpu.registros.R[F].toString(16).padStart(2, '0');
    
            document.getElementById("regBC").innerHTML =
                gameboy.cpu.registros.R[B].toString(16).padStart(2, '0') + 
                gameboy.cpu.registros.R[C].toString(16).padStart(2, '0');
    
            document.getElementById("regDE").innerHTML =
                gameboy.cpu.registros.R[D].toString(16).padStart(2, '0') + 
                gameboy.cpu.registros.R[E].toString(16).padStart(2, '0');
    
            document.getElementById("regHL").innerHTML =
                gameboy.cpu.registros.R[H].toString(16).padStart(2, '0') + 
                gameboy.cpu.registros.R[L].toString(16).padStart(2, '0');
    
            document.getElementById("regPC").innerHTML =
                gameboy.cpu.registros.PC.toString(16).padStart(4, '0');
    
            document.getElementById("regSP").innerHTML =
                gameboy.cpu.registros.SP.toString(16).padStart(4, '0');
        }

        function mostrarFlagsCPU(){
            document.getElementById("flagZ").innerHTML = gameboy.cpu.Z;
            document.getElementById("flagN").innerHTML = gameboy.cpu.N;
            document.getElementById("flagH").innerHTML = gameboy.cpu.H;
            document.getElementById("flagC").innerHTML = gameboy.cpu.C;
        }

        function mostrarRegistrosMemoria(){
            document.getElementById("regLCDC").innerHTML =
            gameboy.regLCD.leerLCDControl().toString(16).padStart(4, '0');

            document.getElementById("regSTAT").innerHTML =
                gameboy.regLCD.leerLCDEstado().toString(16).padStart(4, '0');

            document.getElementById("regLYC").innerHTML =
                gameboy.regLCD.lineaY.toString(16).padStart(4, '0');

            document.getElementById("regIE").innerHTML =
                gameboy.regInt.leerIE().toString(16).padStart(4, '0');

            document.getElementById("regIF").innerHTML =
                gameboy.regInt.leerIF().toString(16).padStart(4, '0');
        }

        function mostrarPila(){
            var pilaStr = "";
            var memPila = gameboy.cpu.registros.SP;
            var ventanaPilaAlto = 0;
            var ventanaPilaBajo = 0;
            if(memPila + 20 > 0xFFFF){
                ventanaPilaAlto = 0xFFFF;
                ventanaPilaBajo = 0xFFFF - 40;
            } else if(memPila - 20 < 0){
                ventanaPilaBajo = 0;
                ventanaPilaAlto = 40;
            } else {
                ventanaPilaBajo = memPila - 20
                ventanaPilaAlto = memPila + 20
            }
            for(var i = ventanaPilaBajo; i <= ventanaPilaAlto; i += 2 ){
                var strMemH = gameboy.memoria.leer8Bits(i).toString(16).padStart(2, '0');
                var strMemL = gameboy.memoria.leer8Bits(i + 1).toString(16).padStart(2, '0');
                var esSP = gameboy.cpu.registros.SP == i;
                if(strMemH != undefined && strMemL != undefined){
                    var strColor = "";
                    var strEsPila = "";
                    if(esSP){
                        strColor = " style='background-color:powderblue;' "
                        strEsPila = "<"
                    }
                    pilaStr +=
                    "<div class='register-container'"+strColor+">"+
                        "<div class='register'>"+
                            "<div class='register'>$"+i.toString(16).padStart(4, '0')+":</div>"+
                            "<div class='register'>"+strMemH+strMemL+strEsPila+"</div>"+
                        "</div>"+
                    "</div>";
                    
                }
            }

            document.getElementById("pila").innerHTML = pilaStr;
        }

        function mostrarMemoria(){
            var memoriaStr = ""
            var PC = gameboy.cpu.anteriorPC;
            var filaPC = PC >> 4
            var ventanaMemAlto = 0;
            var ventanaMemBajo = 0;
            if(filaPC + 4 > 0xFFF){
                ventanaMemBajo = 0xFFF - 8;
                ventanaMemAlto = 0xFFF;
            } else if(filaPC - 4 < 0){
                ventanaMemBajo = 0;
                ventanaMemAlto = 8;
            } else {
                ventanaMemBajo = filaPC - 4
                ventanaMemAlto = filaPC + 4
            }
            for(var i = ventanaMemBajo; i <= ventanaMemAlto; i++){

                var dirStr = (i << 4).toString(16).padStart(4, "0")
                memoriaStr += "<div><span>$"+dirStr+":</span>";

                for(var j = 0; j < 16; j++){
                    var indice = ((i << 4) + j)
                    var colorStr = "";
                    var valorStr = gameboy.memoria.leer8Bits(indice).toString(16).padStart(2, '0');
                    if(indice == PC){
                        colorStr = "style='background-color:powderblue;'"
                    }
                    memoriaStr += "<span "+colorStr+">"+valorStr+"</span>";
                    if(j == 7){
                        memoriaStr += "<span>|</span>";
                    }
                }

                memoriaStr += "</div>";
            }
            document.getElementById("memoria").innerHTML = memoriaStr;
        }

        var renderVRAM = function(){
            setTimeout(function() {
                window.requestAnimationFrame(renderVRAM);

                mostrarPila()
                document.getElementById("gameboy-debug-logs").innerHTML = 
                    gameboy.cPUDebug.instruccionPC + ": codigo: " +gameboy.cPUDebug.codigoStr + 
                    ", instr: " + gameboy.cPUDebug.instruccionStr + "</br>" +
                    gameboy.cPUDebug.flagsStr + "</br>" +
                    gameboy.cPUDebug.registrosStr + " " +  gameboy.cPUDebug.registros16Str + "</br>" +
                    gameboy.memoria.memoriaStr + "</br>"
                
                document.getElementById("instruccion").innerHTML = gameboy.cPUDebug.instruccionPC + 
                    ": codigo: " +gameboy.cPUDebug.codigoStr + ", instr: " + gameboy.cPUDebug.instruccionStr;
                
                document.getElementById("windowX").innerHTML = gameboy.regLCD.windowX;

                document.getElementById("windowY").innerHTML = gameboy.regLCD.windowY;

                mostrarRegistrosCPU();

                mostrarFlagsCPU();

                mostrarRegistrosMemoria();
                
                mostrarMemoria()
            
                //crearImagenVRAM()
            }, 100)
        }

        renderVRAM(0)
    }

}