import assert from 'node:assert/strict';
import test from 'node:test';

import { Interrupciones } from '../cpu/interrupciones.js';
import { Botones } from '../io/botones.js';
import { Pantalla } from '../io/pantalla.js';
import { RegistrosBotones } from '../memoria/registros/registros_botones.js';
import { RegistrosInterrupciones } from '../memoria/registros/registros_interrupciones.js';
import { RegistrosLCD } from '../memoria/registros/registros_lcd.js';
import {
    BGB_DMG0,
    BOTON_A,
    BOTON_ABAJO,
    BOTON_ARRIBA,
    BOTON_B,
    BOTON_DERECHA,
    BOTON_IZQUIERDA,
    BOTON_SELECT,
    BOTON_START,
    JOYPAD_INT,
    SELECCIONADO_AMBOS,
    SELECCIONADO_BOTONES,
    SELECCIONADO_DIRECCION,
    TIMER_INT,
} from '../constantes.js';

function crearPantallaSinCanvas() {
    const regLCD = new RegistrosLCD();
    const regInt = new RegistrosInterrupciones();
    const pantalla = Object.create(Pantalla.prototype);

    Object.assign(pantalla, {
        modo: 0,
        dots: 0,
        linea: 0,
        lineaVentana: 0,
        ventanaVisible: false,
        terminada: false,
        duracionModo3: 172,
        duracionModo0: 204,
        scrollXLinea: 0,
        scrollYLinea: 0,
        windowXLinea: 0,
        windowYLinea: 0,
        BGTileMapAreaLinea: false,
        BGWindowTileDataAreaLinea: false,
        _statLYCPrev: false,
        lcdEnableAnterior: false,
        regLCD,
        ints: { regs: regInt },
        dibujarLinea() {},
        dibujarPantalla() {},
    });

    return { pantalla, regLCD };
}

function avanzarCiclosPantalla(pantalla, ciclos) {
    for (let restantes = ciclos; restantes > 0; restantes -= 4) {
        pantalla.enCiclos(Math.min(4, restantes));
    }
}

function crearPantallaParaRender() {
    const regLCD = new RegistrosLCD();
    const pantalla = Object.create(Pantalla.prototype);

    Object.assign(pantalla, {
        regLCD,
        linea: 0,
        lineaVentana: 0,
        ventanaVisible: false,
        windowXLinea: 0,
        scrollXLinea: 0,
        scrollYLinea: 0,
        BGTileMapAreaLinea: false,
        BGWindowTileDataAreaLinea: false,
        debugColorearCapas: false,
        valorColor32: Uint32Array.of(
            0xffffffff,
            0xff111111,
            0xff777777,
            0xff000000
        ),
        lcd: {
            data: new Uint8ClampedArray(160 * 144 * 4),
        },
        _lcd32: null,
        _bgIdx: new Uint8Array(160),
        _mask8: Uint8Array.of(0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01),
    });

    regLCD.lineaY = 0;
    regLCD.objEnable = true;
    regLCD.BGWindowEnable = false;

    return { pantalla, regLCD };
}

test('El divisor acumula ciclos incluso con TIMA desactivado', () => {
    const registros = new RegistrosInterrupciones();
    const interrupciones = new Interrupciones(registros);

    interrupciones.enCiclos(255);
    assert.equal(registros.divisor, 0);
    interrupciones.enCiclos(1);
    assert.equal(registros.divisor, 1);
    interrupciones.enCiclos(256 * 255);
    assert.equal(registros.divisor, 0);
});

test('TIMA respeta la frecuencia, conserva ciclos parciales y solicita interrupcion', () => {
    const registros = new RegistrosInterrupciones();
    const interrupciones = new Interrupciones(registros);
    registros.escribirTAC(0x05);
    registros.contador = 0xfe;
    registros.contadorModulo = 0xa7;

    interrupciones.enCiclos(15);
    assert.equal(registros.contador, 0xfe);
    interrupciones.enCiclos(1);
    assert.equal(registros.contador, 0xff);
    interrupciones.enCiclos(16);
    assert.equal(registros.contador, 0xa7);
    assert.equal(registros.flagsInterrupcion[TIMER_INT], true);

    registros.flagsInterrupcion[TIMER_INT] = false;
    interrupciones.enCiclos(16 * 3);
    assert.equal(registros.contador, 0xaa);
    assert.equal(registros.flagsInterrupcion[TIMER_INT], false);
});

test('Al encender LCD, LY cambia entre los delay 109 y 110 de Blargg', () => {
    for (const [delay, lineaEsperada] of [
        [109, 0],
        [110, 1],
    ]) {
        const { pantalla, regLCD } = crearPantallaSinCanvas();

        regLCD.escribirLCDControl(0);
        pantalla.enCiclos(4);
        regLCD.escribirLCDControl(0x81);

        // LDH (LCDC),A consume 12 clocks en este núcleo; después Blargg
        // espera el número indicado de ciclos de máquina (4 clocks cada uno).
        pantalla.enCiclos(12);
        avanzarCiclosPantalla(pantalla, delay * 4);

        assert.equal(regLCD.lineaY, lineaEsperada, `delay ${delay}`);

        if (delay === 110) {
            avanzarCiclosPantalla(pantalla, 455);
            assert.equal(regLCD.lineaY, 1, 'la segunda línea aún no ha terminado');
            pantalla.enCiclos(1);
            assert.equal(regLCD.lineaY, 2, 'las líneas normales duran 456 dots');
        }
    }
});

test('Los sprites DMG priorizan menor X y después menor índice OAM', () => {
    const { pantalla, regLCD } = crearPantallaParaRender();
    const primero = regLCD.objetos[0];
    const segundo = regLCD.objetos[1];

    primero.y = segundo.y = 16;
    primero.x = segundo.x = 20;
    primero.tileIndice = 1;
    segundo.tileIndice = 2;

    regLCD.vRAM[1 * 16] = 0xff;
    regLCD.vRAM[2 * 16] = 0xff;
    regLCD.vRAM[(2 * 16) + 1] = 0xff;

    pantalla.dibujarLinea();
    assert.equal(pantalla._lcd32[12], 0xff111111);

    primero.x = 21;
    segundo.x = 20;
    pantalla.dibujarLinea();
    assert.equal(pantalla._lcd32[12], 0xff000000);
});

test('Un píxel OBJ transparente permite ver el siguiente sprite', () => {
    const { pantalla, regLCD } = crearPantallaParaRender();
    const primero = regLCD.objetos[0];
    const segundo = regLCD.objetos[1];

    primero.y = segundo.y = 16;
    primero.x = segundo.x = 20;
    primero.tileIndice = 1;
    segundo.tileIndice = 2;
    regLCD.vRAM[2 * 16] = 0xff;

    pantalla.dibujarLinea();

    assert.equal(pantalla._lcd32[12], 0xff111111);
});

test('La coordenada X de OAM coloca el sprite exactamente en X menos 8', () => {
    const { pantalla, regLCD } = crearPantallaParaRender();
    const objeto = regLCD.objetos[0];

    objeto.y = 16;
    objeto.x = 20;
    objeto.tileIndice = 1;
    regLCD.vRAM[1 * 16] = 0x81;

    pantalla.dibujarLinea();

    assert.equal(pantalla._lcd32[11], 0xffffffff);
    assert.equal(pantalla._lcd32[12], 0xff111111);
    assert.equal(pantalla._lcd32[19], 0xff111111);
    assert.equal(pantalla._lcd32[20], 0xffffffff);
});

test('RegistrosBotones selecciona grupos y combina entradas activas en bajo', () => {
    const registros = new RegistrosBotones(BGB_DMG0);
    assert.equal(registros.leerRegBotones(), 0xff);

    registros.botones = [false, true, false, true];
    registros.direccionales = [true, false, true, false];

    registros.escribirRegBotones(0x10);
    assert.equal(registros.seleccion, SELECCIONADO_BOTONES);
    assert.equal(registros.leerRegBotones(), 0xda);

    registros.escribirRegBotones(0x20);
    assert.equal(registros.seleccion, SELECCIONADO_DIRECCION);
    assert.equal(registros.leerRegBotones(), 0xe5);

    registros.escribirRegBotones(0x00);
    assert.equal(registros.seleccion, SELECCIONADO_AMBOS);
    assert.equal(registros.leerRegBotones(), 0xc0);

    registros.escribirRegBotones(0x30);
    assert.equal(registros.seleccion, SELECCIONADO_AMBOS);
    assert.equal(registros.leerRegBotones(), 0xff);
});

test('Botones pulsa y suelta las ocho entradas e interrumpe solo el grupo seleccionado', () => {
    const registros = new RegistrosBotones(BGB_DMG0);
    const regInt = new RegistrosInterrupciones();
    const botones = new Botones(registros, { regs: regInt });
    const acciones = [BOTON_A, BOTON_B, BOTON_SELECT, BOTON_START];
    const direcciones = [BOTON_DERECHA, BOTON_IZQUIERDA, BOTON_ARRIBA, BOTON_ABAJO];

    registros.escribirRegBotones(0x10);
    for (let i = 0; i < acciones.length; i++) {
        regInt.flagsInterrupcion[JOYPAD_INT] = false;
        botones.pulsar(acciones[i]);
        assert.equal(registros.botones[i], false);
        assert.equal(regInt.flagsInterrupcion[JOYPAD_INT], true);
        botones.soltar(acciones[i]);
        assert.equal(registros.botones[i], true);
    }

    regInt.flagsInterrupcion[JOYPAD_INT] = false;
    botones.pulsar(BOTON_ARRIBA);
    assert.equal(regInt.flagsInterrupcion[JOYPAD_INT], false);

    registros.escribirRegBotones(0x20);
    for (const boton of direcciones) {
        regInt.flagsInterrupcion[JOYPAD_INT] = false;
        botones.pulsar(boton);
        assert.equal(regInt.flagsInterrupcion[JOYPAD_INT], true);
        botones.soltar(boton);
    }
});
