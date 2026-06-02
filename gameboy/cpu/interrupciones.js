// @ts-check

import { 
    BGB_DMG0
} from "../constantes.js";

import { RegistrosInterrupciones } from "../memoria/registros/registros_interrupciones.js";

const VBLANK_INT = 0;
const LCDSTAT_INT = 1;
const TIMER_INT = 2;
const SERIAL_INT = 3;
const JOYPAD_INT = 4;
const NUMERO_DE_INTS = 5;

export class Interrupciones{


    /**
     * Constructor de Interrupciones
     * @param {RegistrosInterrupciones} regs registros de las interrupciones
     */
    constructor(regs){

        // Registros de interrupciones
        this.regs = regs;
        this.ciclosContador = 0;
        this.ciclosDivisor = 0;
    }

    
    /** https://gbdev.io/pandocs/Timer_and_Divider_Registers.html
     * @param {number} ciclos
     */
    enCiclos(ciclos){

        // Se incrementa el divisor con una frecuencia de 16384Hz, que es cada
        // 256 ciclos de la cpu
        var ciclosDivisorPasados = Math.floor((this.ciclosDivisor + ciclos) / 256);
        this.ciclosDivisor = (this.ciclosDivisor + ciclos) % 256;
        this.regs.divisor = (this.regs.divisor + ciclosDivisorPasados) & 0xFF;

        if(this.regs.contActivado){ // Si el timer esta activado
            this.ciclosContador += ciclos;

            while(this.ciclosContador >= this.regs.reloj){
                this.ciclosContador -= this.regs.reloj;
                if(this.regs.contador == 0xFF){
                    this.regs.contador = this.regs.contadorModulo;
                    this.regs.flagsInterrupcion[TIMER_INT] = true;
                } else {
                    this.regs.contador = (this.regs.contador + 1) & 0xFF;
                }
            }
        } else { // Si el timer no se encuentra activado no se hace nada
            return;
        }
    }

}
