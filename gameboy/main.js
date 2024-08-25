function cargarArchivoGuardado() {
    $("#archivo-guardado").click();
};

function cargarArchivoROM() {
    $("#archivo-rom").click();
};

function cargarArchivoBoot() {
    $("#archivo-boot").click();
};

var estado;
var guardado;

$("#archivo-guardado").on('change', function() {
    var reader = new FileReader();
    
    reader.onload = function() {
        var guardadoBuffer = this.result;
        guardado = new Uint8Array(guardadoBuffer);
        console.log(guardado);
    }
    reader.readAsArrayBuffer(this.files[0]);
});

$("#archivo-rom").on('change', function() {
    var reader = new FileReader();
    
    reader.onload = function() {
        var arrayBuffer = this.result;
        rom = new Uint8Array(arrayBuffer);
        var gameboy = new Gameboy(rom, guardado);

        var debug = new Debug(gameboy);
        gameboy.iniciar();
        debug.empezar();

        mapear(gameboy);
        
        gameboy.sonido.actualizarVolumen(0.01);
        console.log("volumen cambiado a:" + 0.01);

        $("#volumen").on("change input", function(e) {
            var nuevoVolumen = Math.pow(e.currentTarget.value / 100.0, 2);
            gameboy.sonido.actualizarVolumen(nuevoVolumen);
            console.log("volumen cambiado a:" + nuevoVolumen);
        });

        $("#boton-descargar-guardado").on("click", function(e) {
            console.log("GUARDANDO");
            var filename = "save.sav";
            const a = document.createElement('a');
            const blob = new Blob([gameboy.memoria.sRAM]);
            const url = URL.createObjectURL(blob);
            a.setAttribute('href', url);
            a.setAttribute('download', filename);
            a.click();
        });

        $("#ocultar-debug").on("click", function(e) {
            if (debug.pausado) {
                console.log("ABRIENDO DEBUG");
                debug.continuar();
                $(".ventana-debug").css('display', 'inline-flex');
                $("#ocultar-debug").text("cerrar debug");
            } else {
                console.log("CERRANDO DEBUG");
                debug.pausar();
                $(".ventana-debug").css('display', 'none');
                $("#gameboy-canvas").width(320);
                $("#gameboy-canvas").height(288);
                $("#gameboy-canvas").css({"width": "320px", "height": "288px"});
                gameboy.cambiarEscalaPantalla(2.0);
                $("#ocultar-debug").text("abrir debug");
            }
        });
    }
    reader.readAsArrayBuffer(this.files[0]);
});

$("#archivo-boot").on('change', function() {
    var reader = new FileReader();
    
    reader.onload = function() {
        var bootBuffer = this.result;
        boot = new Uint8Array(bootBuffer);
        console.log(boot.toString());
    }
    reader.readAsArrayBuffer(this.files[0]);
});

function mapear(gameboy) {
    $("#boton-a").on("mousedown mouseup", function(event) {
        if (event.type === "mousedown") gameboy.pulsar(BOTON_A);
        else gameboy.soltar(BOTON_A);
    });
    $("#boton-b").on("mousedown mouseup", function(event) {
        if (event.type === "mousedown") gameboy.pulsar(BOTON_B);
        else gameboy.soltar(BOTON_B);
    });
    $("#boton-select").on("mousedown mouseup", function(event) {
        if (event.type === "mousedown") gameboy.pulsar(BOTON_SELECT);
        else gameboy.soltar(BOTON_SELECT);
    });
    $("#boton-start").on("mousedown mouseup", function(event) {
        if (event.type === "mousedown") gameboy.pulsar(BOTON_START);
        else gameboy.soltar(BOTON_START);
    });
    $("#boton-arriba").on("mousedown mouseup", function(event) {
        if (event.type === "mousedown") gameboy.pulsar(BOTON_ARRIBA);
        else gameboy.soltar(BOTON_ARRIBA);
    });
    $("#boton-izquierda").on("mousedown mouseup", function(event) {
        if (event.type === "mousedown") gameboy.pulsar(BOTON_IZQUIERDA);
        else gameboy.soltar(BOTON_IZQUIERDA);
    });
    $("#boton-derecha").on("mousedown mouseup", function(event) {
        if (event.type === "mousedown") gameboy.pulsar(BOTON_DERECHA);
        else gameboy.soltar(BOTON_DERECHA);
    });
    $("#boton-abajo").on("mousedown mouseup", function(event) {
        if (event.type === "mousedown") gameboy.pulsar(BOTON_ABAJO);
        else gameboy.soltar(BOTON_ABAJO);
    });

    $(document).on("keydown keyup", function(event) {
        var accion = event.type === "keydown" ? gameboy.pulsar : gameboy.soltar;
        switch(event.code) {
            case "KeyA": accion(BOTON_IZQUIERDA); break;
            case "KeyS": accion(BOTON_ABAJO); break;
            case "KeyW": accion(BOTON_ARRIBA); break;
            case "KeyD": accion(BOTON_DERECHA); break;
            case "KeyK": accion(BOTON_B); break;
            case "KeyL": accion(BOTON_A); break;
            case "KeyH": accion(BOTON_SELECT); break;
            case "KeyJ": accion(BOTON_START); break;
            default: console.log("Tecla no mapeada: " + event.code);
        }
    });
}
