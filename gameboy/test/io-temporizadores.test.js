import assert from 'node:assert/strict';
import test from 'node:test';

import { Interrupciones } from '../cpu/interrupciones.js';
import { Botones } from '../io/botones.js';
import { RegistrosBotones } from '../memoria/registros/registros_botones.js';
import { RegistrosInterrupciones } from '../memoria/registros/registros_interrupciones.js';
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
