import assert from 'node:assert/strict';
import test from 'node:test';

import { setBootROM } from '../bootrom.js';
import { A, B, BGB_DMG0, C, D, E, F, H, L, TIMER_INT } from '../constantes.js';
import { crearCPU } from './helpers.js';

const REGISTROS_OPCODE = [B, C, D, E, H, L, null, A];

function flags(cpu) {
    return { Z: cpu.Z, N: cpu.N, H: cpu.H, C: cpu.C };
}

function referenciaALU(operacion, a, valor, carry) {
    let resultado = a;
    let Z = 0;
    let N = 0;
    let H = 0;
    let C = 0;

    switch (operacion) {
        case 0: {
            const suma = a + valor;
            resultado = suma & 0xff;
            H = (a & 0x0f) + (valor & 0x0f) > 0x0f ? 1 : 0;
            C = suma > 0xff ? 1 : 0;
            break;
        }
        case 1: {
            const suma = a + valor + carry;
            resultado = suma & 0xff;
            H = (a & 0x0f) + (valor & 0x0f) + carry > 0x0f ? 1 : 0;
            C = suma > 0xff ? 1 : 0;
            break;
        }
        case 2: {
            const resta = a - valor;
            resultado = resta & 0xff;
            N = 1;
            H = (a & 0x0f) < (valor & 0x0f) ? 1 : 0;
            C = a < valor ? 1 : 0;
            break;
        }
        case 3: {
            const resta = a - valor - carry;
            resultado = resta & 0xff;
            N = 1;
            H = (a & 0x0f) < (valor & 0x0f) + carry ? 1 : 0;
            C = a < valor + carry ? 1 : 0;
            break;
        }
        case 4:
            resultado = a & valor;
            H = 1;
            break;
        case 5:
            resultado = a ^ valor;
            break;
        case 6:
            resultado = a | valor;
            break;
        case 7: {
            const resta = a - valor;
            resultado = a;
            Z = (resta & 0xff) === 0 ? 1 : 0;
            N = 1;
            H = (a & 0x0f) < (valor & 0x0f) ? 1 : 0;
            C = a < valor ? 1 : 0;
            return { resultado, Z, N, H, C };
        }
    }

    Z = resultado === 0 ? 1 : 0;
    return { resultado, Z, N, H, C };
}

function referenciaRotacion(grupo, valor, carry) {
    let resultado;
    let C;

    switch (grupo) {
        case 0:
            C = valor >> 7;
            resultado = ((valor << 1) | C) & 0xff;
            break;
        case 1:
            C = valor & 1;
            resultado = (valor >> 1) | (C << 7);
            break;
        case 2: {
            const carryAnterior = carry;
            C = valor >> 7;
            resultado = ((valor << 1) | carryAnterior) & 0xff;
            break;
        }
        case 3: {
            const carryAnterior = carry;
            C = valor & 1;
            resultado = (valor >> 1) | (carryAnterior << 7);
            break;
        }
        case 4:
            C = valor >> 7;
            resultado = (valor << 1) & 0xff;
            break;
        case 5:
            C = valor & 1;
            resultado = (valor >> 1) | (valor & 0x80);
            break;
        case 6:
            C = 0;
            resultado = ((valor & 0x0f) << 4) | (valor >> 4);
            break;
        case 7:
            C = valor & 1;
            resultado = valor >> 1;
            break;
    }

    return { resultado, C, Z: resultado === 0 ? 1 : 0 };
}

test('CPU inicializa flags, empaqueta F y expone utilidades de 16 bits', () => {
    const { cpu } = crearCPU();

    assert.equal(cpu.msb(0xabcd), 0xab);
    assert.equal(cpu.lsb(0xabcd), 0xcd);
    assert.equal(cpu.sinSigno16Bits(0xcd, 0xab), 0xabcd);

    cpu.Z = 1;
    cpu.N = 0;
    cpu.H = 1;
    cpu.C = 1;
    cpu.registros.R[F] = 0x0f;
    cpu.actualizarFlag();
    assert.equal(cpu.registros.R[F], 0xb0);
});

test('CPU decodifica exhaustivamente la matriz LD r,r y (HL)', () => {
    for (let opcode = 0x40; opcode <= 0x7f; opcode++) {
        if (opcode === 0x76) continue;

        const { cpu, memoria } = crearCPU();
        const destino = (opcode >> 3) & 0x07;
        const origen = opcode & 0x07;
        const valores = [0x11, 0x22, 0x33, 0x44, 0xc1, 0x00, 0x66, 0x77];

        cpu.registros.R.set(valores);
        cpu.registros.R[H] = 0xc1;
        cpu.registros.R[L] = 0x00;
        memoria.escribir8Bits(0xc100, 0x5a);
        const esperado = origen === 6 ? 0x5a : cpu.registros.R[REGISTROS_OPCODE[origen]];

        cpu.ejecutar(opcode);

        if (destino === 6) {
            assert.equal(memoria.leer8Bits(0xc100), esperado, `opcode ${opcode.toString(16)}`);
            assert.equal(cpu.ciclos, 8);
        } else {
            assert.equal(
                cpu.registros.R[REGISTROS_OPCODE[destino]],
                esperado,
                `opcode ${opcode.toString(16)}`
            );
            assert.equal(cpu.ciclos, origen === 6 ? 8 : 4);
        }
    }
});

test('CPU decodifica exhaustivamente ADD, ADC, SUB, SBC, AND, XOR, OR y CP', () => {
    for (let opcode = 0x80; opcode <= 0xbf; opcode++) {
        const { cpu, memoria } = crearCPU();
        const operacion = (opcode - 0x80) >> 3;
        const indiceOrigen = opcode & 0x07;

        cpu.registros.R[A] = 0x8f;
        cpu.registros.R[B] = 0x71;
        cpu.registros.R[C] = 0x01;
        cpu.registros.R[D] = 0x10;
        cpu.registros.R[E] = 0xff;
        cpu.registros.R[H] = 0xc1;
        cpu.registros.R[L] = 0x00;
        memoria.escribir8Bits(0xc100, 0x81);
        cpu.C = 1;

        const a = cpu.registros.R[A];
        const valor =
            indiceOrigen === 6 ? 0x81 : cpu.registros.R[REGISTROS_OPCODE[indiceOrigen]];
        const esperado = referenciaALU(operacion, a, valor, 1);

        cpu.ejecutar(opcode);

        assert.equal(cpu.registros.R[A], esperado.resultado, `A en ${opcode.toString(16)}`);
        assert.deepEqual(flags(cpu), {
            Z: esperado.Z,
            N: esperado.N,
            H: esperado.H,
            C: esperado.C,
        });
        assert.equal(cpu.ciclos, indiceOrigen === 6 ? 8 : 4);
    }
});

test('CPU ejecuta cargas inmediatas, indirectas, IO y de 16 bits', () => {
    const { cpu, memoria } = crearCPU();
    cpu.registros.PC = 0xc000;

    memoria.escribir8Bits(0xc000, 0x69);
    cpu.ld_r_i_8b(B);
    assert.equal(cpu.registros.R[B], 0x69);
    assert.equal(cpu.registros.PC, 0xc001);

    cpu.registros.R[H] = 0xc2;
    cpu.registros.R[L] = 0x00;
    cpu.registros.R[A] = 0x42;
    cpu.ld_mrr_r_8b(H, L, A, 1);
    assert.equal(memoria.leer8Bits(0xc200), 0x42);
    assert.equal(cpu.registros.leer16Bits(H, L), 0xc201);

    memoria.escribir8Bits(0xc201, 0x24);
    cpu.ld_r_mrr_8b(A, H, L, -1);
    assert.equal(cpu.registros.R[A], 0x24);
    assert.equal(cpu.registros.leer16Bits(H, L), 0xc200);

    cpu.registros.PC = 0xc010;
    memoria.escribir8Bits(0xc010, 0x80);
    memoria.escribir8Bits(0xff80, 0x55);
    cpu.ld_r_mff00i_8b(C);
    assert.equal(cpu.registros.R[C], 0x55);

    cpu.registros.PC = 0xc020;
    memoria.escribir8Bits(0xc020, 0x34);
    memoria.escribir8Bits(0xc021, 0x12);
    cpu.ld_rr_ii_16b(D, E);
    assert.equal(cpu.registros.leer16Bits(D, E), 0x1234);

    cpu.registros.SP = 0xabcd;
    cpu.registros.PC = 0xc030;
    memoria.escribir8Bits(0xc030, 0x00);
    memoria.escribir8Bits(0xc031, 0xc3);
    cpu.ld_mii_sp_16b();
    assert.equal(memoria.leer16Bits(0xc300), 0xabcd);
});

test('CPU cubre todas las variantes auxiliares de carga', () => {
    const { cpu, memoria } = crearCPU();

    cpu.registros.R[C] = 0x80;
    memoria.escribir8Bits(0xff80, 0x41);
    cpu.ld_r_mff00r_8b(A, C);
    assert.equal(cpu.registros.R[A], 0x41);
    cpu.registros.R[B] = 0x52;
    cpu.ld_mff00r_r_8b(C, B);
    assert.equal(memoria.leer8Bits(0xff80), 0x52);

    cpu.registros.PC = 0xc000;
    memoria.escribir16Bits(0xc000, 0xc200);
    memoria.escribir8Bits(0xc200, 0x63);
    cpu.ld_r_mii_8b(D);
    assert.equal(cpu.registros.R[D], 0x63);

    cpu.registros.PC = 0xc010;
    memoria.escribir16Bits(0xc010, 0xc201);
    cpu.registros.R[E] = 0x74;
    cpu.ld_mii_r_8b(E);
    assert.equal(memoria.leer8Bits(0xc201), 0x74);

    cpu.registros.PC = 0xc020;
    memoria.escribir8Bits(0xc020, 0x81);
    cpu.registros.R[A] = 0x85;
    cpu.ld_mff00i_r_8b(A);
    assert.equal(memoria.leer8Bits(0xff81), 0x85);

    cpu.registros.escribir16Bits(B, C, 0x9674);
    cpu.ld_rr_rr_16b(H, L, B, C);
    assert.equal(cpu.registros.leer16Bits(H, L), 0x9674);

    cpu.registros.PC = 0xc030;
    memoria.escribir16Bits(0xc030, 0xabcd);
    cpu.ld_sp_ii_16b();
    assert.equal(cpu.registros.SP, 0xabcd);
    cpu.registros.escribir16Bits(D, E, 0x4567);
    cpu.ld_sp_rr_16b(D, E);
    assert.equal(cpu.registros.SP, 0x4567);

    cpu.registros.PC = 0xc040;
    memoria.escribir8Bits(0xc040, 0x10);
    cpu.registros.SP = 0x1234;
    cpu.ldn_rr_sp_16b(H, L);
    assert.equal(cpu.registros.leer16Bits(H, L), 0x1244);

    cpu.registros.PC = 0xc050;
    memoria.escribir8Bits(0xc050, 0xa6);
    cpu.registros.escribir16Bits(H, L, 0xc210);
    cpu.ld_mrr_i_8b(H, L);
    assert.equal(memoria.leer8Bits(0xc210), 0xa6);
});

test('CPU calcula correctamente inmediatos aritmeticos y ajustes BCD', () => {
    const { cpu, memoria } = crearCPU();
    const casos = [
        ['add_r_i_8b', 0xff, 0x01, 0, 0x00, { Z: 1, N: 0, H: 1, C: 1 }],
        ['adc_r_i_8b', 0xfe, 0x01, 1, 0x00, { Z: 1, N: 0, H: 1, C: 1 }],
        ['sub_r_i_8b', 0x30, 0x01, 0, 0x2f, { Z: 0, N: 1, H: 1, C: 0 }],
        ['sbc_r_i_8b', 0x00, 0x00, 1, 0xff, { Z: 0, N: 1, H: 1, C: 1 }],
    ];

    for (const [metodo, a, inmediato, carry, resultado, flagsEsperados] of casos) {
        cpu.registros.PC = 0xc000;
        memoria.escribir8Bits(0xc000, inmediato);
        cpu.registros.R[A] = a;
        cpu.C = carry;
        cpu[metodo](A);
        assert.equal(cpu.registros.R[A], resultado, metodo);
        assert.deepEqual(flags(cpu), flagsEsperados, metodo);
    }

    cpu.registros.R[A] = 0x3c;
    cpu.N = 0;
    cpu.H = 0;
    cpu.C = 0;
    cpu.daa_8b();
    assert.equal(cpu.registros.R[A], 0x42);

    cpu.registros.R[A] = 0x35;
    cpu.cpl_8b(A);
    assert.equal(cpu.registros.R[A], 0xca);
    assert.deepEqual({ N: cpu.N, H: cpu.H }, { N: 1, H: 1 });
});

test('CPU ejecuta lógicas inmediatas y CP sin modificar A', () => {
    const casos = [
        ['and_i_8b', 0xf0, 0x0f, 0x00, { Z: 1, N: 0, H: 1, C: 0 }],
        ['or_i_8b', 0x80, 0x01, 0x81, { Z: 0, N: 0, H: 0, C: 0 }],
        ['xor_i_8b', 0xaa, 0xff, 0x55, { Z: 0, N: 0, H: 0, C: 0 }],
        ['cp_i_8b', 0x10, 0x11, 0x10, { Z: 0, N: 1, H: 1, C: 1 }],
    ];

    for (const [metodo, a, inmediato, resultado, flagsEsperados] of casos) {
        const { cpu, memoria } = crearCPU();
        cpu.registros.R[A] = a;
        cpu.registros.PC = 0xc000;
        memoria.escribir8Bits(0xc000, inmediato);
        cpu[metodo]();
        assert.equal(cpu.registros.R[A], resultado, metodo);
        assert.deepEqual(flags(cpu), flagsEsperados, metodo);
        assert.equal(cpu.registros.PC, 0xc001, metodo);
        assert.equal(cpu.ciclos, 8, metodo);
    }
});

test('CPU cubre límites de INC y DEC en registros y memoria conservando carry', () => {
    const { cpu, memoria } = crearCPU();

    cpu.C = 1;
    cpu.registros.R[B] = 0x0f;
    cpu.inc_r_8b(B);
    assert.equal(cpu.registros.R[B], 0x10);
    assert.deepEqual(flags(cpu), { Z: 0, N: 0, H: 1, C: 1 });

    cpu.registros.R[B] = 0x00;
    cpu.dec_r_8b(B);
    assert.equal(cpu.registros.R[B], 0xff);
    assert.deepEqual(flags(cpu), { Z: 0, N: 1, H: 1, C: 1 });

    cpu.registros.escribir16Bits(H, L, 0xc100);
    memoria.escribir8Bits(0xc100, 0xff);
    cpu.inc_mrr_8b(H, L);
    assert.equal(memoria.leer8Bits(0xc100), 0);
    assert.deepEqual(flags(cpu), { Z: 1, N: 0, H: 1, C: 1 });

    memoria.escribir8Bits(0xc100, 0x01);
    cpu.dec_mrr_8b(H, L);
    assert.equal(memoria.leer8Bits(0xc100), 0);
    assert.deepEqual(flags(cpu), { Z: 1, N: 1, H: 0, C: 1 });

    cpu.registros.escribir16Bits(B, C, 0xffff);
    cpu.inc_rr_16b(B, C);
    assert.equal(cpu.registros.leer16Bits(B, C), 0);
    cpu.dec_rr_16b(B, C);
    assert.equal(cpu.registros.leer16Bits(B, C), 0xffff);
});

test('CPU rota el acumulador y controla carry con las flags correctas', () => {
    const casos = [
        ['rlca_8b', 0x81, 0, 0x03, 1],
        ['rla_8b', 0x80, 1, 0x01, 1],
        ['rrca_8b', 0x01, 0, 0x80, 1],
        ['rra_8b', 0x01, 1, 0x80, 1],
    ];

    for (const [metodo, valor, carry, resultado, carryEsperado] of casos) {
        const { cpu } = crearCPU();
        cpu.registros.R[A] = valor;
        cpu.C = carry;
        cpu.Z = 1;
        cpu.N = 1;
        cpu.H = 1;
        cpu[metodo]();
        assert.equal(cpu.registros.R[A], resultado, metodo);
        assert.deepEqual(flags(cpu), { Z: 0, N: 0, H: 0, C: carryEsperado }, metodo);
        assert.equal(cpu.ciclos, 4, metodo);
    }

    const { cpu } = crearCPU();
    cpu.Z = 1;
    cpu.N = 1;
    cpu.H = 1;
    cpu.C = 0;
    cpu.scf_8b();
    assert.deepEqual(flags(cpu), { Z: 1, N: 0, H: 0, C: 1 });
    cpu.ccf_8b();
    assert.deepEqual(flags(cpu), { Z: 1, N: 0, H: 0, C: 0 });
});

test('CPU retrasa EI una instrucción, DI cancela el retraso y F mantiene el nibble bajo a cero', () => {
    const { cpu, memoria, regInt } = crearCPU();
    cpu.iME = 0;
    cpu.registros.PC = 0xc000;
    cpu.registros.SP = 0xd000;
    memoria.escribir8Bits(0xc000, 0xfb);
    memoria.escribir8Bits(0xc001, 0x00);
    regInt.interrupcionActivada[0] = true;
    regInt.flagsInterrupcion[0] = true;

    cpu.ciclo();
    assert.equal(cpu.iME, 0);
    assert.equal(cpu.registros.PC, 0xc001);
    cpu.ciclo();
    assert.equal(cpu.iME, 1);
    assert.equal(cpu.registros.PC, 0xc002);
    cpu.ciclo();
    assert.equal(cpu.registros.PC, 0x40);

    cpu.iME = 0;
    cpu.ei();
    cpu.di();
    assert.equal(cpu.iME, 0);
    assert.equal(cpu.retrasoIME, 0);

    cpu.registros.R[F] = 0x0f;
    cpu.actualizarFlag();
    assert.equal(cpu.registros.R[F] & 0x0f, 0);
});

test('CPU incrementa, decrementa y suma valores de 8 y 16 bits con flags', () => {
    const { cpu, memoria } = crearCPU();

    cpu.C = 1;
    cpu.registros.R[B] = 0xff;
    cpu.inc_r_8b(B);
    assert.equal(cpu.registros.R[B], 0);
    assert.deepEqual(flags(cpu), { Z: 1, N: 0, H: 1, C: 1 });

    cpu.registros.R[H] = 0xc1;
    cpu.registros.R[L] = 0x00;
    memoria.escribir8Bits(0xc100, 0x00);
    cpu.dec_mrr_8b(H, L);
    assert.equal(memoria.leer8Bits(0xc100), 0xff);
    assert.deepEqual(flags(cpu), { Z: 0, N: 1, H: 1, C: 1 });

    cpu.registros.escribir16Bits(H, L, 0x8fff);
    cpu.registros.escribir16Bits(B, C, 0x7001);
    cpu.Z = 1;
    cpu.add_rr_rr_16b(H, L, B, C);
    assert.equal(cpu.registros.leer16Bits(H, L), 0x0000);
    assert.deepEqual(flags(cpu), { Z: 1, N: 0, H: 1, C: 1 });

    cpu.registros.SP = 0xffff;
    cpu.inc_sp_16b();
    assert.equal(cpu.registros.SP, 0);
    cpu.dec_sp_16b();
    assert.equal(cpu.registros.SP, 0xffff);
});

test('CPU decodifica exhaustivamente los 256 opcodes CB', () => {
    for (let opcode = 0; opcode <= 0xff; opcode++) {
        const { cpu, memoria } = crearCPU();
        const grupo = opcode >> 6;
        const operacion = (opcode >> 3) & 0x07;
        const indice = opcode & 0x07;
        const valorInicial = 0x81;
        const carryInicial = 1;

        cpu.registros.R[B] = valorInicial;
        cpu.registros.R[C] = valorInicial;
        cpu.registros.R[D] = valorInicial;
        cpu.registros.R[E] = valorInicial;
        cpu.registros.R[H] = 0xc1;
        cpu.registros.R[L] = 0x81;
        cpu.registros.R[A] = valorInicial;
        memoria.escribir8Bits(0xc181, valorInicial);
        cpu.C = carryInicial;
        cpu.Z = 1;
        cpu.N = 1;
        cpu.H = 0;
        cpu.registros.PC = 0xc000;
        memoria.escribir8Bits(0xc000, opcode);
        const valorObjetivoInicial =
            indice === 6 ? valorInicial : cpu.registros.R[REGISTROS_OPCODE[indice]];

        cpu.cb();

        const valor =
            indice === 6 ? memoria.leer8Bits(0xc181) : cpu.registros.R[REGISTROS_OPCODE[indice]];
        if (grupo === 0) {
            const esperado = referenciaRotacion(operacion, valorObjetivoInicial, carryInicial);
            assert.equal(valor, esperado.resultado, `CB ${opcode.toString(16)}`);
            assert.deepEqual(flags(cpu), {
                Z: esperado.Z,
                N: 0,
                H: 0,
                C: esperado.C,
            });
        } else if (grupo === 1) {
            assert.equal(valor, valorObjetivoInicial);
            assert.deepEqual(flags(cpu), {
                Z: (valorObjetivoInicial & (1 << operacion)) === 0 ? 1 : 0,
                N: 0,
                H: 1,
                C: carryInicial,
            });
        } else if (grupo === 2) {
            assert.equal(
                valor,
                valorObjetivoInicial & ~(1 << operacion),
                `CB ${opcode.toString(16)}`
            );
            assert.deepEqual(flags(cpu), { Z: 1, N: 1, H: 0, C: carryInicial });
        } else {
            assert.equal(
                valor,
                valorObjetivoInicial | (1 << operacion),
                `CB ${opcode.toString(16)}`
            );
            assert.deepEqual(flags(cpu), { Z: 1, N: 1, H: 0, C: carryInicial });
        }

        assert.equal(cpu.registros.PC, 0xc001);
        assert.equal(cpu.ciclos, indice === 6 ? (grupo === 1 ? 12 : 16) : 8);
    }
});

test('CPU ejecuta saltos absolutos y relativos tomados y no tomados', () => {
    const { cpu, memoria } = crearCPU();

    cpu.registros.PC = 0xc000;
    memoria.escribir16Bits(0xc000, 0x4567);
    cpu.jp_ii_8b();
    assert.equal(cpu.registros.PC, 0x4567);
    assert.equal(cpu.ciclos, 16);

    for (const [metodo, flag, tomado] of [
        ['jrnz_8b', 'Z', 0],
        ['jrz_8b', 'Z', 1],
        ['jrnc_8b', 'C', 0],
        ['jrc_8b', 'C', 1],
    ]) {
        cpu.registros.PC = 0xc100;
        memoria.escribir8Bits(0xc100, 0xfe);
        cpu.Z = flag === 'Z' ? tomado : 0;
        cpu.C = flag === 'C' ? tomado : 0;
        cpu[metodo]();
        assert.equal(cpu.registros.PC, 0xc0ff, metodo);
        assert.equal(cpu.ciclos, 12);

        cpu.registros.PC = 0xc100;
        cpu.Z = flag === 'Z' ? 1 - tomado : 0;
        cpu.C = flag === 'C' ? 1 - tomado : 0;
        cpu[metodo]();
        assert.equal(cpu.registros.PC, 0xc101, metodo);
        assert.equal(cpu.ciclos, 8);
    }
});

test('CPU ejecuta saltos absolutos condicionales y mediante HL', () => {
    for (const [metodo, flag, tomado] of [
        ['jpnz_8b', 'Z', 0],
        ['jpz_8b', 'Z', 1],
        ['jpnc_8b', 'C', 0],
        ['jpc_8b', 'C', 1],
    ]) {
        const { cpu, memoria } = crearCPU();
        cpu.registros.PC = 0xc000;
        memoria.escribir16Bits(0xc000, 0x4567);
        cpu.Z = flag === 'Z' ? tomado : 0;
        cpu.C = flag === 'C' ? tomado : 0;
        cpu[metodo]();
        assert.equal(cpu.registros.PC, 0x4567, metodo);
        assert.equal(cpu.ciclos, 16, metodo);

        cpu.registros.PC = 0xc000;
        cpu.Z = flag === 'Z' ? 1 - tomado : 0;
        cpu.C = flag === 'C' ? 1 - tomado : 0;
        cpu[metodo]();
        assert.equal(cpu.registros.PC, 0xc002, metodo);
        assert.equal(cpu.ciclos, 12, metodo);
    }

    const { cpu } = crearCPU();
    cpu.registros.escribir16Bits(H, L, 0xabcd);
    cpu.jp_hl_8b();
    assert.equal(cpu.registros.PC, 0xabcd);
    assert.equal(cpu.ciclos, 4);
});

test('CPU gestiona pila, CALL, RET, RST y RETI', () => {
    const { cpu, memoria } = crearCPU();
    cpu.registros.SP = 0xd000;
    cpu.registros.R[B] = 0x12;
    cpu.registros.R[C] = 0x34;

    cpu.push_rr_16b(B, C);
    assert.equal(cpu.registros.SP, 0xcffe);
    assert.equal(memoria.leer16Bits(0xcffe), 0x1234);
    cpu.registros.R[B] = 0;
    cpu.registros.R[C] = 0;
    cpu.pop_rr_16b(B, C);
    assert.equal(cpu.registros.leer16Bits(B, C), 0x1234);
    assert.equal(cpu.registros.SP, 0xd000);

    cpu.registros.PC = 0xc000;
    cpu.registros.SP = 0xd000;
    memoria.escribir16Bits(0xc000, 0x4567);
    cpu.call();
    assert.equal(cpu.registros.PC, 0x4567);
    assert.equal(memoria.leer16Bits(0xcffe), 0xc002);
    cpu.ret();
    assert.equal(cpu.registros.PC, 0xc002);

    cpu.registros.PC = 0xabcd;
    cpu.registros.SP = 0xd000;
    cpu.rst(0x38);
    assert.equal(cpu.registros.PC, 0x0038);
    assert.equal(memoria.leer16Bits(0xcffe), 0xabcd);

    cpu.iME = 0;
    cpu.reti();
    assert.equal(cpu.registros.PC, 0xabcd);
    assert.equal(cpu.iME, 1);
});

test('CPU ejecuta CALL y RET condicionales tomados y no tomados', () => {
    for (const [metodo, flag, tomado] of [
        ['callnz', 'Z', 0],
        ['callz', 'Z', 1],
        ['callnc', 'C', 0],
        ['callc', 'C', 1],
    ]) {
        const { cpu, memoria } = crearCPU();
        cpu.registros.PC = 0xc000;
        cpu.registros.SP = 0xd000;
        memoria.escribir16Bits(0xc000, 0x4567);
        cpu.Z = flag === 'Z' ? tomado : 0;
        cpu.C = flag === 'C' ? tomado : 0;
        cpu[metodo]();
        assert.equal(cpu.registros.PC, 0x4567, metodo);
        assert.equal(cpu.registros.SP, 0xcffe, metodo);
        assert.equal(memoria.leer16Bits(0xcffe), 0xc002, metodo);
        assert.equal(cpu.ciclos, 24, metodo);

        cpu.registros.PC = 0xc000;
        cpu.registros.SP = 0xd000;
        cpu.Z = flag === 'Z' ? 1 - tomado : 0;
        cpu.C = flag === 'C' ? 1 - tomado : 0;
        cpu[metodo]();
        assert.equal(cpu.registros.PC, 0xc002, metodo);
        assert.equal(cpu.registros.SP, 0xd000, metodo);
        assert.equal(cpu.ciclos, 12, metodo);
    }

    for (const [metodo, flag, tomado] of [
        ['retnz', 'Z', 0],
        ['retz', 'Z', 1],
        ['retnc', 'C', 0],
        ['retc', 'C', 1],
    ]) {
        const { cpu, memoria } = crearCPU();
        cpu.registros.SP = 0xc000;
        memoria.escribir16Bits(0xc000, 0x789a);
        cpu.Z = flag === 'Z' ? tomado : 0;
        cpu.C = flag === 'C' ? tomado : 0;
        cpu[metodo]();
        assert.equal(cpu.registros.PC, 0x789a, metodo);
        assert.equal(cpu.registros.SP, 0xc002, metodo);
        assert.equal(cpu.ciclos, 20, metodo);

        cpu.registros.PC = 0x3456;
        cpu.registros.SP = 0xc000;
        cpu.Z = flag === 'Z' ? 1 - tomado : 0;
        cpu.C = flag === 'C' ? 1 - tomado : 0;
        cpu[metodo]();
        assert.equal(cpu.registros.PC, 0x3456, metodo);
        assert.equal(cpu.registros.SP, 0xc000, metodo);
        assert.equal(cpu.ciclos, 8, metodo);
    }
});

test('CPU arranca con flags e IME desactivados cuando existe boot ROM', (t) => {
    setBootROM(Uint8Array.of(0x00));
    t.after(() => setBootROM(null));
    const { cpu } = crearCPU({ tipoConsola: BGB_DMG0 });

    assert.equal(cpu.iME, 0);
    assert.deepEqual(flags(cpu), { Z: 0, N: 0, H: 0, C: 0 });
    assert.equal(cpu.registros.PC, 0);
});

test('CPU ciclo hace fetch/decode, actualiza flags y respeta HALT', () => {
    const { cpu, memoria } = crearCPU();
    cpu.registros.PC = 0xc000;
    cpu.Z = 1;
    cpu.N = 0;
    cpu.H = 1;
    cpu.C = 1;
    cpu.registros.R[F] = 0;
    memoria.escribir8Bits(0xc000, 0x3e);
    memoria.escribir8Bits(0xc001, 0x42);

    cpu.ciclo();
    assert.equal(cpu.registros.R[A], 0x42);
    assert.equal(cpu.registros.PC, 0xc002);
    assert.equal(cpu.ciclos, 8);
    assert.equal(cpu.registros.R[F] & 0xf0, 0xb0);

    cpu.halted = true;
    cpu.ciclo();
    assert.equal(cpu.registros.PC, 0xc002);
    assert.equal(cpu.ciclos, 4);
});

test('CPU atiende interrupciones por prioridad y despierta de HALT', () => {
    const { cpu, memoria, regInt } = crearCPU();
    cpu.registros.PC = 0x4567;
    cpu.registros.SP = 0xd000;
    cpu.iME = 1;
    cpu.halted = true;
    regInt.interrupcionActivada[TIMER_INT] = true;
    regInt.flagsInterrupcion[TIMER_INT] = true;

    assert.equal(cpu.rutinaInterrupcion(), true);
    assert.equal(cpu.halted, false);
    assert.equal(cpu.iME, 0);
    assert.equal(regInt.flagsInterrupcion[TIMER_INT], false);
    assert.equal(cpu.registros.PC, 0x50);
    assert.equal(cpu.registros.SP, 0xcffe);
    assert.equal(memoria.leer16Bits(0xcffe), 0x4567);
    assert.equal(cpu.ciclos, 20);
});

test('CPU aplica los offsets signed extremos y envuelve PC en 16 bits', () => {
    const { cpu, memoria } = crearCPU();

    cpu.registros.PC = 0xc000;
    memoria.escribir8Bits(0xc000, 0x80);
    cpu.jr_8b();
    assert.equal(cpu.registros.PC, 0xbf81);

    cpu.registros.PC = 0xfffe;
    memoria.escribir8Bits(0xfffe, 0x7f);
    cpu.jr_8b();
    assert.equal(cpu.registros.PC, 0x007e);

    cpu.registros.PC = 0xffff;
    memoria.escribir8Bits(0xffff, 0x12);
    cpu.ld_r_i_8b(B);
    assert.equal(cpu.registros.R[B], 0x12);
    assert.equal(cpu.registros.PC, 0x0000);

    cpu.registros.PC = 0xfffe;
    memoria.escribir8Bits(0xfffe, 0x34);
    memoria.escribir8Bits(0xffff, 0x12);
    cpu.ld_rr_ii_16b(D, E);
    assert.equal(cpu.registros.leer16Bits(D, E), 0x1234);
    assert.equal(cpu.registros.PC, 0x0000);
});

test('CPU suma offsets extremos a SP y HL con los flags de byte bajo', () => {
    const { cpu, memoria } = crearCPU();
    const casos = [
        [0x0000, 0x80, 0xff80, { Z: 0, N: 0, H: 0, C: 0 }],
        [0xff80, 0x7f, 0xffff, { Z: 0, N: 0, H: 0, C: 0 }],
        [0xffff, 0x01, 0x0000, { Z: 0, N: 0, H: 1, C: 1 }],
        [0x0000, 0xff, 0xffff, { Z: 0, N: 0, H: 0, C: 0 }],
    ];

    for (const [sp, inmediato, resultado, flagsEsperados] of casos) {
        cpu.registros.SP = sp;
        cpu.registros.PC = 0xc000;
        memoria.escribir8Bits(0xc000, inmediato);
        cpu.add_sp_i_16b();
        assert.equal(cpu.registros.SP, resultado);
        assert.deepEqual(flags(cpu), flagsEsperados);

        cpu.registros.SP = sp;
        cpu.registros.PC = 0xc000;
        cpu.ld_hl_sp_imm_16b();
        assert.equal(cpu.registros.leer16Bits(H, L), resultado);
        assert.deepEqual(flags(cpu), flagsEsperados);
    }
});

test('CPU envuelve la pila en 0x0000 y 0xffff', () => {
    const { cpu, memoria, rom } = crearCPU();

    cpu.registros.SP = 0x0000;
    cpu.registros.R[B] = 0x1b;
    cpu.registros.R[C] = 0xcd;
    cpu.push_rr_16b(B, C);
    assert.equal(cpu.registros.SP, 0xfffe);
    assert.equal(memoria.leer8Bits(0xffff), 0x1b);
    assert.equal(memoria.leer8Bits(0xfffe), 0xcd);

    cpu.registros.R[B] = 0;
    cpu.registros.R[C] = 0;
    cpu.pop_rr_16b(B, C);
    assert.equal(cpu.registros.leer16Bits(B, C), 0x1bcd);
    assert.equal(cpu.registros.SP, 0x0000);

    memoria.escribir8Bits(0xffff, 0x14);
    rom[0x0000] = 0x12;
    cpu.registros.SP = 0xffff;
    cpu.ret();
    assert.equal(cpu.registros.PC, 0x1214);
    assert.equal(cpu.registros.SP, 0x0001);

    cpu.registros.PC = 0x1234;
    cpu.registros.SP = 0x0000;
    cpu.rst(0x38);
    assert.equal(cpu.registros.PC, 0x0038);
    assert.equal(cpu.registros.SP, 0xfffe);
    assert.equal(memoria.leer8Bits(0xffff), 0x12);
    assert.equal(memoria.leer8Bits(0xfffe), 0x34);
});

test('CPU POP AF descarta el nibble bajo de F y sincroniza flags', () => {
    const { cpu, memoria } = crearCPU();
    cpu.registros.SP = 0xc000;
    memoria.escribir8Bits(0xc000, 0xff);
    memoria.escribir8Bits(0xc001, 0x42);

    cpu.pop_rr_16b(A, F);

    assert.equal(cpu.registros.R[A], 0x42);
    assert.equal(cpu.registros.R[F], 0xf0);
    assert.deepEqual(flags(cpu), { Z: 1, N: 1, H: 1, C: 1 });
});

test('CPU no atiende interrupciones con IME desactivado, pero HALT se despierta', () => {
    const { cpu, regInt } = crearCPU();
    regInt.interrupcionActivada[0] = true;
    regInt.flagsInterrupcion[0] = true;
    cpu.iME = 0;
    cpu.registros.PC = 0x3456;

    assert.equal(cpu.rutinaInterrupcion(), false);
    assert.equal(cpu.registros.PC, 0x3456);
    assert.equal(regInt.flagsInterrupcion[0], true);

    cpu.halted = true;
    assert.equal(cpu.rutinaInterrupcion(), false);
    assert.equal(cpu.halted, false);
    assert.equal(cpu.registros.PC, 0x3456);
    assert.equal(regInt.flagsInterrupcion[0], true);
});

test('CPU elige la interrupcion pendiente de mayor prioridad', () => {
    const { cpu, regInt } = crearCPU();
    cpu.iME = 1;
    cpu.registros.SP = 0xd000;
    regInt.interrupcionActivada[0] = true;
    regInt.interrupcionActivada[4] = true;
    regInt.flagsInterrupcion[0] = true;
    regInt.flagsInterrupcion[4] = true;

    cpu.rutinaInterrupcion();

    assert.equal(cpu.registros.PC, 0x40);
    assert.equal(regInt.flagsInterrupcion[0], false);
    assert.equal(regInt.flagsInterrupcion[4], true);
});
