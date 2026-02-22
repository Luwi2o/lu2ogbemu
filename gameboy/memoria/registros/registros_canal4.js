
// @ts-check
import { Sonido } from "../../io/audio/sonido.js";
import { BGB_DMG0, DIR_RESTAR, DIR_SUMAR } from "../../constantes.js";


/** ------- Clase Canal 4 -------- */
export class RegistrosCanal4{
    /**
     * 
     * @param {number} tipoConsola 
     * @param {Sonido} sonido 
     */
    constructor(tipoConsola, sonido){

        this.sonido = sonido;
        this.ondaActualizada = false;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff20--nr41-channel-4-length-timer-write-only
        this.temporizadorInicial = 0x0; // Solo escritura
        this.ciclosLongitud = 0;
        this.ciclosLongitudMod = 0;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff21--nr42-channel-4-volume--envelope
        // Se pueden leer estos bits pero no se actualizan por
        // la funcionalidad de la envoltura
        this.volumenInicial = 0x00;
        this.direccionEnvoltorio = /**@type {number}*/ 0;
        this.direccionEnv = +1;
        this.ciclosEnvoltorio = 0;
        this.ciclosEnvoltorioMod = 0;
        this.iterEnvoltorio = 0;
        this.iterEnvoltorioMod = 0;

        // Controla cuanto se incrementa/decrementa la envoltura
        this.velocidadEnvoltorio = 0x00;
        this.volumen;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff22--nr43-channel-4-frequency--randomness
        this.cambioReloj = 0;
        this.anchoLFSR = 0;
        this.divisorReloj = 0;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff23--nr44-channel-4-control
        this.activado = false; // Solo escritura
        this.longitudActivada = false; // Lectura/Escritura

        if(tipoConsola == BGB_DMG0){
            this.escribirTemporizador(0xBF); // NR41
            this.escribirVolumenYEnvoltorio(0xF3); // NR42
            this.escribirFrecuenciaYAletoriedad(0xFF) // NR13
            this.escribirControl(0xBF) // NR14
        }

        // this.sonido.reproducirOnda(3, 0)
        // this.sonido.actualizarFrecuencia(3, this.periodo);
    }

    /**
     * Escribe al registro de temporizador
     * @param {number} dato 
     */
    escribirTemporizador(dato){
        this.temporizadorInicial = dato & 0x3F
        this.ciclosLongitud = this.temporizadorInicial;
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
            this.sonido.desactivarCanal(3);
        } else {
            this.activado = true;
            this.sonido.activarCanal(3);
        }
    }

    leerVolumenYEnvoltorio(){
        return (
            this.volumenInicial << 4 |
            this.direccionEnvoltorio << 3 |
            this.velocidadEnvoltorio
        )
    }

    /**
     * Escribe al registro de frecuencia y aleatoriedad
     * @param {number} dato 
     */
    escribirFrecuenciaYAletoriedad(dato){
        this.cambioReloj = (dato & 0xF0) >> 4; // Bits 7-4
        this.anchoLFSR = (dato & 0x08) >> 3; // Bits 3
        this.divisorReloj = (dato & 0x07);
        this.sonido.actualizarAnchoLFSR(this.anchoLFSR)
        this.sonido.actualizarDivisor(3, this.divisorReloj, this.cambioReloj);
    }

    /**
     * Escribe al registro de control
     * @param {number} dato 
     */
    escribirControl(dato){
        this.activado = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6
        // Bits 5-0 sin usar
        this.sonido.activarCanal(3)
        this.activado = true;
    }

    leerControl(){
        return(
            (this.longitudActivada ? 1:0) << 6 |
            0x0F
        )
    }

    /**
     * 
     * @param {number} ciclos 
     */
    enCiclos(ciclos){
        if(true){
        //if(this.activado){
            // https://gbdev.io/pandocs/Audio_Registers.html#ff12--nr12-channel-1-volume--envelope
            // 4194304 Hz / 64 Hz  = 65536 ciclos / iteracion
            if(this.velocidadEnvoltorio != 0){
                // Se calculan los ciclos pasados entre la anterior llamada y esta
                this.ciclosEnvoltorio = Math.floor((this.ciclosEnvoltorioMod + ciclos) / (65536*2))
                this.ciclosEnvoltorioMod = ((this.ciclosEnvoltorioMod + ciclos) % (65536*2));
                this.iterEnvoltorio = Math.floor((this.ciclosEnvoltorioMod + this.ciclosEnvoltorio) / this.velocidadEnvoltorio)
                this.iterEnvoltorioMod =  (this.iterEnvoltorioMod + this.ciclosEnvoltorio) % this.velocidadEnvoltorio;

                var volumenAnterior = this.volumen;
                this.volumen = this.volumen - (this.direccionEnv * this.ciclosEnvoltorio);

                if(this.volumen < 0) this.volumen = 0;
                if(this.volumen > 15) this.volumen = 15;
    
                // Solo actualizar volumen si ha cambiado;
                if(volumenAnterior != this.volumen){
                    this.sonido.actualizarGanancia(3, (this.volumen / 15.0));
                }

            }
            // 4194304 / 128 = 32768
            // Se incrementa el divisor con una frecuencia de 16382Hz, que es cada
            // 64 ciclos de la cpu
            if(this.longitudActivada){
                this.ciclosLongitud += Math.floor((this.ciclosLongitudMod + ciclos) / 32768)
                this.ciclosLongitudMod = (this.ciclosLongitudMod + ciclos) % 32768;
                if(this.ciclosLongitud >= 64){
                    this.activado = false
                    this.sonido.desactivarCanal(3)
                }
            }
        }
    }
}
