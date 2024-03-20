function cargarArchivoGuardado() {
    document.getElementById("archivo-guardado").click();
};

function cargarArchivoROM() {
    document.getElementById("archivo-rom").click();
};

function cargarArchivoBoot() {
    document.getElementById("archivo-boot").click();
};

var estado;
var guardado;

document.getElementById("archivo-guardado").addEventListener('change', function() {
    // Lector de archivo de guardado
    var reader = new FileReader();
    
    reader.onload = function() {
        var guardadoBuffer = this.result;
        guardado = new Uint8Array(guardadoBuffer);
        console.log(guardado);
    }
    reader.readAsArrayBuffer(this.files[0]);
  
}, false);

document.getElementById("archivo-rom").addEventListener('change', function() {
    // Lector de archivo de ROM
    var reader = new FileReader();
    
    reader.onload = function() {

        var arrayBuffer = this.result;
        // Se inicia el buffer con el ROM
        rom = new Uint8Array(arrayBuffer);
        var gameboy = new Gameboy(rom, guardado);

        //gameboy.pausarEn(0x100);

        var debug = new Debug(gameboy);
        // Se inicia la ejecucion del emulador
        gameboy.iniciar();
        debug.empezar();

        // Se mapean los eventos con los botones
        mapear(gameboy)
        
        gameboy.sonido.actualizarVolumen(0.01);
        console.log("volumen cambiado a:" + 0.01);

        var volumen = document.getElementById('volumen');
        volumen.addEventListener("change", function(e) {
            var nuevoVolumen = e.currentTarget.value / 100.0;
            gameboy.sonido.actualizarVolumen(nuevoVolumen);
            console.log("volumen cambiado a:" + nuevoVolumen);
        })

        var botonDescargarGuardado = document.getElementById('boton-descargar-guardado');
        botonDescargarGuardado.addEventListener("click", function(e) {
            console.log("GUARDANDO")
            var filename = "save.sav"
            const a = document.createElement('a')
            const blob = new Blob([gameboy.memoria.sRAM]);
            const url = URL.createObjectURL(blob)
            a.setAttribute('href', url)
            a.setAttribute('download', filename)
            a.click()
        })


    }
    reader.readAsArrayBuffer(this.files[0]);
  
}, false);

document.getElementById("archivo-boot").addEventListener('change', function() {
    // Lector de archivo de boot
    var reader = new FileReader();
    
    reader.onload = function() {
        var bootBuffer = this.result;
        boot = new Uint8Array(bootBuffer);
        console.log(boot.toString());
    }
    reader.readAsArrayBuffer(this.files[0]);
  
}, false);


function mapear(gameboy){
    document.getElementById("boton-a").addEventListener("mousedown", ()=>{gameboy.pulsar(BOTON_A)});
    document.getElementById("boton-a").addEventListener("mouseup", ()=>{gameboy.soltar(BOTON_A)});
    document.getElementById("boton-b").addEventListener("mousedown", ()=>{gameboy.pulsar(BOTON_B)});
    document.getElementById("boton-b").addEventListener("mouseup", ()=>{gameboy.soltar(BOTON_B)});
    document.getElementById("boton-select").addEventListener("mousedown", ()=>{gameboy.pulsar(BOTON_SELECT)});
    document.getElementById("boton-select").addEventListener("mouseup", ()=>{gameboy.soltar(BOTON_SELECT)});
    document.getElementById("boton-start").addEventListener("mousedown", ()=>{gameboy.pulsar(BOTON_START)});
    document.getElementById("boton-start").addEventListener("mouseup", ()=>{gameboy.soltar(BOTON_START)});
    document.getElementById("boton-arriba").addEventListener("mousedown", ()=>{gameboy.pulsar(BOTON_ARRIBA)});
    document.getElementById("boton-arriba").addEventListener("mouseup", ()=>{gameboy.soltar(BOTON_ARRIBA)});
    document.getElementById("boton-izquierda").addEventListener("mousedown", ()=>{gameboy.pulsar(BOTON_IZQUIERDA)});
    document.getElementById("boton-izquierda").addEventListener("mouseup", ()=>{gameboy.soltar(BOTON_IZQUIERDA)});
    document.getElementById("boton-derecha").addEventListener("mousedown", ()=>{gameboy.pulsar(BOTON_DERECHA)});
    document.getElementById("boton-derecha").addEventListener("mouseup", ()=>{gameboy.soltar(BOTON_DERECHA)});
    document.getElementById("boton-abajo").addEventListener("mousedown", ()=>{gameboy.pulsar(BOTON_ABAJO)});
    document.getElementById("boton-abajo").addEventListener("mouseup", ()=>{gameboy.soltar(BOTON_ABAJO)});

    addEventListener("keydown", (event) => {
        switch(event.code){
            case "KeyA": gameboy.pulsar(BOTON_IZQUIERDA); break;
            case "KeyS": gameboy.pulsar(BOTON_ABAJO); break;
            case "KeyW": gameboy.pulsar(BOTON_ARRIBA); break;
            case "KeyD": gameboy.pulsar(BOTON_DERECHA); break;

            case "KeyK": gameboy.pulsar(BOTON_B); break;
            case "KeyL": gameboy.pulsar(BOTON_A); break;
            case "KeyH": gameboy.pulsar(BOTON_SELECT); break;
            case "KeyJ": gameboy.pulsar(BOTON_START); break;
            default: console.log("Tecla no mapeada: " + event.code);
        }
    });

    addEventListener("keyup", (event) => {
        switch(event.code){
            case "KeyA": gameboy.soltar(BOTON_IZQUIERDA); break;
            case "KeyS": gameboy.soltar(BOTON_ABAJO); break;
            case "KeyW": gameboy.soltar(BOTON_ARRIBA); break;
            case "KeyD": gameboy.soltar(BOTON_DERECHA); break;

            case "KeyK": gameboy.soltar(BOTON_B); break;
            case "KeyL": gameboy.soltar(BOTON_A); break;
            case "KeyH": gameboy.soltar(BOTON_SELECT); break;
            case "KeyJ": gameboy.soltar(BOTON_START); break;
            default: console.log("Tecla no mapeada: " + event.code);
        }
    });

}

