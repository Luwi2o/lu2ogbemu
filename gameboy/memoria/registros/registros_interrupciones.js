// @ts-check

import { 
    BGB_DMG0,
    NUMERO_DE_INTS
} from "../../constantes.js";


/**
 * Registros de las interrupciones
 */
export class RegistrosInterrupciones{


    /**
     * Constructor de los registros de interrupciones
     * @param {number} tipoConsola
     * @param {Object} estado
     */
    constructor(tipoConsola, estado){

        // Interrupt enable
        this.interrupcionActivada = [false, false, false, false, false]; // Registro IE

        // Flag
        this.flagsInterrupcion = [false, false, false, false, false]; // Registro IF
        this.iHandlerDir = [0x40, 0x48, 0x50, 0x58, 0x60]; // Direcciones de los manejadores de interrupciones

        // Registros de timers
        // Timer counter
        this.tablaSeleccionRelojes = [256, 4, 16, 64];
        this.contador = 0;
        this.contadorModulo = 0;

        // https://gbdev.io/pandocs/Timer_and_Divider_Registers.html#ff07--tac-timer-control
        this.contActivado = false;
        this.seleccionReloj = 0;
        this.reloj = 256;
        this.datoTAC = 0x00

        this.divisor = 0x00;


        if(estado){
            this.cargarEstado(estado)
        } else {
            // https://gbdev.io/pandocs/Power_Up_Sequence.html
            if(tipoConsola == BGB_DMG0){
                this.contador = 0;
                this.contadorModulo = 0;
                this.iniciarTAC(0xF8);
                this.iniciarIE(0x00);
                this.iniciarIF(0xE1);
            }
        }
    }

    /**
     * Carga el estado de los registros de interrupciones
     * @param {*} estado 
     */
    cargarEstado(estado){
        var s = estado.registrosInterrupciones
        this.interrupcionActivada = s.interrupcionActivada;
        this.flagsInterrupcion = s.flagsInterrupcion;
        this.contador = s.contador;
        this.contadorModulo = s.contadorModulo;
        this.contActivado = s.contActivado;
        this.seleccionReloj = s.seleccionReloj;
        this.reloj = s.reloj;
        this.datoTAC = s.datoTAC;
        this.divisor = s.divisor;
    }

    /**
     * Escribe el valor del registro TAC
     * @param {number} dato 
     */
    escribirTAC(dato){
        // Bit 7-3 no se usan
        // Bit 2
        // Enable: Controla si el TIMA se incrementa. DIV siempre cuenta no importa este bit.
        this.contActivado = (dato & 0x04) == 0x04;
        if(this.contActivado)console.log("timer enabled");
        // Bit 1 y 0;
        this.seleccionReloj = dato & 0x03;
        this.reloj = this.tablaSeleccionRelojes[this.seleccionReloj];
    }

    /**
     * Lee el valor del registro TAC
     * @returns 
     */
    leerTAC(){
        return (
            0xF8 | // los bits inutiles a 1
            (this.contActivado ? 1 : 0) << 2 |
            this.seleccionReloj
        );
    }

    /**
     * Inicia el valor del registro TAC
     * @param {number} dato 
     */
    iniciarTAC(dato){
        // Bit 7-3 no se usan
        // Bit 2
        // Enable: Controla si el TIMA se incrementa. DIV siempre cuenta no importa este bit.
        this.contActivado = (dato & 0x04) == 0x04;
        if(this.contActivado)console.log("timer enabled");
        // Bit 1 y 0;
        this.seleccionReloj = dato & 0x03;
        this.reloj = this.tablaSeleccionRelojes[this.seleccionReloj];
    }

    /**
     * Actualiza el valor del registro IE
     * @param {number} dato
     */
    escribirIE(dato){
        for(var i = 0; i < NUMERO_DE_INTS; i++){
            this.interrupcionActivada[i] = ((dato >> i) & 0x01) == 0x01;
        }
    }

    /**
     * 
     * @param {number} dato 
     */
    iniciarIE(dato){
        for(var i = 0; i < NUMERO_DE_INTS; i++){
            this.interrupcionActivada[i] = ((dato >> i) & 0x01) == 0x01;
        }
    }

    /**
     * Lee el valor del registro de activacion de interrupciones
     * @returns 
     */
    leerIE(){
        var datoFlags = 0x00;
        for(var i = 0; i < NUMERO_DE_INTS; i++)
            datoFlags = datoFlags | (Number(this.interrupcionActivada[i]) << i);
        return datoFlags;
    }

    /**
     * Escribe el valor de todos los datos por los bits del registro FF0F
     * https://gbdev.io/pandocs/Interrupts.html#ff0f--if-interrupt-flag
     * @param {number} dato 
     */
    escribirIF(dato){
        for(var i = 0; i < NUMERO_DE_INTS; i++){
            this.flagsInterrupcion[i] = ((dato >> i) & 0x01) == 0x01;
        }
    }

    /**
     * Inicia el valor de todos los datos por los bits del registro de flags interrupcion
     * https://gbdev.io/pandocs/Interrupts.html#ff0f--if-interrupt-flag
     * @param {number} dato 
     */
    iniciarIF(dato){
        for(var i = 0; i < NUMERO_DE_INTS; i++){
            this.flagsInterrupcion[i] = ((dato >> i) & 0x01) == 0x01;
        }
    }

    /**
     * Lee el valor del registro de flags de interrupcion
     * @returns Dato de los flags de interrupcion
     */
    leerIF(){
        var datoFlags = 0x00;
        for(var i = 0; i < NUMERO_DE_INTS; i++)
            datoFlags = datoFlags | (Number(this.flagsInterrupcion[i]) << i);
        return datoFlags;
    }
}
