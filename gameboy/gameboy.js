// @ts-check

import { CPU } from './cpu/cpu.js';
import { Memoria } from './memoria/memoria.js';
import { Pantalla } from './io/pantalla.js';
import { Botones } from './io/botones.js';
import { Interrupciones } from './cpu/interrupciones.js';
import { RegistrosLCD } from './memoria/registros/registros_lcd.js';
import { RegistrosInterrupciones } from './memoria/registros/registros_interrupciones.js';
import { RegistrosBotones } from './memoria/registros/registros_botones.js';
import { RegistrosCanal1 } from './memoria/registros/registros_canal1.js';
import { RegistrosCanal2 } from './memoria/registros/registros_canal2.js';
import { RegistrosCanal3 } from './memoria/registros/registros_canal3.js';
import { RegistrosCanal4 } from './memoria/registros/registros_canal4.js';
import { RegistrosAudio } from './memoria/registros/registros_audio.js';
import { Sonido } from './io/audio/sonido.js';
import { Audio } from './io/audio/audio.js';
import { CPUDebug } from './cpu/cpu_debug.js';
import { BGB_DMG0 } from './constantes.js';

/**
 * Emula una gameboy
 */
export class Gameboy{

    /**
     * 
     * @param {Uint8Array} bytesPrograma 
     * @param {Uint8Array} guardado 
     * @param {Object} estado 
     */
    constructor(bytesPrograma, guardado, estado){
        console.debug("---------- INICIO GAMEBOY ----------");

        this.guardado = guardado instanceof Uint8Array ? guardado : new Uint8Array(0);
        
        if(guardado){
            console.log("GAMEBOY: Se ha proporcionado un archivo de guardado")
            this.guardado = guardado;
        }

        if(estado){
            console.log("GAMEBOY: Se ha proporcionado un archivo de estado")
        }

        this.tiempoAhora = performance.now();
        this.tiempoAntes = performance.now();
        // --- Rendimiento (FPS) ---
        /** @type {boolean} */
        this.fpsIlimitados = false;
        /** @type {number} */
        this.fps = 0;
        /** @type {number} */
        this._fpsFrames = 0;
        /** @type {number} */
        this._fpsUltimoT = performance.now();
        /** @type {HTMLElement|null} */
        this._fpsEl = null;
        /** @type {number} */
        this._sliceMs = 12; // presupuesto por RAF en modo ilimitado (para no congelar la UI)

        this.ejecutando = true;
        this.raf = null;

        // Exponer instancia para la UI (index.html)
        if (typeof window !== 'undefined') {
            // @ts-ignore
            window.__gb = this;
            // Si la UI ya registró su estado, lo aplicamos
            // @ts-ignore
            if (window.__perfUI?.fpsEl) this._fpsEl = window.__perfUI.fpsEl;
            // @ts-ignore
            if (window.__perfUI) this.fpsIlimitados = !!window.__perfUI.unlockFps;
            this._renderFps();
        }

        this.tipoConsola = BGB_DMG0;
        // Si no se ha insertado un programa se inserta un ROM vacío
        if(!bytesPrograma) bytesPrograma = new Uint8Array(0x8000).fill(0);

        this.sonido = new Sonido();

        // Registros
        this.regLCD = new RegistrosLCD(this.tipoConsola, estado);
        this.regInt = new RegistrosInterrupciones(this.tipoConsola, estado);
        this.regBot = new RegistrosBotones(this.tipoConsola);
        this.regCnl1 = new RegistrosCanal1(this.tipoConsola, this.sonido);
        this.regCnl2 = new RegistrosCanal2(this.tipoConsola, this.sonido);
        this.regCnl3 = new RegistrosCanal3(this.tipoConsola, this.sonido);
        this.regCnl4 = new RegistrosCanal4(this.tipoConsola, this.sonido);
        this.regAud = new RegistrosAudio(this.tipoConsola, this.sonido,
            this.regCnl1, this.regCnl2, this.regCnl3, this.regCnl4);

        this.cPUDebug = new CPUDebug()

        // Memoria
        this.memoria = new Memoria(bytesPrograma, this.regLCD, this.regInt, this.regBot, this.regAud, 
                                    this.regCnl1, this.regCnl2, this.regCnl3, this.regCnl4,
                                    this.cPUDebug, this.guardado);
        // CPU
        this.interrupciones = new Interrupciones(this.regInt);
        this.cpu = new CPU(this.memoria, this.interrupciones, this.tipoConsola, this.cPUDebug, estado);
        // IO
        this.pantalla = new Pantalla(this.regLCD, this.interrupciones, estado);
        this.botones = new Botones(this.regBot, this.interrupciones);
        this.audio = new Audio(
            this.regAud, 
            this.regCnl1, 
            this.regCnl2, 
            this.regCnl3,
            this.regCnl4
        );

        this.intervalo_ciclo = null;
    }

    /**
     * Pausa la CPU en un PC determinado. Usado para hacer debug.
     * @param {*} pc Contador de programa en el que se quiere pausar.
     */
    pausarEn(pc){
        this.cpu.pausarEn(pc);
    }

    /**
     * Bucle de emulación.
     */
    emular(){
        const gb = this;

        if(!this.ejecutando) return;

        this.raf = window.requestAnimationFrame(function(){ gb.emular() });

        // Modo normal: cap a ~60 FPS
        if(!this.fpsIlimitados){
            this.tiempoAhora = performance.now();
            const diferencia = this.tiempoAhora - this.tiempoAntes;

            if(diferencia > 1000/60){
                this._emularUnFrame();
                this.tiempoAntes = this.tiempoAhora;
            }

            this._tickFps(this.tiempoAhora);
            return;
        }

        // Modo ilimitado: emula tantos frames como pueda por RAF (con presupuesto de tiempo)
        const start = performance.now();
        const deadline = start + this._sliceMs;

        let now = start;
        while(now < deadline && !this.cPUDebug.pausado){
            this._emularUnFrame();
            now = performance.now();
        }

        this._tickFps(now);
    }


    /**
     * Se cambia la escala de la pantalla
     * @param {number} escala 
     */
    cambiarEscalaPantalla(escala){
        this.pantalla.cambiarEscala(escala);
    }


    // --- Debug

    paso(){
        this.cpu.ciclo()
        this.pantalla.enCiclos(this.cpu.ciclos)
        this.interrupciones.enCiclos(this.cpu.ciclos);
    }

    pausar(){
        this.cpu.pausar();
    }

    continuar(){
        this.cpu.continuar();
    }

    continuarSinPausa(){
        this.cpu.continuarSinPausa();
    }

    /**
     * Se comienza el bucle de emulación.
     */
    iniciar(){
        this.emular();
    }

    /**
     * 
     * @param {*} boton 
     */
    pulsar(boton){
        this.botones.pulsar(boton);
    }

    /**
     * 
     * @param {*} boton 
     */
    soltar(boton){
        this.botones.soltar(boton);
    }

    /**
     * Activa o desactiva el modo de FPS ilimitados (benchmark).
     * @param {boolean} v
     */
    setFpsIlimitados(v){
        this.fpsIlimitados = !!v;

        // evita “saltos” al alternar modo
        const now = performance.now();
        this.tiempoAntes = now;
        this._fpsFrames = 0;
        this._fpsUltimoT = now;
        this.fps = 0;
        this._renderFps();
    }

    /**
     * Permite indicar dónde escribir los FPS.
     * @param {HTMLElement|null} el
     */
    setFpsElement(el){
        this._fpsEl = el || null;
        this._renderFps();
    }

    /**
     * Emula exactamente 1 frame (hasta que pantalla marque terminada).
     */
    _emularUnFrame(){
        this.pantalla.terminada = false;
        while(!this.pantalla.terminada && !this.cPUDebug.pausado){
            this.cpu.ciclo();
            this.pantalla.enCiclos(this.cpu.ciclos);
            this.interrupciones.enCiclos(this.cpu.ciclos);
            this.regCnl1.enCiclos(this.cpu.ciclos);
            this.regCnl2.enCiclos(this.cpu.ciclos);
            this.regCnl3.enCiclos(this.cpu.ciclos);
            this.regCnl4.enCiclos(this.cpu.ciclos);
        }
        if (this.pantalla.terminada) this._fpsFrames++;
    }

    /**
     * Calcula FPS ~1 vez/seg.
     * @param {number} ahora
     */
    _tickFps(ahora){
        const dt = ahora - this._fpsUltimoT;
        if (dt < 1000) return;

        this.fps = (this._fpsFrames * 1000) / dt;
        this._fpsFrames = 0;
        this._fpsUltimoT = ahora;
        this._renderFps();
        }

        _renderFps(){
        if (typeof document === 'undefined') return;

        if (!this._fpsEl) {
            this._fpsEl = document.getElementById('fps');
        }
        if (!this._fpsEl) return;

        const suf = this.fpsIlimitados ? ' (∞)' : '';
        this._fpsEl.textContent = `FPS: ${this.fps.toFixed(1)}${suf}`;
    }

    destruir(){
        this.ejecutando = false;
        if (this.raf) cancelAnimationFrame(this.raf);
    }

}