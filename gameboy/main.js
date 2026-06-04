import { Gameboy } from './gameboy.js';
import { PALETAS_LCD } from './io/pantalla.js';
import { Debug } from './debug.js';
import { setBootROM } from './bootrom.js';
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
let dbg;
let guardado;

const $ = (id) => document.getElementById(id);

function abrirFilePicker(idInput) {
    const el = $(idInput);
    if (el) el.click();
}

const DEFAULT_ROM = 'pocket.gb'; // Ruta por defecto de la ROM a cargar
const LCD_UI_KEY = 'gb_lcd_ui';
const PERF_UI_KEY = 'gb_unlock_fps';
const DEBUG_VISIBLE_KEY = 'gb_debug_visible';

const lcdUI = {
    paleta: 'verde',
    ghosting: 35
};

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
    aplicarLCDDesdeUI();
}

function aplicarVolumenDesdeSlider() {
    var volumen = $('volumen');
    if (!volumen) return;

    const set = (v) => {
        var nuevoVolumen = Math.pow(v / 100.0, 2);
        gb.sonido.actualizarVolumen(nuevoVolumen);
        console.log("volumen cambiado a:" + nuevoVolumen);
    };
    set(Number(volumen.value));
}

function aplicarPerfUI() {
    const ui = window.__perfUI;
    if (!ui || !gb) return;

    if (typeof gb.setFpsElement === 'function') gb.setFpsElement(ui.fpsEl);
    if (typeof gb.setFpsIlimitados === 'function') gb.setFpsIlimitados(ui.unlockFps);
}

function bindTabsDebug() {
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.panel');

    const showTab = (id) => {
        panels.forEach((panel) => panel.classList.add('hidden'));

        const panel = document.getElementById(id);
        if(panel) panel.classList.remove('hidden');

        tabs.forEach((tab) => {
            const activo = tab.dataset.tab === id;
            tab.classList.toggle('primary', activo);
            tab.setAttribute('aria-selected', activo ? 'true' : 'false');
        });
    };

    tabs.forEach((tab) => {
        tab.setAttribute('type', 'button');
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });

    showTab('t-reg');
}

function bindDebugToggle() {
    const boton = $('ocultar-debug');
    const panel = $('panel-debug');
    if(!boton || !panel) return;

    const cargarEstadoInicial = () => localStorage.getItem(DEBUG_VISIBLE_KEY) === '1';

    const aplicar = (visible) => {
        panel.classList.toggle('hidden', !visible);
        boton.setAttribute('aria-expanded', visible ? 'true' : 'false');
        boton.textContent = visible ? 'Ocultar debug' : 'Mostrar debug';
        localStorage.setItem(DEBUG_VISIBLE_KEY, visible ? '1' : '0');
        window.dispatchEvent(new Event('resize'));
    };

    boton.addEventListener('click', () => aplicar(panel.classList.contains('hidden')));
    aplicar(cargarEstadoInicial());
}

function bindPerfUI() {
    const chk = $('unlock-fps');
    const fpsEl = $('fps');
    if(!chk || !fpsEl) return;

    chk.checked = localStorage.getItem(PERF_UI_KEY) === '1';
    window.__perfUI = { unlockFps: chk.checked, fpsEl };

    const aplicar = () => {
        window.__perfUI.unlockFps = chk.checked;
        window.__perfUI.fpsEl = fpsEl;
        localStorage.setItem(PERF_UI_KEY, chk.checked ? '1' : '0');
        aplicarPerfUI();
    };

    chk.addEventListener('change', aplicar);
    aplicar();
}

function cargarLCDUI() {
    try {
        const guardado = JSON.parse(localStorage.getItem(LCD_UI_KEY) || 'null');
        if(!guardado || typeof guardado !== 'object') return;

        if(typeof guardado.paleta === 'string' && PALETAS_LCD[guardado.paleta]){
            lcdUI.paleta = guardado.paleta;
        }
        if(typeof guardado.ghosting === 'number'){
            lcdUI.ghosting = Math.max(0, Math.min(90, guardado.ghosting));
        }
    } catch (err) {
        console.warn("[Game Boy] No se pudo cargar la configuración LCD:", err);
    }
}

function guardarLCDUI() {
    localStorage.setItem(LCD_UI_KEY, JSON.stringify(lcdUI));
}

function aplicarLCDDesdeUI() {
    $('lcd-paleta') && ($('lcd-paleta').value = lcdUI.paleta);
    $('lcd-ghosting') && ($('lcd-ghosting').value = String(lcdUI.ghosting));
    $('lcd-ghosting-valor') && ($('lcd-ghosting-valor').textContent = `${lcdUI.ghosting}%`);

    if(!gb?.pantalla) return;
    gb.pantalla.cambiarPaletaLCD(lcdUI.paleta);
    gb.pantalla.cambiarEfectosLCD({
        ghosting: lcdUI.ghosting / 100
    });
}

function bindLCDUI() {
    cargarLCDUI();
    aplicarLCDDesdeUI();

    $('lcd-paleta')?.addEventListener('change', (e) => {
        lcdUI.paleta = e.currentTarget.value;
        if(!PALETAS_LCD[lcdUI.paleta]) lcdUI.paleta = 'verde';
        guardarLCDUI();
        aplicarLCDDesdeUI();
    });

    $('lcd-ghosting')?.addEventListener('input', (e) => {
        lcdUI.ghosting = Number(e.currentTarget.value);
        guardarLCDUI();
        aplicarLCDDesdeUI();
    });
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
            setBootROM(new Uint8Array(reader.result));
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
    bindLCDUI();
    bindPerfUI();
    bindTabsDebug();
    bindDebugToggle();
}


function mapearControles() {
    const botonesPulsados = new Set();

    const press = (b) => {
        if(botonesPulsados.has(b)) return;
        botonesPulsados.add(b);
        gb?.pulsar(b);
    }
    const release = (b) => {
        botonesPulsados.delete(b);
        gb?.soltar(b);
    }
    const releaseAll = () => {
        botonesPulsados.forEach((boton) => gb?.soltar(boton));
        botonesPulsados.clear();
    };

    const bindBotonPantalla = (id, boton) => {
        const el = $(id);
        if(!el) return;

        el.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            el.setPointerCapture?.(e.pointerId);
            press(boton);
        });
        el.addEventListener("pointerup", () => release(boton));
        el.addEventListener("pointercancel", () => release(boton));
        el.addEventListener("lostpointercapture", () => release(boton));
        el.addEventListener("blur", () => release(boton));
    };

    bindBotonPantalla("boton-a", BOTON_A);
    bindBotonPantalla("boton-b", BOTON_B);
    bindBotonPantalla("boton-select", BOTON_SELECT);
    bindBotonPantalla("boton-start", BOTON_START);
    bindBotonPantalla("boton-arriba", BOTON_ARRIBA);
    bindBotonPantalla("boton-abajo", BOTON_ABAJO);
    bindBotonPantalla("boton-izquierda", BOTON_IZQUIERDA);
    bindBotonPantalla("boton-derecha", BOTON_DERECHA);

    window.addEventListener("keydown", (e) => {
        if(e.repeat) return;

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

    window.addEventListener("blur", releaseAll);
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
