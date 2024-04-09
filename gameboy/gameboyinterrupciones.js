const VBLANK_INT = 0;
const LCDSTAT_INT = 1;
const TIMER_INT = 2;
const SERIAL_INT = 3;
const JOYPAD_INT = 4;
const NUMERO_DE_INTS = 5;


class RegistrosInterrupciones{


    /**
     * 
     * @param {number} tipoConsola
     */
    constructor(tipoConsola, estado){

        // Interrupt enable
        this.interrupcionActivada = [false, false, false, false, false]; // Registro IE

        // Flag
        this.flagsInterrupcion = [false, false, false, false, false]; // Registro IF
        this.iHandlerDir = [0x40, 0x48, 0x50, 0x58, 0x60];

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

    leerTAC(){
        return (
            0xF8 | // los bits inutiles a 1
            this.contActivado << 2 |
            this.seleccionReloj
        );
    }

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
     * Actualiza el valor del registro
     * @param {*} dato
     */
    escribirIE(dato){
        for(var i = 0; i < NUMERO_DE_INTS; i++){
            this.interrupcionActivada[i] = ((dato >> i) & 0x01) == 0x01;
        }
    }

    iniciarIE(dato){
        for(var i = 0; i < NUMERO_DE_INTS; i++){
            this.interrupcionActivada[i] = ((dato >> i) & 0x01) == 0x01;
        }
    }

    /**
     * Recupera el valor del registro de activacion de interrupciones
     * @returns 
     */
    leerIE(){
        var datoFlags = 0x00;
        for(var i = 0; i < NUMERO_DE_INTS; i++)
            datoFlags = datoFlags | (this.interrupcionActivada[i] << i);
        return datoFlags;
    }

    /**
     * Actualiza el valor de todos los datos por los bits del registro FF0F
     * https://gbdev.io/pandocs/Interrupts.html#ff0f--if-interrupt-flag
     * @param {number} dato 
     */
    escribirIF(dato){
        for(var i = 0; i < NUMERO_DE_INTS; i++){
            this.flagsInterrupcion[i] = ((dato >> i) & 0x01) == 0x01;
        }
    }

    /**
     * Actualiza el valor de todos los datos por los bits del registro FF0F
     * https://gbdev.io/pandocs/Interrupts.html#ff0f--if-interrupt-flag
     * @param {number} dato 
     */
    iniciarIF(dato){
        for(var i = 0; i < NUMERO_DE_INTS; i++){
            this.flagsInterrupcion[i] = ((dato >> i) & 0x01) == 0x01;
        }
    }

    /**
     * 
     * @returns Dato de los flags de interrupcion
     */
    leerIF(){
        var datoFlags = 0x00;
        for(var i = 0; i < NUMERO_DE_INTS; i++)
            datoFlags = datoFlags | (this.flagsInterrupcion[i] << i);
        return datoFlags;
    }
}

class Interrupciones{


    /**
     * 
     * @param {RegistrosInterrupciones} regs registros de las interrupciones
     * @param {Memoria} memoria memoria
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
        var ciclosDivisorPasados = Math.floor((this.ciclosDivisor + ciclos) / 256)
        this.ciclosDivisor = (this.ciclosDivisor + ciclos) % 256;
        this.regs.divisor = (this.regs.divisor + ciclosDivisorPasados) % 0xff
        

        if(this.regs.contActivado){ // Si el timer esta activado
            this.ciclosContador += ciclos;

            if(this.ciclosContador >= this.regs.reloj){
                this.regs.contador = Math.round(this.ciclosContador / this.regs.reloj)
                // Si el valor overflows
                if(this.regs.contador >= 0xFF){
                    console.log("timer overflow")
                    // El valor de TIMA se actualiza con el especificado en tMA
                    this.regs.contador = this.regs.contadorModulo;
                    // Se pide una interrupcionesupcion de timer
                    this.regs.flagsInterrupcion[TIMER_INT] = true;
                }
                this.ciclosContador %= this.regs.reloj;
            }
        } else { // Si el timer no se encuentra activado no se hace nada
            return;
        }
    }

}