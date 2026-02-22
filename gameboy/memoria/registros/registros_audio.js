
// @ts-check

import { AUDIO_NO, BGB_DMG0 } from "../../constantes.js";
import { Sonido } from "../../io/audio/sonido.js";
import { RegistrosCanal1 } from "./registros_canal1.js";
import { RegistrosCanal2 } from "./registros_canal2.js";
import { RegistrosCanal3 } from "./registros_canal3.js";
import { RegistrosCanal4 } from "./registros_canal4.js";

export class RegistrosAudio{

    /**
     * 
     * @param {*} tipoConsola 
     * @param {Sonido} sonido 
     * @param {RegistrosCanal1} regsCnl1 
     * @param {RegistrosCanal2} regsCnl2 
     * @param {RegistrosCanal3} regsCnl3 
     * @param {RegistrosCanal4} regsCnl4 
     */
    constructor(tipoConsola, sonido, regsCnl1, regsCnl2, regsCnl3, regsCnl4){
        this.sonido = sonido;

        // https://gbdev.io/pandocs/Audio_Registers.html#global-control-registers
        this.audioEncendido = false; // boolean
        this.regsCnl1 = regsCnl1;
        this.regsCnl2 = regsCnl2;
        this.regsCnl3 = regsCnl3;
        this.regsCnl4 = regsCnl4;
        this.canalDerecha = new Array(4).fill(true);
        this.canalIzquierda = new Array(4).fill(true);
        this.canalEstereo = new Array(4).fill(AUDIO_NO);
        this.vINIzquierda = /**@type {bool}*/ false;
        this.vINDerecha = /**@type {bool}*/ false;
        this.volumenIzquierda = 0; // valor 0 - 7
        this.volumenDerecha = 0; // valor 0 - 7

        if(tipoConsola = BGB_DMG0){
            this.escribirVolumenMaestro(0x80) // NR50
            this.escribirAudioPanoramica(0xBF) // NR51
            this.escribirAudioControlMaestro(0xF1) //NR52
        }
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#global-control-registers
     * 
     * @param {*} dato 
     */
    escribirAudioControlMaestro(dato){
        this.audioEncendido = (dato & 0x80) == 0x80; // Bit 7 audio encendido
        if(this.audioEncendido){
            console.log("activar maestro")
            this.sonido.activarMaestro();
        } else {
            console.log("desactivar maestro")
            this.sonido.desactivarMaestro();
        }
        // Bit 6, 5, 4 no se usan
        // Bits 3-0 solo lectura

    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#global-control-registers
     * @returns valor del registro
     */
    leerAudioControlMaestro(){
        return(
            (this.audioEncendido ? 1 : 0) << 7 | // Bit 7 audio encendido
            0x7 |
            (this.regsCnl4.activado ? 1:0) << 3 |
            (this.regsCnl3.activado ? 1:0) << 2 |
            (this.regsCnl2.activado ? 1:0) << 1 |
            (this.regsCnl1.activado ? 1:0)
        )
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#ff25--nr51-sound-panning
     * 
     * @param {*} dato 
     */
    escribirAudioPanoramica(dato){
        for(var i = 0; i < 4; i++){
            this.canalIzquierda[i] = (dato & (0x10 << i)) == (0x10 << i);
            this.canalDerecha[i] = (dato & (0x01 << i)) == (0x01 << i);
            this.canalEstereo[i] = this.canalIzquierda[i] * 2 + this.canalDerecha[i];
        }
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#ff25--nr51-sound-panning
     * 
     * @returns 
     */
    leerAudioPanoramica(){
        var dato = 0x00;
        for(var i = 0; i < 4; i++){
            dato |= (this.canalIzquierda[i] << (i + 4))
            dato |= (this.canalDerecha[i] << i)
        }
        return dato;
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#ff24--nr50-master-volume--vin-panning
     * Escribe el volumen maestro
     * @param {number} dato 
     */
    escribirVolumenMaestro(dato){
        this.vINIzquierda = (dato & 0x80) == 0x80; // Bit 7
        this.volumenIzquierda = (dato & 0x70) >> 4; // Bits 6-4 
        this.vINDerecha = (dato & 0x08) == 0x08; // Bit 3
        this.volumenDerecha = dato & 0x07; //Bits 2-0

        this.sonido.actualizarVolumenMaestro((this.volumenDerecha + 1) / 8);
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#ff24--nr50-master-volume--vin-panning
     * Lee el registro de volumen maestro
     * @returns 
     */
    leerVolumenMaestro(){
        return(
            (this.vINIzquierda ? 1 : 0) << 7 |
            this.volumenIzquierda << 4 |
            (this.vINDerecha ? 1 : 0) << 3 |
            this.volumenDerecha
        )
    }
}
