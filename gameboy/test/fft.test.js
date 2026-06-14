import assert from 'node:assert/strict';
import test from 'node:test';

import { FFT } from '../util/fft.js';

function casiIgual(actual, esperado, tolerancia = 1e-6) {
    assert.ok(
        Math.abs(actual - esperado) <= tolerancia,
        `se esperaba ${esperado}, se obtuvo ${actual}`
    );
}

test('FFT rechaza tamanos no potencia de dos y buffers incompatibles', () => {
    const fftInvalida = new FFT(6);
    assert.throws(() => fftInvalida.transformar(new Float32Array(6), [], []), /power of 2/);

    const fft = new FFT(8);
    assert.throws(() => fft.transformar(new Float32Array(4), [], []), /not the same size/);
});

test('FFT transforma una senal constante en componente DC', () => {
    const fft = new FFT(8);
    const entrada = new Float32Array(8).fill(4096);
    const real = new Float32Array(8);
    const imag = new Float32Array(8);

    fft.transformar(entrada, real, imag);

    casiIgual(real[0], 8);
    casiIgual(imag[0], 0);
    for (let i = 1; i < 8; i++) {
        casiIgual(real[i], 0);
        casiIgual(imag[i], 0);
    }
});

test('FFT de un impulso reparte la misma amplitud en todos los bins', () => {
    const fft = new FFT(8);
    const entrada = new Float32Array(8);
    entrada[0] = 4096;
    const real = new Float32Array(8);
    const imag = new Float32Array(8);

    fft.transformar(entrada, real, imag);

    for (let i = 0; i < 8; i++) {
        casiIgual(real[i], 1);
        casiIgual(imag[i], 0);
    }
});
