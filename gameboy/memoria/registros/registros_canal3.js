// @ts-check
import {Sonido} from "../../io/audio/sonido.js";
import { BGB_DMG0 } from "../../constantes.js";

export class RegistrosCanal3{


    /**
     * 
     * @param {number} tipoConsola 
     * @param {Sonido} sonido 
     */
    constructor(tipoConsola, sonido){
        this.tiempo = 0;
        this.iteraciones = 0;
        this.sonido = sonido;
        this.ondaActualizada = false;

        this.ciclosLongitud = 0;

        this.nivelSalida = 0;

        //https://gbdev.io/pandocs/Audio_Registers.html#ff1a--nr30-channel-3-dac-enable
        this.activadoDAC = false;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff1b--nr31-channel-3-length-timer-write-only
        this.temporizadorInicial = 0x00 // Solo escritura

        // https://gbdev.io/pandocs/Audio_Registers.html#ff13--nr13-channel-1-period-low-write-only
        // https://gbdev.io/pandocs/Audio_Registers.html#ff14--nr14-channel-1-period-high--control
        this.periodo = 0x00; // Solo escritura
        this.activado = false; // Solo escritura
        this.longitudActivada = false; // Lectura/Escritura

        this.ondaRAM = new Uint8Array(0x10).fill(0);

        if(tipoConsola == BGB_DMG0){
            this.escribirActivadoDAC(0x7F); // NR30
            this.escribirTemporizador(0xFF); // NR31
            this.escribirNivelSalida(0x9F); // NR32
            this.escribirPeriodoBajo(0xFF) // NR33
            this.escribirPeriodoAltoYControl(0xBF) // NR34
        }

        this.sonido.actualizarOnda3(this.ondaRAM)
    }

    /**
     * Escribe el registro de activado
     * @param {number} dato 
     */
    escribirActivadoDAC(dato){
        this.activadoDAC = (dato & 0x80) == 0x80; // Bit 7
        // Bits 6-0 no se usan
        if(this.activadoDAC){
            this.sonido.activarCanal(2);
            this.sonido.actualizarOnda3(this.ondaRAM);
        } else {
            this.activado = false;
            this.sonido.desactivarCanal(2);
        }
    }

    leerActivadoDAC(){
        return ((this.activadoDAC ? 1 : 0 ) << 7) & 0x7f
    }

    /**
     * Escribe en el registro de temporizador
     * @param {number} dato 
     */
    escribirTemporizador(dato){
        this.temporizadorInicial = dato & 0xFF;
    }

    leerTemporizador(){
        return 0xff;
    }

    /**
     * Escribe el volumen de la salida
     * @param {*} dato 
     */
    escribirNivelSalida(dato){
        this.nivelSalida = (dato & 0x60) >> 5;
        switch(this.nivelSalida){
            case 0: 
                this.sonido.actualizarGanancia(2, 0);
                break;
            case 1: 
                this.sonido.actualizarGanancia(2, 1/2);
                break;
            case 2: 
                this.sonido.actualizarGanancia(2, 0.5/2);
                break;
            case 3: 
                this.sonido.actualizarGanancia(2, 0.25/2);
                break;
        }
    }

    /**
     * Lee el registro de volumen del canal
     * @returns 
     */
    leerNivelSalida(){
        return (
            this.nivelSalida << 5 |
            0x1f
        )
    }

    /**
     * Escribe registro de la parte de menos valor del periodo
     * @param {number} dato 
     */
    escribirPeriodoBajo(dato){
        this.periodo = (this.periodo & 0x700) | (dato & 0x0FF)
        this.sonido.actualizarFrecuencia(2, this.periodo);
    }

    /**
     * Escribe el registro de la parte de mas valor del periodo
     * @param {number} dato 
     */
    escribirPeriodoAltoYControl(dato){
        this.activado = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6 Lectura/Escritura
        // Bits 5-3 sin usar
        this.periodo = (this.periodo & 0x0FF) | ((dato & 0x07) << 8) // Bit 2-0
        this.sonido.actualizarFrecuencia(2, this.periodo);
        this.sonido.activarCanal(2)
    }

    /**
     * Lee el registro de la parte de mas valor del periodo
     * @returns 
     */
    leerPeriodoAltoYControl(){
        return(
            (this.longitudActivada ? 1:0) << 6 |
            0x0F
        )
    }

    /**
     * Traduce los ciclos 
     * @param {number} ciclos 
     */
    enCiclos(ciclos){
        if(this.activado){
            // 4194304 / 128 = 32768
            // Se incrementa el divisor con una frecuencia de 16382Hz, que es cada
            // 64 ciclos de la cpu
            if(this.longitudActivada){
                var ciclosLongitudPasados = Math.floor(ciclos / 32768)
                this.ciclosLongitud += ciclosLongitudPasados + (ciclos % 32768);
                if(this.ciclosLongitud >= 64){
                    this.activado = false
                    this.sonido.desactivarCanal(2)
                }
            }
        }
    }

}
