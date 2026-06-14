import { CPU } from '../cpu/cpu.js';
import { CPUDebug } from '../cpu/cpu_debug.js';
import { Interrupciones } from '../cpu/interrupciones.js';
import { Memoria } from '../memoria/memoria.js';
import { RegistrosAudio } from '../memoria/registros/registros_audio.js';
import { RegistrosBotones } from '../memoria/registros/registros_botones.js';
import { RegistrosCanal1 } from '../memoria/registros/registros_canal1.js';
import { RegistrosCanal2 } from '../memoria/registros/registros_canal2.js';
import { RegistrosCanal3 } from '../memoria/registros/registros_canal3.js';
import { RegistrosCanal4 } from '../memoria/registros/registros_canal4.js';
import { RegistrosInterrupciones } from '../memoria/registros/registros_interrupciones.js';
import { RegistrosLCD } from '../memoria/registros/registros_lcd.js';

export class SonidoFake {
    constructor() {
        this.llamadas = [];
    }

    registrar(nombre, ...args) {
        this.llamadas.push([nombre, ...args]);
    }

    activarMaestro() {
        this.registrar('activarMaestro');
    }
    desactivarMaestro() {
        this.registrar('desactivarMaestro');
    }
    activarCanal(canal) {
        this.registrar('activarCanal', canal);
    }
    desactivarCanal(canal) {
        this.registrar('desactivarCanal', canal);
    }
    actualizarFrecuencia(canal, periodo) {
        this.registrar('actualizarFrecuencia', canal, periodo);
    }
    actualizarGanancia(canal, ganancia) {
        this.registrar('actualizarGanancia', canal, ganancia);
    }
    actualizarVolumenMaestro(volumen) {
        this.registrar('actualizarVolumenMaestro', volumen);
    }
    reproducirOnda(canal, onda) {
        this.registrar('reproducirOnda', canal, onda);
    }
    actualizarOnda3(onda) {
        this.registrar('actualizarOnda3', Array.from(onda));
    }
    actualizarAnchoLFSR(ancho) {
        this.registrar('actualizarAnchoLFSR', ancho);
    }
    actualizarDivisor(canal, divisor, cambio) {
        this.registrar('actualizarDivisor', canal, divisor, cambio);
    }
    reiniciarLFSR() {
        this.registrar('reiniciarLFSR');
    }
}

export function crearComponentes(tipoConsola) {
    const sonido = new SonidoFake();
    const regLCD = new RegistrosLCD(tipoConsola);
    const regInt = new RegistrosInterrupciones(tipoConsola);
    const regBot = new RegistrosBotones(tipoConsola);
    const regCnl1 = new RegistrosCanal1(tipoConsola, sonido);
    const regCnl2 = new RegistrosCanal2(tipoConsola, sonido);
    const regCnl3 = new RegistrosCanal3(tipoConsola, sonido);
    const regCnl4 = new RegistrosCanal4(tipoConsola, sonido);
    const regAud = new RegistrosAudio(tipoConsola, sonido, regCnl1, regCnl2, regCnl3, regCnl4);

    sonido.llamadas.length = 0;
    return { sonido, regLCD, regInt, regBot, regAud, regCnl1, regCnl2, regCnl3, regCnl4 };
}

export function crearROM({ bancos = 2, tipo = 0x00, tamanyoRAM = 0x00 } = {}) {
    const codigosTamanyo = new Map([
        [2, 0x00],
        [4, 0x01],
        [8, 0x02],
        [16, 0x03],
        [32, 0x04],
        [64, 0x05],
        [128, 0x06],
        [256, 0x07],
        [512, 0x08],
    ]);
    const rom = new Uint8Array(bancos * 0x4000);

    for (let banco = 0; banco < bancos; banco++) {
        rom.fill(banco & 0xff, banco * 0x4000, (banco + 1) * 0x4000);
    }

    rom[0x0147] = tipo;
    rom[0x0148] = codigosTamanyo.get(bancos) ?? 0x00;
    rom[0x0149] = tamanyoRAM;
    return rom;
}

export function crearMemoria(opciones = {}) {
    const componentes = crearComponentes();
    const rom = crearROM(opciones);
    const memoria = new Memoria(
        rom,
        componentes.regLCD,
        componentes.regInt,
        componentes.regBot,
        componentes.regAud,
        componentes.regCnl1,
        componentes.regCnl2,
        componentes.regCnl3,
        componentes.regCnl4,
        { pausado: false },
        opciones.guardado
    );
    return { memoria, rom, ...componentes };
}

export function crearCPU(opciones = {}) {
    const entorno = crearMemoria(opciones);
    const interrupciones = new Interrupciones(entorno.regInt);
    const cpuDebug = new CPUDebug();
    const cpu = new CPU(
        entorno.memoria,
        interrupciones,
        opciones.tipoConsola,
        cpuDebug,
        opciones.estado
    );

    return { cpu, cpuDebug, interrupciones, ...entorno };
}
