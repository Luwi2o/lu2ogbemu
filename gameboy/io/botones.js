// @ts-check

import { 
    ES_ACCION,
    ES_DIRECCION,
    BIT_BOTON_A,
    BIT_BOTON_B,
    BIT_BOTON_SELECT,
    BIT_BOTON_START,
    BIT_DIR_ARRIBA,
    BIT_DIR_ABAJO,
    BIT_DIR_IZQUIERDA,
    BIT_DIR_DERECHA,
    BOTON_A,
    BOTON_B,
    BOTON_SELECT,
    BOTON_START,
    BOTON_ARRIBA,
    BOTON_IZQUIERDA,
    BOTON_DERECHA,
    BOTON_ABAJO,

    JOYPAD_INT
} from "../constantes.js";
import { RegistrosBotones } from "../memoria/registros/registros_botones.js";
import { Interrupciones } from "../cpu/interrupciones.js";

/**
 * Esta clase se encarga de manejar los inputs
 */
export class Botones{
    
    /**
     * Constructor de Botones
     * @param {RegistrosBotones} regs registros de los botones 
     * @param {Interrupciones} ints interrupciones
     */
    constructor(regs, ints){

        /** @type {RegistrosBotones} */
        this.regs = regs // Registros de los botones
        /** @type {Interrupciones} */
        this.ints = ints
        /** @type {number[]} */
        this.botones = new Array(8).fill(false);
        this.direccionales = new Array(8).fill(false);
    }

    /**
     * Se emula que se suelta un boton.
     * @param {number} boton 
     */
    pulsar(boton){
        var tipo = ES_ACCION;
        switch(boton){
            case BOTON_A:
                this.regs.botones[BIT_BOTON_A] = false; 
                break;
            case BOTON_B:
                this.regs.botones[BIT_BOTON_B] = false; 
                break;
            case BOTON_SELECT:
                this.regs.botones[BIT_BOTON_SELECT] = false; 
                break;
            case BOTON_START:
                this.regs.botones[BIT_BOTON_START] = false; 
                break;

            case BOTON_ARRIBA:
                tipo = ES_DIRECCION;
                this.regs.direccionales[BIT_DIR_ARRIBA] = false; 
                break;
            case BOTON_ABAJO:
                tipo = ES_DIRECCION;
                this.regs.direccionales[BIT_DIR_ABAJO] = false; 
                break;
            case BOTON_IZQUIERDA:
                tipo = ES_DIRECCION;
                this.regs.direccionales[BIT_DIR_IZQUIERDA] = false; 
                break;
            case BOTON_DERECHA:
                tipo = ES_DIRECCION;
                this.regs.direccionales[BIT_DIR_DERECHA] = false; 
                break;

            default:
                console.error("Boton pulsado no esperado");
                return;
        }
        // https://gbdev.io/pandocs/Interrupt_Sources.html#int-60--joypad-interrupt
        // La interrupcion de Joypad se pide cuando cualquier bit de P1 0-3 se cambia
        // de 0 a 1. Esto pasa cuando un boton se presiona (dado que los botones de accion/
        // direccion estan activados) 
        if(!this.regs.esBoton && tipo == ES_ACCION){
            this.ints.regs.flagsInterrupcion[JOYPAD_INT] = true;
        }

        if(!this.regs.esDireccional && tipo == ES_DIRECCION){
            console.log("dir");
            this.ints.regs.flagsInterrupcion[JOYPAD_INT] = true;
        }
        return;
    }

    /**
     * Se emula que se suelta un boton.
     * @param {number} boton 
     */
    soltar(boton){
        switch(boton){
            case BOTON_A:
                this.regs.botones[BIT_BOTON_A] = true; break;
            case BOTON_B:
                this.regs.botones[BIT_BOTON_B] = true; break;
            case BOTON_SELECT:
                this.regs.botones[BIT_BOTON_SELECT] = true; break;
            case BOTON_START:
                this.regs.botones[BIT_BOTON_START] = true; break;

            case BOTON_ARRIBA:
                this.regs.direccionales[BIT_DIR_ARRIBA] = true; break;
            case BOTON_ABAJO:
                this.regs.direccionales[BIT_DIR_ABAJO] = true; break;
            case BOTON_IZQUIERDA:
                this.regs.direccionales[BIT_DIR_IZQUIERDA] = true; break;
            case BOTON_DERECHA:
                this.regs.direccionales[BIT_DIR_DERECHA] = true; break;

            default:
                console.error("Boton soltado no esperado");
        }
    }

}
