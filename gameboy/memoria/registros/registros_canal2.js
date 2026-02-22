// @ts-check

import { Sonido } from "../../io/audio/sonido.js";
import { BGB_DMG0, DIR_RESTAR, DIR_SUMAR } from "../../constantes.js";

export class RegistrosCanal2{
    /**
     * Constructor de RegistrosCanal1
     * @param {number} tipoConsola 
     * @param {Sonido} sonido 
     */
    constructor(tipoConsola, sonido){
        this.tiempo = 0;
        this.iteraciones = 0;
        this.sonido = sonido;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff11--nr11-channel-1-length-timer--duty-cycle
        this.cicloUtil = 0x0 // Lectura/Escritura
        this.temporizadorInicial = 0x0 // Solo escritura
        this.ciclosLongitud = 0;
        this.ciclosLongitudMod = 0;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff12--nr12-channel-1-volume--envelope
        // Se pueden leer estos bits pero no se actualizan por
        // la funcionalidad de la envoltura
        this.volumenInicial = 0x00;
        this.direccionEnvoltorio = 0;
        this.direccionEnv = +1;
        this.ciclosEnvoltorio = 0;
        this.ciclosEnvoltorioMod = 0;
        this.iterEnvoltorio = 0;
        this.iterEnvoltorioMod = 0;
        // Controla cuanto se incrementa/decrementa la envoltura
        this.velocidadEnvoltorio = 0x00;
        this.volumen;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff13--nr13-channel-1-period-low-write-only
        // https://gbdev.io/pandocs/Audio_Registers.html#ff14--nr14-channel-1-period-high--control
        this.periodo = 0x00; // Solo escritura
        this.activado = false; // Solo escritura
        this.longitudActivada = false; // Lectura/Escritura


        if(tipoConsola == BGB_DMG0){
            this.escribirCicloYTemporizador(0xBF); // NR11
            this.escribirVolumenYEnvoltorio(0xF3); // NR12
            this.escribirPeriodoBajo(0xFF) // NR13
            this.escribirPeriodoAltoYControl(0xBF) // NR14
        }
    }

    /**
     * Escribe al registro de ciclo y temporizador
     * @param {number} dato 
     */
    escribirCicloYTemporizador(dato){
        this.cicloUtil = (dato & 0xC0) >> 6
        this.temporizadorInicial = dato & 0x3F
        this.sonido.reproducirOnda(1, this.cicloUtil);
    }

    /**
     * Lee el registro de ciclo y temporizador
     * @returns 
     */
    leerCicloYTemporizador(){
        return (
            this.cicloUtil << 6 |
            0x3F
        )
    }

    /**
     * Escribe al registro de volumen y envoltorio
     * @param {number} dato 
     */
    escribirVolumenYEnvoltorio(dato){
        this.volumenInicial = (dato & 0xF0) >> 4;
        this.volumen = this.volumenInicial;
        this.direccionEnvoltorio = (dato & 0x80) >> 3;
        if(this.direccionEnvoltorio == 0) this.direccionEnv = -1;
        else this.direccionEnv = +1;
        this.velocidadEnvoltorio = dato & 0x03;
        if(this.volumenInicial == 0 && this.direccionEnvoltorio == 0){
            this.activado = false;
            this.sonido.desactivarCanal(1);
        } else {
            this.activado = true;
            this.sonido.activarCanal(1);
        }
    }

    /**
     * Lee el registro de volumen y envoltorio
     * @returns {number}
     */
    leerVolumenYEnvoltorio(){
        return (
            this.volumenInicial << 4 |
            this.direccionEnvoltorio << 3 |
            this.velocidadEnvoltorio
        )
    }

    /**
     * Escribe al registro de periodo bajo
     * @param {number} dato 
     */
    escribirPeriodoBajo(dato){
        this.periodo = (this.periodo & 0x700) | (dato & 0x0FF)
        this.sonido.actualizarFrecuencia(1, this.periodo);
    }

    /**
     * Escribe al registro de periodo alto y control
     * @param {*} dato 
     */
    escribirPeriodoAltoYControl(dato){
        this.activado = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6
        // Bits 5-3 sin usar
        this.periodo = (this.periodo & 0x0FF) | ((dato & 0x07) << 8) // Bit 2-0
        this.sonido.actualizarFrecuencia(1, this.periodo);
        this.activado = true;
        this.sonido.activarCanal(1);
    }

    /**
     * 
     * @returns {number}
     */
    leerPeriodoAltoYControl(){
        return(
            (this.longitudActivada ? 1 : 0) << 6 |
            0x0F
        )
    }

    /**
     * 
     * @param {*} ciclos 
     */
    enCiclos(ciclos){
        if(this.activado){
            // https://gbdev.io/pandocs/Audio_Registers.html#ff12--nr12-channel-1-volume--envelope
            // 4194304 Hz / 64 Hz  = 65536 ciclos / iteracion
            if(this.velocidadEnvoltorio != 0){
                // Se calculan los ciclos pasados entre la anterior llamada y esta
                this.ciclosEnvoltorio = Math.floor((this.ciclosEnvoltorioMod + ciclos) / (65536 * 4))
                this.ciclosEnvoltorioMod = ((this.ciclosEnvoltorioMod + ciclos) % (65536 * 4));
                this.iterEnvoltorio = Math.floor((this.iterEnvoltorioMod + this.ciclosEnvoltorio) / this.velocidadEnvoltorio)
                this.iterEnvoltorioMod =  (this.iterEnvoltorioMod + this.ciclosEnvoltorio) % this.velocidadEnvoltorio;

                var volumenAnterior = this.volumen;
                this.volumen = this.volumen - (this.direccionEnv * this.ciclosEnvoltorio);

                if(this.volumen < 0) this.volumen = 0;
                if(this.volumen > 15) this.volumen = 15;
    
                // Solo actualizar volumen si ha cambiado;
                if(volumenAnterior != this.volumen){
                    this.sonido.actualizarGanancia(1, this.volumen / 15);
                }

            }
            // 4194304 / 128 = 32768
            // Se incrementa el divisor con una frecuencia de 16382Hz, que es cada
            // 64 ciclos de la cpu
            if(this.longitudActivada){
                this.ciclosLongitud += Math.floor((this.ciclosLongitudMod + ciclos) / 32768)
                this.ciclosLongitudMod = (this.ciclosLongitudMod + ciclos) % 32768;
                if(this.ciclosLongitud >= 64){
                    this.activado = false;
                    this.sonido.desactivarCanal(1);
                }
            }
        }
    }

}
