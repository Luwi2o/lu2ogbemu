import { Gameboy } from './gameboy.js';
import { Debug } from './debug.js';
import { 
    BOTON_A, 
    BOTON_B, 
    BOTON_SELECT, 
    BOTON_START, 
    BOTON_ARRIBA, 
    BOTON_ABAJO, 
    BOTON_IZQUIERDA, 
    BOTON_DERECHA 
} from './constantes.js';

/**@type {Gameboy}*/
let gb;
let rom;
let boot;
let dbg;
let guardado;

const $ = (id) => document.getElementById(id);

function abrirFilePicker(idInput) {
    const el = $(idInput);
    if (el) el.click();
}

const DEFAULT_ROM = 'pocket.gb'; // Ruta por defecto de la ROM a cargar

function destruirInstanciaActual() {
    if (gb) {
        gb.destruir();
        gb = null;
        dbg = null;
        console.log("Instancia del emulador destruida.");
    }

    // Limpiar el canvas
    const canvas = $("gameboy-canvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function arrancarConROM(romBytes){
    destruirInstanciaActual();
    
    gb = new Gameboy(romBytes, guardado);
    dbg = new Debug(gb);
    gb.iniciar();
    dbg.empezar();

    aplicarVolumenDesdeSlider();
    aplicarPerfUI();
}

function aplicarVolumenDesdeSlider() {
    var volumen = $('volumen');
    if (!volumen) return;

    const set = (v) => {
        var nuevoVolumen = Math.pow(v / 100.0, 2);
        gb.sonido.actualizarVolumen(nuevoVolumen);
        console.log("volumen cambiado a:" + nuevoVolumen);
    };
}

function aplicarPerfUI() {
    const ui = window.__perfUI;
    if (!ui || !gb) return;

    if (typeof gb.setFpsElement === 'function') gb.setFpsElement(ui.fpsEl);
    if (typeof gb.setFpsIlimitados === 'function') gb.setFpsIlimitados(ui.unlockFps);
}

function bindUI() {
    $("boton-cargar-guardado").addEventListener("click",   
        () => {abrirFilePicker("archivo-guardado");}
    );
    $("boton-cargar-rom").addEventListener("click", 
        () => {abrirFilePicker("archivo-rom");} 
    );
    $("boton-cargar-boot").addEventListener("click", 
        () => {abrirFilePicker("archivo-boot");}
    );
    
    // Input ROM
    $("archivo-rom")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
        const bytes = new Uint8Array(reader.result);
            arrancarConROM(bytes);
        };
        reader.readAsArrayBuffer(file);

        e.target.value = "";
    });
    // Input SAV
    $("archivo-guardado")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            guardado = new Uint8Array(reader.result);
        };
        reader.readAsArrayBuffer(file);

        e.target.value = "";
    });

    // Input BOOT
    $("archivo-boot")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            boot = new Uint8Array(reader.result);
        };
        reader.readAsArrayBuffer(file);

        e.target.value = "";
    });
    
    // Volumen (1 vez, usando instancia actual)
    $("volumen")?.addEventListener("input", (e) => {
        if (!gb?.sonido) return;
        const v = e.currentTarget.value;
        const nuevo = Math.pow(v / 100.0, 2);
        gb.sonido.actualizarVolumen(nuevo);
    });

    // Guardar .sav (1 vez, usando instancia actual)
    $("boton-descargar-guardado")?.addEventListener("click", () => {
        if (!gb?.memoria?.sRAM) return;
        const a = document.createElement("a");
        const blob = new Blob([gb.memoria.sRAM]);
        a.href = URL.createObjectURL(blob);
        a.download = "save.sav";
        a.click();
    });

    // Controles (1 vez) -> siempre actúan sobre `gb` actual
    mapearControles();
}


function mapearControles() {
    const press = (b) => {
        gb?.pulsar(b);
    }
    const release = (b) => {
        gb?.soltar(b);
    }

    $("boton-a").addEventListener("mousedown", () => press(BOTON_A));
    $("boton-a").addEventListener("mouseup", () => release(BOTON_A));
    $("boton-b").addEventListener("mousedown", () => press(BOTON_B));
    $("boton-b").addEventListener("mouseup", () => release(BOTON_B));
    $("boton-select").addEventListener("mousedown", () => press(BOTON_SELECT));
    $("boton-select").addEventListener("mouseup", () => release(BOTON_SELECT));
    $("boton-start").addEventListener("mousedown", () => press(BOTON_START));
    $("boton-start").addEventListener("mouseup", () => release(BOTON_START));
    $("boton-arriba").addEventListener("mousedown", () => press(BOTON_ARRIBA));
    $("boton-arriba").addEventListener("mouseup", () => release(BOTON_ARRIBA));
    $("boton-abajo").addEventListener("mousedown", () => press(BOTON_ABAJO));
    $("boton-abajo").addEventListener("mouseup", () => release(BOTON_ABAJO));
    $("boton-izquierda").addEventListener("mousedown", () => press(BOTON_IZQUIERDA));
    $("boton-izquierda").addEventListener("mouseup", () => release(BOTON_IZQUIERDA));
    $("boton-derecha").addEventListener("mousedown", () => press(BOTON_DERECHA));
    $("boton-derecha").addEventListener("mouseup", () => release(BOTON_DERECHA));

    window.addEventListener("keydown", (e) => {
        switch(e.code) {
            case "KeyZ": press(BOTON_A); break;
            case "KeyX": press(BOTON_B); break;
            case "ShiftRight": press(BOTON_SELECT); break;
            case "Enter": press(BOTON_START); break;
            case "ArrowUp": press(BOTON_ARRIBA); break;
            case "ArrowDown": press(BOTON_ABAJO); break;
            case "ArrowLeft": press(BOTON_IZQUIERDA); break;
            case "ArrowRight": press(BOTON_DERECHA); break;
        }
    });
    
    window.addEventListener("keyup", (e) => {
        switch(e.code) {
            case "KeyZ": release(BOTON_A); break;
            case "KeyX": release(BOTON_B); break;
            case "ShiftRight": release(BOTON_SELECT); break;
            case "Enter": release(BOTON_START); break;
            case "ArrowUp": release(BOTON_ARRIBA); break;
            case "ArrowDown": release(BOTON_ABAJO); break;
            case "ArrowLeft": release(BOTON_IZQUIERDA); break;
            case "ArrowRight": release(BOTON_DERECHA); break;
        }
    });
}

window.addEventListener("load", async () => {
    bindUI();

    try {
        const result = await fetch(DEFAULT_ROM, { cache: "no-store" });
        if (!result.ok) throw new Error(`No se pudo obtener ${DEFAULT_ROM} (${result.status})`);
        const bytes = new Uint8Array(await result.arrayBuffer());
        arrancarConROM(bytes);
    } catch (err) {
        console.warn("[Game Boy] Falló la autocarga de la ROM inicial:", err);
    }
});