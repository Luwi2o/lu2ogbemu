const BIT_SELECCION_BOTONES = 5;
const BIT_SELECCION_DIRECCIONAL = 4;

const BIT_BOTON_START = 3;
const BIT_BOTON_SELECT = 2;
const BIT_BOTON_B = 1;
const BIT_BOTON_A = 0;

const BIT_DIR_ABAJO = 3;
const BIT_DIR_ARRIBA = 2;
const BIT_DIR_IZQUIERDA = 1;
const BIT_DIR_DERECHA = 0;

const SELECCIONADO_BOTONES = 0x2;
const SELECCIONADO_DIRECCION = 0x1;
const SELECCIONADO_AMBOS = 0x3;

const BOTON_A = 0;
const BOTON_B = 1;
const BOTON_SELECT = 2;
const BOTON_START = 3;
const BOTON_ARRIBA = 4;
const BOTON_IZQUIERDA = 5;
const BOTON_DERECHA = 6;
const BOTON_ABAJO = 7;

const ES_ACCION = 0;
const ES_DIRECCION = 1;


class RegistrosBotones{
    constructor(tipoConsola){
        console.debug("---------- BOTONES ----------");
        
        // false si el boton esta siendo pulsado, true si no
        this.seleccion = SELECCIONADO_AMBOS;
        this.esBoton = false;
        this.esDireccional = false;
        this.botones = [false, false, false, false]; // Registros Botones
        this.direccionales = [false, false, false, false]; // Registros Botones

        if(tipoConsola == BGB_DMG0){
            console.debug("BOTONES: Tipo de Consola BGB_DMG0");
            this.seleccion = SELECCIONADO_AMBOS;
            this.esBoton = true;
            this.esDireccional = true;
            for(var i = 0; i < 4; i++) this.botones[i] = true;
            for(var i = 0; i < 4; i++) this.direccionales[i] = true;
        }
    }

    /**
     * Se lee el registro de botones
     * @returns byte de registro de botones
     */
    leerRegBotones(){
        // https://gbdev.io/pandocs/Joypad_Input.html#ff00--p1joyp-joypad
        // Si el bit 5 y el 4 estan activados los botones se leen activados
        if(this.seleccion == SELECCIONADO_AMBOS){
            return(
                this.esBoton << 5 |
                this.esDireccional << 4 |
                0xF
            )
        } else if(this.seleccion == SELECCIONADO_BOTONES){
            return(
                this.esBoton << 5 |
                this.esDireccional << 4 |
                this.botones[3] << 3 |
                this.botones[2] << 2 |
                this.botones[1] << 1 |
                this.botones[0]
            );
        } else if(this.seleccion == SELECCIONADO_DIRECCION){
            return(
                this.esBoton << 5 |
                this.esDireccional << 4 |
                this.direccionales[3] << 3 |
                this.direccionales[2] << 2 |
                this.direccionales[1] << 1 |
                this.direccionales[0]
            );
        } else{
            console.error("Estado de botones no valido");
        }
    }

    /**
     * Se escribe el registro de botones
     * @param {number} dato dato que se quiere escribir
     */
    escribirRegBotones(dato){
        // Bits 7 y 6 son inutiles no se escriben
        // Bit 5
        this.esBoton = (dato & 0x20) == 0x20;
        // Bit 4
        this.esDireccional = (dato & 0x10) == 0x10;
        // Bit 3-0 son solo lectura

        // Los dos activados
        if(this.esBoton && this.esDireccional){
            this.seleccion = SELECCIONADO_AMBOS;
        } else if(!this.esBoton){
            this.seleccion = SELECCIONADO_BOTONES;
        } else if(!this.esDireccional){
            this.seleccion = SELECCIONADO_DIRECCION;
        }

    }
}

/**
 * Esta clase se encarga de manejar los inputs
 */
class Botones{
    
    /**
     * Constructor
     * @param {RegistrosBotones} regs registros de los botones 
     * @param {Interrupciones} ints interrupciones
     */
    constructor(regs, ints){

        this.regs = regs
        this.ints = ints
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
