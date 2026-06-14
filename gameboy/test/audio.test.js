import assert from 'node:assert/strict';
import test from 'node:test';

import { BGB_DMG0 } from '../constantes.js';
import { RegistrosAudio } from '../memoria/registros/registros_audio.js';
import { RegistrosCanal1 } from '../memoria/registros/registros_canal1.js';
import { RegistrosCanal2 } from '../memoria/registros/registros_canal2.js';
import { RegistrosCanal3 } from '../memoria/registros/registros_canal3.js';
import { RegistrosCanal4 } from '../memoria/registros/registros_canal4.js';
import { Sonido } from '../io/audio/sonido.js';
import { crearComponentes, SonidoFake } from './helpers.js';

class ParametroAudioFake {
    constructor() {
        this.valor = 0;
        this.llamadas = [];
    }

    setValueAtTime(valor, tiempo) {
        this.valor = valor;
        this.llamadas.push(['setValueAtTime', valor, tiempo]);
    }

    cancelScheduledValues(tiempo) {
        this.llamadas.push(['cancelScheduledValues', tiempo]);
    }
}

class NodoAudioFake {
    constructor() {
        this.gain = new ParametroAudioFake();
        this.frequency = new ParametroAudioFake();
        this.numberOfOutputs = 1;
        this.conexiones = [];
        this.iniciado = false;
        this.detenido = false;
        this.desconectado = false;
        this.onda = null;
    }

    connect(destino) {
        this.conexiones.push(destino);
    }

    disconnect() {
        this.desconectado = true;
    }

    start() {
        this.iniciado = true;
    }

    stop() {
        this.detenido = true;
    }

    setPeriodicWave(onda) {
        this.onda = onda;
    }

    addEventListener(nombre, callback) {
        this.evento = [nombre, callback];
    }

    getByteTimeDomainData(datos) {
        datos.fill(128);
    }
}

class ContextoAudioFake {
    constructor() {
        this.currentTime = 2;
        this.sampleRate = 48000;
        this.state = 'suspended';
        this.destination = new NodoAudioFake();
        this.nodos = [];
        this.ondas = [];
        this.reanudado = false;
        this.cerrado = false;
    }

    crearNodo() {
        const nodo = new NodoAudioFake();
        this.nodos.push(nodo);
        return nodo;
    }

    createOscillator() {
        return this.crearNodo();
    }

    createScriptProcessor() {
        return this.crearNodo();
    }

    createGain() {
        return this.crearNodo();
    }

    createAnalyser() {
        const nodo = this.crearNodo();
        nodo.frequencyBinCount = 8;
        return nodo;
    }

    createPeriodicWave(real, imag, opciones) {
        const onda = { real, imag, opciones };
        this.ondas.push(onda);
        return onda;
    }

    async resume() {
        this.reanudado = true;
        this.state = 'running';
    }

    async close() {
        this.cerrado = true;
        this.state = 'closed';
    }
}

function instalarEntornoAudio(t) {
    const originales = {
        window: globalThis.window,
        document: globalThis.document,
        requestAnimationFrame: globalThis.requestAnimationFrame,
        cancelAnimationFrame: globalThis.cancelAnimationFrame,
    };
    const dibujo = {
        clearRect: 0,
        fillRect: 0,
        beginPath: 0,
        moveTo: 0,
        lineTo: 0,
        stroke: 0,
    };
    const contextoCanvas = {};

    for (const metodo of Object.keys(dibujo)) {
        contextoCanvas[metodo] = () => {
            dibujo[metodo]++;
        };
    }

    globalThis.window = { AudioContext: ContextoAudioFake };
    globalThis.document = {
        getElementById: () => ({
            width: 160,
            height: 144,
            getContext: () => contextoCanvas,
        }),
    };
    globalThis.requestAnimationFrame = () => 27;
    globalThis.cancelAnimationFrame = (id) => {
        dibujo.rafCancelado = id;
    };

    t.after(() => {
        for (const [nombre, valor] of Object.entries(originales)) {
            if (valor === undefined) {
                delete globalThis[nombre];
            } else {
                globalThis[nombre] = valor;
            }
        }
    });

    return dibujo;
}

test('RegistrosAudio conserva NR50/NR51 y refleja maestro y canales en NR52', () => {
    const { sonido, regAud, regCnl1, regCnl2, regCnl3, regCnl4 } = crearComponentes();

    for (let dato = 0; dato <= 0xff; dato++) {
        regAud.escribirVolumenMaestro(dato);
        regAud.escribirAudioPanoramica(dato);
        assert.equal(regAud.leerVolumenMaestro(), dato);
        assert.equal(regAud.leerAudioPanoramica(), dato);
    }

    regCnl1.activado = true;
    regCnl2.activado = false;
    regCnl3.activado = true;
    regCnl4.activado = true;
    regAud.escribirAudioControlMaestro(0x80);
    assert.equal(regAud.leerAudioControlMaestro(), 0xfd);
    assert.deepEqual(sonido.llamadas.at(-1), ['activarMaestro']);

    regAud.escribirAudioControlMaestro(0);
    assert.equal(regAud.leerAudioControlMaestro(), 0x70);
    assert.deepEqual(sonido.llamadas.at(-1), ['desactivarMaestro']);

    regAud.escribirAudioControlMaestro(0xff);
    assert.equal(regAud.leerAudioControlMaestro(), 0xf0);
    assert.deepEqual(sonido.llamadas.at(-1), ['activarMaestro']);
});

test('La longitud limpia el estado de NR52 exactamente al llegar a cero', () => {
    const { regAud, regCnl1, regCnl2, regCnl3, regCnl4 } = crearComponentes();
    const casos = [
        {
            canal: regCnl1,
            mascara: 0x01,
            preparar() {
                regCnl1.escribirCicloYTemporizador(0x3c);
                regCnl1.escribirVolumenYEnvoltorio(0xf0);
                regCnl1.escribirPeriodoAltoYControl(0xc0);
            },
        },
        {
            canal: regCnl2,
            mascara: 0x02,
            preparar() {
                regCnl2.escribirCicloYTemporizador(0x3c);
                regCnl2.escribirVolumenYEnvoltorio(0xf0);
                regCnl2.escribirPeriodoAltoYControl(0xc0);
            },
        },
        {
            canal: regCnl3,
            mascara: 0x04,
            preparar() {
                regCnl3.escribirActivadoDAC(0x80);
                regCnl3.escribirTemporizador(0xfc);
                regCnl3.escribirPeriodoAltoYControl(0xc0);
            },
        },
        {
            canal: regCnl4,
            mascara: 0x08,
            preparar() {
                regCnl4.escribirTemporizador(0x3c);
                regCnl4.escribirVolumenYEnvoltorio(0xf0);
                regCnl4.escribirControl(0xc0);
            },
        },
    ];

    for (const { canal, mascara, preparar } of casos) {
        preparar();
        assert.notEqual(regAud.leerAudioControlMaestro() & mascara, 0);

        canal.enCiclos(16384 * 3);
        assert.notEqual(regAud.leerAudioControlMaestro() & mascara, 0);

        canal.enCiclos(16384);
        assert.equal(regAud.leerAudioControlMaestro() & mascara, 0);
    }
});

test('Canal 1 codifica registros, dispara sonido y expira por longitud', () => {
    const sonido = new SonidoFake();
    const canal = new RegistrosCanal1(undefined, sonido);

    canal.escribirBarrido(0x6d);
    canal.escribirCicloYTemporizador(0x81);
    canal.escribirVolumenYEnvoltorio(0xa9);
    canal.escribirPeriodoBajo(0x34);
    canal.escribirPeriodoAltoYControl(0xc2);

    assert.equal(canal.leerBarrido(), 0x6d);
    assert.equal(canal.leerCicloYTemporizador(), 0xbf);
    assert.equal(canal.leerVolumenYEnvoltorio(), 0xa9);
    assert.equal(canal.periodo, 0x234);
    assert.equal(canal.leerPeriodoAltoYControl(), 0x4f);
    assert.equal(canal.activado, true);

    canal.ciclosLongitud = 63;
    canal.enCiclos(16384);
    assert.equal(canal.activado, false);
    assert.deepEqual(sonido.llamadas.at(-1), ['desactivarCanal', 0]);
});

test('Canales 1 y 2 desactivan el DAC con envoltorio cero y limitan volumen', () => {
    for (const [Clase, indice] of [
        [RegistrosCanal1, 0],
        [RegistrosCanal2, 1],
    ]) {
        const sonido = new SonidoFake();
        const canal = new Clase(undefined, sonido);

        canal.escribirVolumenYEnvoltorio(0x00);
        assert.equal(canal.activado, false);
        assert.deepEqual(sonido.llamadas.at(-1), ['desactivarCanal', indice]);

        canal.escribirVolumenYEnvoltorio(0xf9);
        canal.enCiclos(65536 * 4);
        assert.equal(canal.volumen, 15);
    }
});

test('Canal 2 codifica registros, aplica envolvente y expira por longitud', () => {
    const sonido = new SonidoFake();
    const canal = new RegistrosCanal2(undefined, sonido);

    canal.escribirCicloYTemporizador(0x81);
    canal.escribirVolumenYEnvoltorio(0xa9);
    canal.escribirPeriodoBajo(0x34);
    canal.escribirPeriodoAltoYControl(0x02);
    assert.equal(canal.leerCicloYTemporizador(), 0xbf);
    assert.equal(canal.leerVolumenYEnvoltorio(), 0xa9);
    assert.equal(canal.periodo, 0x234);
    assert.equal(canal.leerPeriodoAltoYControl(), 0x0f);

    canal.escribirPeriodoAltoYControl(0xc2);
    assert.equal(canal.activado, true);
    assert.equal(canal.leerPeriodoAltoYControl(), 0x4f);
    assert.deepEqual(sonido.llamadas.at(-2), ['activarCanal', 1]);

    canal.enCiclos(65536 * 4);
    assert.equal(canal.volumen, 11);
    assert.deepEqual(sonido.llamadas.at(-1), ['actualizarGanancia', 1, 11 / 15]);

    canal.escribirVolumenYEnvoltorio(0x11);
    canal.enCiclos(65536 * 4 * 2);
    assert.equal(canal.volumen, 0);

    canal.ciclosLongitud = 63;
    canal.enCiclos(16384);
    assert.equal(canal.activado, false);
    assert.deepEqual(sonido.llamadas.at(-1), ['desactivarCanal', 1]);

    const canalDMG = new RegistrosCanal2(BGB_DMG0, new SonidoFake());
    assert.equal(canalDMG.leerCicloYTemporizador(), 0xbf);
    assert.equal(canalDMG.leerVolumenYEnvoltorio(), 0xf3);
    assert.equal(canalDMG.periodo, 0x7ff);
});

test('Canal 3 controla DAC, nivel, periodo y memoria de onda', () => {
    const sonido = new SonidoFake();
    const canal = new RegistrosCanal3(undefined, sonido);

    assert.equal(canal.leerActivadoDAC(), 0);
    canal.escribirActivadoDAC(0x80);
    assert.equal(canal.leerActivadoDAC(), 0x80);

    const ganancias = [0, 0.5, 0.25, 0.125];
    for (let nivel = 0; nivel < 4; nivel++) {
        canal.escribirNivelSalida(nivel << 5);
        assert.equal(canal.leerNivelSalida(), (nivel << 5) | 0x1f);
        assert.deepEqual(sonido.llamadas.at(-1), ['actualizarGanancia', 2, ganancias[nivel]]);
    }

    canal.escribirPeriodoBajo(0xcd);
    canal.escribirPeriodoAltoYControl(0xc3);
    assert.equal(canal.periodo, 0x3cd);
    assert.equal(canal.activado, true);
    assert.equal(canal.leerPeriodoAltoYControl(), 0x4f);

    canal.escribirActivadoDAC(0);
    assert.equal(canal.activado, false);
    assert.deepEqual(sonido.llamadas.at(-1), ['desactivarCanal', 2]);
});

test('Canal 3 solo dispara con DAC activo y expira por longitud', () => {
    const sonido = new SonidoFake();
    const canal = new RegistrosCanal3(undefined, sonido);

    canal.escribirTemporizador(0x1ff);
    assert.equal(canal.temporizadorInicial, 0xff);
    assert.equal(canal.leerTemporizador(), 0xff);

    canal.escribirPeriodoAltoYControl(0xc0);
    assert.equal(canal.activado, false);

    canal.escribirActivadoDAC(0x80);
    canal.escribirPeriodoAltoYControl(0xc0);
    assert.equal(canal.activado, true);
    canal.ciclosLongitud = 255;
    canal.enCiclos(16384);
    assert.equal(canal.activado, false);
    assert.deepEqual(sonido.llamadas.at(-1), ['desactivarCanal', 2]);

    const canalDMG = new RegistrosCanal3(BGB_DMG0, new SonidoFake());
    assert.equal(canalDMG.leerActivadoDAC(), 0);
    assert.equal(canalDMG.temporizadorInicial, 0xff);
    assert.equal(canalDMG.periodo, 0x7ff);
});

test('Canal 4 configura ruido, dispara LFSR y termina por longitud', () => {
    const sonido = new SonidoFake();
    const canal = new RegistrosCanal4(undefined, sonido);

    canal.escribirTemporizador(0x3f);
    canal.escribirVolumenYEnvoltorio(0xa9);
    canal.escribirFrecuenciaYAletoriedad(0xdb);
    canal.escribirControl(0xc0);

    assert.equal(canal.temporizadorInicial, 0x3f);
    assert.equal(canal.leerVolumenYEnvoltorio(), 0xa9);
    assert.equal(canal.cambioReloj, 0x0d);
    assert.equal(canal.anchoLFSR, 1);
    assert.equal(canal.divisorReloj, 3);
    assert.equal(canal.leerControl(), 0x4f);
    assert.equal(canal.activado, true);
    assert.ok(sonido.llamadas.some(([nombre]) => nombre === 'reiniciarLFSR'));

    canal.ciclosLongitud = 63;
    canal.enCiclos(16384);
    assert.equal(canal.activado, false);
    assert.deepEqual(sonido.llamadas.at(-1), ['desactivarCanal', 3]);
});

test('Canal 4 respeta el DAC, satura envolventes y aplica valores DMG', () => {
    const sonido = new SonidoFake();
    const canal = new RegistrosCanal4(undefined, sonido);

    canal.escribirVolumenYEnvoltorio(0x00);
    canal.escribirControl(0x80);
    assert.equal(canal.activado, false);
    assert.deepEqual(sonido.llamadas.at(-1), ['desactivarCanal', 3]);

    canal.escribirVolumenYEnvoltorio(0xf9);
    canal.escribirControl(0x80);
    canal.enCiclos(65536 * 2);
    assert.equal(canal.volumen, 15);

    canal.escribirVolumenYEnvoltorio(0x11);
    canal.escribirControl(0x80);
    canal.enCiclos(65536 * 2 * 2);
    assert.equal(canal.volumen, 0);

    const sonidoDMG = new SonidoFake();
    const canalDMG = new RegistrosCanal4(BGB_DMG0, sonidoDMG);
    assert.equal(canalDMG.temporizadorInicial, 0x3f);
    assert.equal(canalDMG.leerVolumenYEnvoltorio(), 0xf3);
    assert.equal(canalDMG.activado, false);
    assert.deepEqual(sonidoDMG.llamadas.at(-1), ['desactivarCanal', 3]);
});

test('Canal 1 cubre barrido válido y desbordamientos en ambos sentidos', () => {
    const sonido = new SonidoFake();
    const canal = new RegistrosCanal1(undefined, sonido);

    canal.periodo = 0x400;
    canal.activado = true;
    canal.escribirBarrido(0x11);
    canal.enCiclos(65536 * 4);
    assert.equal(canal.periodo, 0x600);
    assert.deepEqual(sonido.llamadas.at(-1), ['actualizarFrecuencia', 0, 0x600]);

    canal.periodo = 0x600;
    canal.activado = true;
    canal.escribirBarrido(0x11);
    canal.enCiclos(65536 * 4);
    assert.equal(canal.activado, false);
    assert.deepEqual(sonido.llamadas.at(-1), ['desactivarCanal', 0]);

    canal.periodo = 1;
    canal.activado = true;
    canal.escribirBarrido(0x18);
    canal.enCiclos(65536 * 4);
    assert.equal(canal.activado, false);
    assert.deepEqual(sonido.llamadas.at(-1), ['desactivarCanal', 0]);

    const canalDMG = new RegistrosCanal1(BGB_DMG0, new SonidoFake());
    assert.equal(canalDMG.leerBarrido(), 0);
    assert.equal(canalDMG.periodo, 0x7ff);
});

test('El volumen maestro enviado al backend usa el canal derecho', () => {
    const sonido = new SonidoFake();
    const canales = Array.from({ length: 4 }, () => ({ activado: false }));
    const audio = new RegistrosAudio(undefined, sonido, ...canales);

    audio.escribirVolumenMaestro(0xf3);
    assert.deepEqual(sonido.llamadas.at(-1), ['actualizarVolumenMaestro', 0.5]);
});

test('Sonido inicializa Web Audio y actualiza canales y volumen', (t) => {
    const dibujo = instalarEntornoAudio(t);
    const sonido = new Sonido();

    assert.equal(sonido.osciladores.slice(0, 3).every((nodo) => nodo.iniciado), true);
    assert.equal(sonido.osciladores[3].evento[0], 'audioprocess');
    assert.equal(dibujo.clearRect, 1);
    assert.equal(dibujo.stroke, 4);

    sonido.actualizarGanancia(0, 2);
    assert.equal(sonido.gananciaCanal[0], 1);
    assert.equal(sonido.ganancias[0].gain.valor, 0.055);
    sonido.actualizarGanancia(1, -1);
    assert.equal(sonido.gananciaCanal[1], 0);

    sonido.actualizarFrecuencia(0, 1024);
    assert.equal(sonido.osciladores[0].frequency.valor, 128);
    sonido.reproducirOnda(0, 2);
    assert.equal(sonido.osciladores[0].onda, sonido.ondas[2]);
    sonido.reproducirOndaAleatoria(1, 3);
    assert.equal(sonido.osciladores[1].onda, sonido.ondas[3]);

    sonido.actualizarVolumenMaestro(0.75);
    sonido.desactivarMaestro();
    assert.equal(sonido.maestro.gain.valor, 0);
    sonido.activarMaestro();
    assert.equal(sonido.maestro.gain.valor, 0.75);
    sonido.actualizarVolumen(0.4);
    assert.equal(sonido.final.gain.valor, 0.4);

    sonido.desactivarCanal(0);
    assert.equal(sonido.activados[0], false);
    assert.equal(sonido.ganancias[0].gain.valor, 0);
    sonido.activarCanal(0);
    assert.equal(sonido.activados[0], true);
    assert.equal(sonido.ganancias[0].gain.valor, 0.055);
});

test('Sonido genera la onda programable y configura los límites del LFSR', (t) => {
    instalarEntornoAudio(t);
    const sonido = new Sonido();
    const ondaRAM = Uint8Array.from({ length: 16 }, (_, indice) => indice * 0x11);

    sonido.actualizarOnda3(ondaRAM);
    assert.equal(sonido.osciladores[2].onda.real.length, 512);
    assert.equal(sonido.osciladores[2].onda.imag.length, 512);

    const frecuenciaAnterior = sonido.lfsrFrecuencia;
    sonido.actualizarDivisor(2, 3, 4);
    assert.equal(sonido.lfsrFrecuencia, frecuenciaAnterior);
    sonido.actualizarDivisor(3, 0, 0);
    assert.equal(sonido.lfsrFrecuencia, 524288);
    sonido.actualizarDivisor(3, 7, 2048);
    assert.equal(sonido.lfsrFrecuencia, 440);

    sonido.actualizarAnchoLFSR(1);
    sonido.lfsr = 0x7fff;
    sonido.lfsrFase = 0;
    sonido.lfsrFrecuencia = 48000;
    const salida = new Float32Array(4);
    sonido.procesarRuido({
        outputBuffer: {
            length: salida.length,
            sampleRate: 48000,
            getChannelData: () => salida,
        },
    });
    assert.notEqual(sonido.lfsr, 0x7fff);
    assert.equal(
        salida.every((muestra) => Math.abs(Math.abs(muestra) - 0.65) < 1e-6),
        true
    );

    sonido.reiniciarLFSR();
    assert.equal(sonido.lfsr, 0x7fff);
    assert.equal(sonido.lfsrFase, 0);
    assert.equal(sonido.lfsrSalida, 0);
});

test('Sonido desbloquea y libera todos los recursos de audio', async (t) => {
    const dibujo = instalarEntornoAudio(t);
    const sonido = new Sonido();

    await sonido.desbloquear();
    assert.equal(sonido.contextoAudio.reanudado, true);

    sonido.destruir();
    await Promise.resolve();
    assert.equal(sonido.destruido, true);
    assert.equal(dibujo.rafCancelado, 27);
    assert.equal(sonido.osciladores.every((nodo) => nodo.detenido && nodo.desconectado), true);
    assert.equal(sonido.ganancias.every((nodo) => nodo.desconectado), true);
    assert.equal(sonido.contextoAudio.cerrado, true);

    sonido.destruir();
    assert.equal(sonido.destruido, true);
});

test('Sonido tolera canvas y nodos opcionales ausentes', async (t) => {
    instalarEntornoAudio(t);
    globalThis.window = { webkitAudioContext: ContextoAudioFake };
    globalThis.document = { getElementById: () => null };
    const sonido = new Sonido();

    assert.equal(sonido._oscilloscopeRaf, null);
    sonido.osciladores[0].numberOfOutputs = 0;
    sonido.desactivarCanal(0);
    sonido.activarCanal(0);
    sonido.activarCanal(0);

    sonido.osciladores[1] = null;
    sonido.activados[1] = false;
    sonido.activarCanal(1);
    sonido.ganancias[2] = null;
    sonido.desactivarCanal(2);

    sonido.maestro = null;
    sonido.final = null;
    sonido.activarMaestro();
    sonido.desactivarMaestro();
    sonido.actualizarVolumenMaestro(0.2);
    sonido.actualizarVolumen(0.2);

    sonido.contextoAudio.state = 'running';
    await sonido.desbloquear();
    assert.equal(sonido.contextoAudio.reanudado, false);
});
