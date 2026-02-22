// @ts-check
import { 
    BGB_DMG0, 
    SELECCIONADO_AMBOS,
    SELECCIONADO_BOTONES,
    SELECCIONADO_DIRECCION
} from "../../constantes.js";

export class RegistrosBotones{

    /**
     * Constructor
     * @param {number} tipoConsola 
     */
    constructor(tipoConsola){
        console.debug("---------- BOTONES ----------");
        
        // false si el boton esta siendo pulsado, true si no
        this.seleccion = SELECCIONADO_AMBOS;
        this.esBoton = /** @type {boolean} */ false;
        this.esDireccional = /** @type {boolean} */ false;
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
                (this.esBoton? 1:0) << 5 |
                (this.esDireccional? 1:0) << 4 |
                0xF
            )
        } else if(this.seleccion == SELECCIONADO_BOTONES){
            return(
                (this.esBoton? 1:0) << 5 |
                (this.esDireccional? 1:0) << 4 |
                (this.botones[3]? 1:0) << 3 |
                (this.botones[2]? 1:0) << 2 |
                (this.botones[1]? 1:0) << 1 |
                (this.botones[0]? 1:0)
            );
        } else if(this.seleccion == SELECCIONADO_DIRECCION){
            return(
                (this.esBoton? 1:0) << 5 |
                (this.esDireccional? 1:0) << 4 |
                (this.direccionales[3]? 1:0) << 3 |
                (this.direccionales[2]? 1:0) << 2 |
                (this.direccionales[1]? 1:0) << 1 |
                (this.direccionales[0]? 1:0)
            );
        } else{
            console.error("Estado de botones no valido");
        }
    }

    /**
     * Escribe el registro de botones
     * @param {number} dato dato que se quiere escribir
     */
    escribirRegBotones(dato){
        // Bits 7 y 6 son inutiles, no se escriben
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
