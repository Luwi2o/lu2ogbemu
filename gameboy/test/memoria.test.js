import assert from 'node:assert/strict';
import test from 'node:test';

import {
    GB_TIPO_CARTUCHO_MBC1_RAM,
    GB_TIPO_CARTUCHO_MBC2,
    GB_TIPO_CARTUCHO_MBC3_RAM,
    GB_TIPO_CARTUCHO_MBC5_RAM,
    GB_TIPO_CARTUCHO_ROM_RAM,
} from '../constantes.js';
import { crearMemoria } from './helpers.js';

test('Memoria mapea ROM, VRAM, WRAM, ECHO, OAM, IO, HRAM e IE', () => {
    const { memoria, regLCD, regInt } = crearMemoria({
        tipo: GB_TIPO_CARTUCHO_ROM_RAM,
        tamanyoRAM: 0x02,
    });

    assert.equal(memoria.leer8Bits(0x0000), 0);
    assert.equal(memoria.leer8Bits(0x4000), 1);

    const casos = [
        [0x8000, 0x12],
        [0xa000, 0x23],
        [0xc000, 0x34],
        [0xd000, 0x45],
        [0xff7f, 0x56],
        [0xff80, 0x67],
        [0xfffe, 0x78],
    ];
    for (const [direccion, dato] of casos) {
        memoria.escribir8Bits(direccion, dato);
        assert.equal(memoria.leer8Bits(direccion), dato);
    }

    memoria.escribir8Bits(0xe123, 0x89);
    assert.equal(memoria.leer8Bits(0xc123), 0x89);
    memoria.escribir8Bits(0xd234, 0x9a);
    assert.equal(memoria.leer8Bits(0xf234), 0x9a);

    for (let offset = 0; offset < 4; offset++) {
        memoria.escribir8Bits(0xfe00 + offset, 0xa0 + offset);
        assert.equal(memoria.leer8Bits(0xfe00 + offset), 0xa0 + offset);
    }

    memoria.escribir8Bits(0xff40, 0x91);
    assert.equal(regLCD.leerLCDControl(), 0x91);
    memoria.escribir8Bits(0xffff, 0x15);
    assert.equal(regInt.leerIE(), 0x15);
});

test('Memoria lee y escribe palabras little-endian y rechaza limites invalidos', () => {
    const { memoria } = crearMemoria();

    memoria.escribir16Bits(0xc100, 0xabcd);
    assert.equal(memoria.leer8Bits(0xc100), 0xcd);
    assert.equal(memoria.leer8Bits(0xc101), 0xab);
    assert.equal(memoria.leer16Bits(0xc100), 0xabcd);

    assert.equal(memoria.leer8Bits(-1), 0xff);
    assert.equal(memoria.leer8Bits(0x10000), 0xff);
    assert.equal(memoria.leer16Bits(0xffff), 0);
    memoria.escribir8Bits(-1, 0x12);
    memoria.escribir8Bits(0x10000, 0x34);
    memoria.escribir16Bits(0xffff, 0x5678);
    assert.equal(memoria.leer8Bits(0xfffe), 0);
});

test('DMA copia 40 entradas completas desde WRAM a OAM', () => {
    const { memoria, regLCD } = crearMemoria();

    for (let i = 0; i < 160; i++) {
        memoria.escribir8Bits(0xc000 + i, (i * 3) & 0xff);
    }
    memoria.escribir8Bits(0xff46, 0xc0);

    for (let i = 0; i < 40; i++) {
        assert.equal(regLCD.objetos[i].y, (i * 12) & 0xff);
        assert.equal(regLCD.objetos[i].x, (i * 12 + 3) & 0xff);
        assert.equal(regLCD.objetos[i].tileIndice, (i * 12 + 6) & 0xff);
        assert.equal(regLCD.getObjAtributos(i), (i * 12 + 9) & 0xff);
    }
});

test('MBC1 cambia bancos ROM y RAM, evita el banco cero y respeta enable', () => {
    const { memoria } = crearMemoria({
        bancos: 8,
        tipo: GB_TIPO_CARTUCHO_MBC1_RAM,
        tamanyoRAM: 0x03,
    });

    memoria.escribir8Bits(0x2000, 0x02);
    assert.equal(memoria.leer8Bits(0x4000), 2);
    memoria.escribir8Bits(0x2000, 0x00);
    assert.equal(memoria.leer8Bits(0x4000), 1);

    memoria.escribir8Bits(0x0000, 0x00);
    memoria.escribir8Bits(0xa000, 0x55);
    assert.equal(memoria.leer8Bits(0xa000), 0);

    memoria.escribir8Bits(0x0000, 0x0a);
    memoria.escribir8Bits(0x6000, 1);
    memoria.escribir8Bits(0x4000, 2);
    memoria.escribir8Bits(0xa000, 0x66);
    memoria.escribir8Bits(0x4000, 0);
    assert.notEqual(memoria.leer8Bits(0xa000), 0x66);
    memoria.escribir8Bits(0x4000, 2);
    assert.equal(memoria.leer8Bits(0xa000), 0x66);
});

test('MBC2 usa nibbles y el bit 8 de la direccion para seleccionar banco', () => {
    const { memoria } = crearMemoria({ bancos: 4, tipo: GB_TIPO_CARTUCHO_MBC2 });

    memoria.escribir8Bits(0x0000, 0x0a);
    memoria.escribir8Bits(0xa123, 0xfe);
    assert.equal(memoria.leer8Bits(0xa123), 0x0e);
    assert.equal(memoria.leer8Bits(0xa323), 0x0e);

    memoria.escribir8Bits(0x2100, 0x02);
    assert.equal(memoria.leer8Bits(0x4000), 2);
    memoria.escribir8Bits(0x2100, 0);
    assert.equal(memoria.leer8Bits(0x4000), 1);
});

test('MBC3 y MBC5 seleccionan bancos de ROM y RAM', () => {
    const mbc3 = crearMemoria({
        bancos: 8,
        tipo: GB_TIPO_CARTUCHO_MBC3_RAM,
        tamanyoRAM: 0x03,
    }).memoria;
    mbc3.escribir8Bits(0x0000, 0x0a);
    mbc3.escribir8Bits(0x2000, 3);
    assert.equal(mbc3.leer8Bits(0x4000), 3);
    mbc3.escribir8Bits(0x4000, 2);
    mbc3.escribir8Bits(0xa000, 0x77);
    assert.equal(mbc3.leer8Bits(0xa000), 0x77);

    const mbc5 = crearMemoria({
        bancos: 4,
        tipo: GB_TIPO_CARTUCHO_MBC5_RAM,
        tamanyoRAM: 0x03,
    }).memoria;
    mbc5.escribir8Bits(0x0000, 0x0a);
    mbc5.escribir8Bits(0x2000, 2);
    assert.equal(mbc5.leer8Bits(0x4000), 2);
    mbc5.escribir8Bits(0x4000, 3);
    mbc5.escribir8Bits(0xa000, 0x88);
    assert.equal(mbc5.leer8Bits(0xa000), 0x88);
});

test('La RAM de onda y los registros IO delegan en sus componentes', () => {
    const { memoria, regCnl1, regCnl3, regInt } = crearMemoria();

    for (let i = 0; i < 16; i++) {
        memoria.escribir8Bits(0xff30 + i, 0xf0 + i);
        assert.equal(memoria.leer8Bits(0xff30 + i), 0xf0 + i);
    }
    assert.equal(regCnl3.ondaActualizada, true);

    memoria.escribir8Bits(0xff26, 0x80);
    memoria.escribir8Bits(0xff10, 0x6d);
    assert.equal(regCnl1.leerBarrido(), 0x6d);
    memoria.escribir8Bits(0xff05, 0x12);
    memoria.escribir8Bits(0xff06, 0x34);
    memoria.escribir8Bits(0xff07, 0x05);
    assert.equal(regInt.contador, 0x12);
    assert.equal(regInt.contadorModulo, 0x34);
    assert.equal(regInt.reloj, 16);
});

test('Los registros de audio y Wave RAM aplican sus máscaras de lectura', () => {
    const { memoria } = crearMemoria();
    const mascaras = [
        0x80, 0x3f, 0x00, 0xff, 0xbf, 0xff, 0x3f, 0x00,
        0xff, 0xbf, 0x7f, 0xff, 0x9f, 0xff, 0xbf, 0xff,
        0xff, 0x00, 0x00, 0xbf, 0x00, 0x00, 0x70, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ];

    memoria.escribir8Bits(0xff26, 0x80);
    for (let dato = 0; dato <= 0xff; dato++) {
        for (let offset = 0; offset < mascaras.length; offset++) {
            const direccion = 0xff10 + offset;
            if(direccion === 0xff26) continue;

            memoria.escribir8Bits(direccion, dato);
            assert.equal(
                memoria.leer8Bits(direccion),
                dato | mascaras[offset],
                `$${direccion.toString(16)} con $${dato.toString(16)}`
            );
        }
    }
});

test('Apagar el APU borra sus registros pero conserva Wave RAM', () => {
    const { memoria } = crearMemoria();
    const mascaras = [
        0x80, 0x3f, 0x00, 0xff, 0xbf, 0xff, 0x3f, 0x00,
        0xff, 0xbf, 0x7f, 0xff, 0x9f, 0xff, 0xbf, 0xff,
        0xff, 0x00, 0x00, 0xbf, 0x00, 0x00,
    ];

    memoria.escribir8Bits(0xff26, 0x80);
    for (let direccion = 0xff10; direccion < 0xff26; direccion++) {
        memoria.escribir8Bits(direccion, 0xff);
    }
    for (let direccion = 0xff30; direccion <= 0xff3f; direccion++) {
        memoria.escribir8Bits(direccion, 0x37);
    }

    memoria.escribir8Bits(0xff26, 0);
    memoria.escribir8Bits(0xff26, 0x80);

    for (let offset = 0; offset < mascaras.length; offset++) {
        assert.equal(
            memoria.leer8Bits(0xff10 + offset),
            mascaras[offset],
            `$${(0xff10 + offset).toString(16)}`
        );
    }
    assert.equal(memoria.leer8Bits(0xff26), 0xf0);
    for (let direccion = 0xff30; direccion <= 0xff3f; direccion++) {
        assert.equal(memoria.leer8Bits(direccion), 0x37);
    }
});

test('El APU apagado ignora escrituras salvo en NR52 y Wave RAM', () => {
    const { memoria } = crearMemoria();
    const mascaras = [
        0x80, 0x3f, 0x00, 0xff, 0xbf, 0xff, 0x3f, 0x00,
        0xff, 0xbf, 0x7f, 0xff, 0x9f, 0xff, 0xbf, 0xff,
        0xff, 0x00, 0x00, 0xbf, 0x00, 0x00,
    ];

    memoria.escribir8Bits(0xff26, 0);
    for (let offset = 0; offset < mascaras.length; offset++) {
        memoria.escribir8Bits(0xff10 + offset, 0xff);
        assert.equal(memoria.leer8Bits(0xff10 + offset), mascaras[offset]);
    }

    memoria.escribir8Bits(0xff30, 0xa5);
    assert.equal(memoria.leer8Bits(0xff30), 0xa5);
});
