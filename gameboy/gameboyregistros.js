// Registros de GameBoy

// B, C, D, E, H, L, F, A
const B = 0; 
const C = 1; 
const D = 2; 
const E = 3; 
const H = 4; 
const L = 5; 
const F = 6; 
const A = 7;

class Registros{


    /*
    16-bit	Hi	Lo	Nombre/Funcion
    AF	    A	-	Accumulator & Flags
    BC	    B	C	BC
    DE	    D	E	DE
    HL	    H	L	HL
    SP	    -	-	Stack Pointer
    PC	    -	-	Program Counter/Pointer
    */

    constructor(tipoConsola, estado){

        // En la cpu existen 8 registros de 8 bits y 2 registros de 16 bits
        // Registros de 8 bits:
        this.R = new Uint8Array(8);
        // Algunas instrucciones permiten combinarlos y usarlos como registros de 16 bits de
        // la siguiente manera: AF, BC, DE y HL

        // Registros de 16 bits:
        this.PC = 0x0000 >>> 0;
        this.SP = 0xFFFE >>> 0;
        // SP es el "stack pointer" puntero de pila 
        // y PC es el contador de programa "program counter"

        // Si existe un archivo de estado se cargan los datos de este
        if(estado){
            this.cargarEstado(estado);
        } else {
            if(bootROM){
                console.debug("REGISTROS: Cambiando registros a tipo de consola 'BGB_DMG0'");
                this.R[A] = 0x00;
                this.R[F] = 0x00;
                this.R[B] = 0x00;
                this.R[C] = 0x00;
                this.R[D] = 0x00;
                this.R[E] = 0x00;
                this.R[H] = 0x00;
                this.R[L] = 0x00;
                this.PC = 0x0000 >>> 0;
                this.SP = 0xFFFE >>> 0;
            } else {
            // https://gbdev.io/pandocs/Power_Up_Sequence.html
                if(tipoConsola == DMG0){
                    console.debug("Cambiando registros a tipo de consola 'BGB'");
                    this.R[A] = 0x01;
                    this.R[F] = 0x00;
                    this.R[B] = 0xFF;
                    this.R[C] = 0x13;
                    this.R[D] = 0x00;
                    this.R[E] = 0xC1;
                    this.R[H] = 0x84;
                    this.R[L] = 0x03;
                } else if (tipoConsola == BGB){
                    console.debug("Cambiando registros a tipo de consola 'BGB'");
                    this.R[A] = 0x01;
                    this.R[F] = 0x00;
                    this.R[B] = 0x00;
                    this.R[C] = 0x14;
                    this.R[D] = 0x00;
                    this.R[E] = 0x00;
                    this.R[H] = 0xC0;
                    this.R[L] = 0x60;
                } else if (tipoConsola = BGB_DMG0){
                    console.debug("REGISTROS: Cambiando registros a tipo de consola 'BGB_DMG0'");
                    this.R[A] = 0x01;
                    this.R[F] = 0xB0;
                    this.R[B] = 0x00;
                    this.R[C] = 0x13;
                    this.R[D] = 0x00;
                    this.R[E] = 0xD8;
                    this.R[H] = 0x01;
                    this.R[L] = 0x4D;
                    this.PC = 0x0100 >>> 0;
                    this.SP = 0xFFFE >>> 0;
                }
            }
        }
    }

    cargarEstado(estado){
        var s = estado.registros;
        
        this.R[A] = s.R[A];
        this.R[F] = s.R[F];
        this.R[B] = s.R[B];
        this.R[C] = s.R[C];
        this.R[D] = s.R[D];
        this.R[E] = s.R[E];
        this.R[H] = s.R[H];
        this.R[L] = s.R[L];
        this.PC = s.PC
        this.SP = s.SP
    }

    /**
     * Leer registro de 8 bits
     * @param {*} reg
     * @returns 
     */
    leer8Bits(reg){
        return this.registros[reg];
    }

    /**
     * Escribir registro de 8 bits
     * @param {*} reg 
     * @param {*} data 
     */
    escribir8Bits(reg, data){
        this.registros[reg] = data;
    }

    /**
     * Leer registro de 16 bits
     * @param {*} regh Parte alta del byte
     * @param {*} regl Parte baja del byte
     * @returns Dato que se ha leido
     */
    leer16Bits( regh, regl ){
        return (this.R[regh] * 0x100 + this.R[regl]);
    }

    /**
     * Escribir registro de 16 bits
     * @param {*} regh Parte alta del byte
     * @param {*} regl Parte baja del byte
     * @param {*} data Dato que se quiere escribir
     */
    escribir16Bits( regh, regl, data ){
        this.R[regh] = (data & 0xFF00) >> 8;
        this.R[regl] = data & 0x00FF;
    }
}
