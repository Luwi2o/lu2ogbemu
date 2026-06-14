import assert from 'node:assert/strict';
import test from 'node:test';

import { setBootROM } from '../bootrom.js';
import { Registros } from '../cpu/registros.js';
import { RegistrosInterrupciones } from '../memoria/registros/registros_interrupciones.js';
import { RegistrosLCD } from '../memoria/registros/registros_lcd.js';
import { A, B, BGB, BGB_DMG0, C, D, DMG0, E, F, H, L } from '../constantes.js';

test('Registros inicializa el estado DMG y permite accesos de 8 y 16 bits', () => {
    const registros = new Registros(BGB_DMG0);

    assert.deepEqual(Array.from(registros.R), [0x00, 0x13, 0x00, 0xd8, 0x01, 0x4d, 0xb0, 0x01]);
    assert.equal(registros.PC, 0x0100);
    assert.equal(registros.SP, 0xfffe);

    registros.escribir8Bits(A, 0x1ff);
    assert.equal(registros.leer8Bits(A), 0xff);
    registros.escribir16Bits(H, L, 0xabcd);
    assert.equal(registros.leer16Bits(H, L), 0xabcd);
});

test('Registros restaura todos los registros desde un estado', () => {
    const valores = [1, 2, 3, 4, 5, 6, 7, 8];
    const registros = new Registros(BGB_DMG0, {
        registros: { R: valores, PC: 0x1234, SP: 0xabcd },
    });

    assert.deepEqual(Array.from(registros.R), valores);
    assert.equal(registros.PC, 0x1234);
    assert.equal(registros.SP, 0xabcd);
    assert.equal(registros.leer16Bits(B, C), 0x0102);
    assert.equal(registros.leer16Bits(D, E), 0x0304);
    assert.equal(registros.leer16Bits(F, A), 0x0708);
});

test('Registros aplica las variantes DMG0, BGB y arranque con boot ROM', (t) => {
    const dmg0 = new Registros(DMG0);
    assert.deepEqual(Array.from(dmg0.R), [0xff, 0x13, 0x00, 0xc1, 0x84, 0x03, 0x00, 0x01]);

    const bgb = new Registros(BGB);
    assert.deepEqual(Array.from(bgb.R), [0x00, 0x14, 0x00, 0x00, 0xc0, 0x60, 0x00, 0x01]);

    setBootROM(Uint8Array.of(0x31, 0xfe));
    t.after(() => setBootROM(null));
    const conBootROM = new Registros(BGB_DMG0);
    assert.deepEqual(Array.from(conBootROM.R), Array(8).fill(0));
    assert.equal(conBootROM.PC, 0);
    assert.equal(conBootROM.SP, 0xfffe);
});

test('RegistrosLCD conserva todos los bits de LCDC y STAT', () => {
    const lcd = new RegistrosLCD();

    for (let dato = 0; dato <= 0xff; dato++) {
        lcd.escribirLCDControl(dato);
        assert.equal(lcd.leerLCDControl(), dato, `LCDC ${dato.toString(16)}`);

        lcd.iniciarLCDEstado(dato);
        assert.equal(lcd.leerLCDEstado(), dato, `STAT ${dato.toString(16)}`);
    }

    lcd.iniciarLCDEstado(0x07);
    lcd.escribirLCDEstado(0xf8);
    assert.equal(lcd.leerLCDEstado(), 0xff, 'STAT conserva los tres bits de solo lectura');
});

test('RegistrosLCD codifica paletas y atributos OAM exhaustivamente', () => {
    const lcd = new RegistrosLCD();

    for (let dato = 0; dato <= 0xff; dato++) {
        lcd.escribirPaletaBGVentana(dato);
        lcd.escribirPaletaObj0(dato);
        lcd.escribirPaletaObj1(dato);
        lcd.setObjAtributos(0, dato);

        assert.equal(lcd.leerPaletaBGVentana(), dato);
        assert.equal(lcd.leerPaletaObj0(), dato);
        assert.equal(lcd.leerPaletaObj1(), dato);
        assert.equal(lcd.getObjAtributos(0), dato);
    }

    assert.equal(lcd.objetos.length, 40);
    lcd.setObjYPos(39, 0x1ff);
    lcd.setObjXPos(39, 0x42);
    lcd.setObjTileIndice(39, 0x24);
    assert.equal(lcd.getObjYPos(39), 0xff);
    assert.equal(lcd.objetos[39].x, 0x42);
    assert.equal(lcd.objetos[39].tileIndice, 0x24);
});

test('RegistrosLCD aplica los valores de encendido de BGB_DMG0', () => {
    const lcd = new RegistrosLCD(BGB_DMG0);

    assert.equal(lcd.leerLCDControl(), 0x91);
    assert.equal(lcd.leerLCDEstado(), 0x85);
    assert.equal(lcd.leerPaletaBGVentana(), 0xfc);
    assert.equal(lcd.lineaY, 0);
});

test('RegistrosInterrupciones codifica IF, IE y las cuatro frecuencias TAC', () => {
    const registros = new RegistrosInterrupciones();
    const periodos = [1024, 16, 64, 256];

    for (let dato = 0; dato <= 0xff; dato++) {
        registros.escribirIF(dato);
        registros.escribirIE(dato);
        assert.equal(registros.leerIF(), dato & 0x1f);
        assert.equal(registros.leerIE(), dato & 0x1f);
    }

    for (let seleccion = 0; seleccion < 4; seleccion++) {
        registros.escribirTAC(0x04 | seleccion);
        assert.equal(registros.contActivado, true);
        assert.equal(registros.seleccionReloj, seleccion);
        assert.equal(registros.reloj, periodos[seleccion]);
        assert.equal(registros.leerTAC(), 0xfc | seleccion);
    }

    registros.escribirTAC(0);
    assert.equal(registros.contActivado, false);
    assert.equal(registros.leerTAC(), 0xf8);
});

test('RegistrosInterrupciones restaura el estado y arranca con valores DMG', () => {
    const inicial = new RegistrosInterrupciones(BGB_DMG0);
    assert.equal(inicial.leerIF(), 0x01);
    assert.equal(inicial.leerIE(), 0);
    assert.equal(inicial.leerTAC(), 0xf8);

    const estado = {
        interrupcionActivada: [true, false, true, false, true],
        flagsInterrupcion: [false, true, false, true, false],
        contador: 0x12,
        contadorModulo: 0x34,
        contActivado: true,
        seleccionReloj: 2,
        reloj: 64,
        datoTAC: 0x06,
        divisor: 0x56,
    };
    const restaurados = new RegistrosInterrupciones(undefined, {
        registrosInterrupciones: estado,
    });

    assert.equal(restaurados.leerIE(), 0x15);
    assert.equal(restaurados.leerIF(), 0x0a);
    assert.equal(restaurados.contador, 0x12);
    assert.equal(restaurados.contadorModulo, 0x34);
    assert.equal(restaurados.divisor, 0x56);
});
