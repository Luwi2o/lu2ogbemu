const AUDIO_NO = 0;
const AUDIO_DER = 1;
const AUDIO_IZQ = 2
const AUDIO_CENTRO = 3

const DIR_RESTAR = -1;
const DIR_SUMAR = +1;

class RegistrosAudio{

    /**
     * 
     * @param {*} tipoConsola 
     * @param {Sonido} sonido 
     * @param {RegistrosCanal1} regsCnl1 
     * @param {RegistrosCanal2} regsCnl2 
     * @param {RegistrosCanal3} regsCnl3 
     * @param {RegistrosCanal4} regsCnl4 
     */
    constructor(tipoConsola, sonido, regsCnl1, regsCnl2, regsCnl3, regsCnl4){
        this.sonido = sonido;

        // https://gbdev.io/pandocs/Audio_Registers.html#global-control-registers
        this.audioEncendido = false; // boolean
        this.regsCnl1 = regsCnl1;
        this.regsCnl2 = regsCnl2;
        this.regsCnl3 = regsCnl3;
        this.regsCnl4 = regsCnl4;
        this.canalDerecha = new Array(4).fill(true);
        this.canalIzquierda = new Array(4).fill(true);
        this.canalEstereo = new Array(4).fill(AUDIO_NO);
        this.vINIzquierda = false;
        this.vINDerecha = false;
        this.volumenIzquierda = 0; // valor 0 - 7
        this.volumenDerecha = 0; // valor 0 - 7

        if(tipoConsola = BGB_DMG0){
            this.escribirVolumenMaestro(0x80) // NR50
            this.escribirAudioPanoramica(0xBF) // NR51
            this.escribirAudioControlMaestro(0xF1) //NR52
        }
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#global-control-registers
     * 
     * @param {*} dato 
     */
    escribirAudioControlMaestro(dato){
        this.audioEncendido = (dato & 0x80) == 0x80; // Bit 7 audio encendido
        if(this.audioEncendido){
            console.log("activar maestro")
            this.sonido.activarMaestro();
        } else {
            console.log("desactivar maestro")
            this.sonido.desactivarMaestro();
        }
        // Bit 6, 5, 4 no se usan
        // Bits 3-0 solo lectura

    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#global-control-registers
     * @returns valor del registro
     */
    leerAudioControlMaestro(){
        return(
            this.audioEncendido << 7 | // Bit 7 audio encendido
            0x7 |
            this.regsCnl4.activado << 3 |
            this.regsCnl3.activado << 2 |
            this.regsCnl2.activado << 1 |
            this.regsCnl1.activado
        )
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#ff25--nr51-sound-panning
     * 
     * @param {*} dato 
     */
    escribirAudioPanoramica(dato){
        for(var i = 0; i < 4; i++){
            this.canalIzquierda[i] = (dato & (0x10 << i)) == (0x10 << i);
            this.canalDerecha[i] = (dato & (0x01 << i)) == (0x01 << i);
            this.canalEstereo[i] = this.canalIzquierda[i] * 2 + this.canalDerecha[i];
        }
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#ff25--nr51-sound-panning
     * 
     * @returns 
     */
    leerAudioPanoramica(){
        var dato = 0x00;
        for(var i = 0; i < 4; i++){
            dato |= (this.canalIzquierda[i] << (i + 4))
            dato |= (this.canalDerecha[i] << i)
        }
        return dato;
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#ff24--nr50-master-volume--vin-panning
     * 
     * @param {*} dato 
     */
    escribirVolumenMaestro(dato){
        this.vINIzquierda = dato & 0x80 == 0x80; // Bit 7
        this.volumenIzquierda = (dato & 0x70) >> 4; // Bits 6-4 
        this.vINDerecha = dato & 0x08 == 0x08; // Bit 3
        this.volumenDerecha = dato & 0x07; //Bits 2-0

        this.sonido.actualizarVolumenMaestro((this.volumenDerecha + 1) / 8);
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#ff24--nr50-master-volume--vin-panning
     * 
     * @returns 
     */
    leerVolumenMaestro(){
        return(
            this.vINIzquierda << 7 |
            this.volumenIzquierda << 4 |
            this.vINDerecha << 3 |
            this.volumenDerecha
        )
    }
}

class RegistrosCanal1{
    constructor(tipoConsola, sonido){
        this.tiempo = 0;
        this.iteraciones = 0;
        this.sonido = sonido;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff12--nr12-channel-1-volume--envelope
        this.ritmoBarrido = 0x00
        this.direccionBarrido = DIR_RESTAR
        this.paso = 0x00;
        this.ciclosBarrido = 0;
        this.ciclosBarridoMod = 0;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff11--nr11-channel-1-length-timer--duty-cycle
        this.cicloUtil = 0x0 // Lectura/Escritura
        this.temporizadorInicial = 0x0 // Solo escritura

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
        this.volumen = 0;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff13--nr13-channel-1-period-low-write-only
        // https://gbdev.io/pandocs/Audio_Registers.html#ff14--nr14-channel-1-period-high--control
        this.periodo = 0x00; // Solo escritura
        this.activado = false; // Solo escritura
        this.longitudActivada = false; // Lectura/Escritura
        this.ciclosLongitud = 0;
        this.ciclosLongitudMod = 0;

        if(tipoConsola == BGB_DMG0){
            this.escribirBarrido(0x80); // NR10
            this.escribirCicloYTemporizador(0xBF); // NR11
            this.escribirVolumenYEnvoltorio(0xF3); // NR12
            this.escribirPeriodoBajo(0xFF) // NR13
            this.escribirPeriodoAltoYControl(0xBF) // NR14
        }
    }

    escribirBarrido(dato){
        this.ritmoBarrido = (dato & 0x70) >> 4; // Bits 6-4
        var direccionBit = (dato & 0x08) >> 3; // Bit 3
        if(direccionBit == 0) this.direccionBarrido = DIR_RESTAR;
        else this.direccionBarrido = DIR_SUMAR;
        this.paso = dato & 0x07; // Bits 2-0
    }

    leerBarrido(){
        var direccionBit = 0
        if(this.direccionBarrido == DIR_RESTAR) direccionBit = 0
        else direccionBit = 1
        return(
            this.ritmoBarrido << 4 |
            direccionBit << 3 |
            this.paso
        )
    }

    escribirCicloYTemporizador(dato){
        this.cicloUtil = (dato & 0xC0) >> 6;
        this.temporizadorInicial = dato & 0x3F;
        this.ciclosLongitud = this.temporizadorInicial;
        this.sonido.reproducirOnda(0, this.cicloUtil);
    }

    leerCicloYTemporizador(){
        return (
            this.cicloUtil << 6 |
            0x3F
        )
    }

    escribirVolumenYEnvoltorio(dato){
        this.volumenInicial = (dato & 0xF0) >> 4; //Bits 7-4
        this.volumen = this.volumenInicial;
        this.direccionEnvoltorio = (dato & 0x80) >> 3; //Bit 3
        if(this.direccionEnvoltorio == 0) this.direccionEnv = -1;
        else this.direccionEnv = +1;
        this.velocidadEnvoltorio = dato & 0x03; //Bits 2-0

        if(this.volumenInicial == 0 && this.direccionEnvoltorio == 0){
            this.activado = false;
            this.sonido.desactivarCanal(0);
        } else {
            this.activado = true;
            this.sonido.activarCanal(0);
        }
    }

    leerVolumenYEnvoltorio(){
        return (
            this.volumenInicial << 4 |
            this.direccionEnvoltorio << 3 |
            this.velocidadEnvoltorio 
        )
    }

    escribirPeriodoBajo(dato){
        this.periodo = (this.periodo & 0x700) | (dato & 0x0FF)
        this.sonido.actualizarFrecuencia(0, this.periodo);
    }

    escribirPeriodoAltoYControl(dato){
        this.activado = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6
        // Bits 5-3 sin usar
        this.periodo = (this.periodo & 0x0FF) | ((dato & 0x07) << 8) // Bit 2-0
        this.ciclosLongitud = 0;
        this.activado = true;
        this.sonido.activarCanal(0);
        this.sonido.actualizarFrecuencia(0, this.periodo);
    }

    leerPeriodoAltoYControl(){
        return(
            this.longitudActivada << 6 |
            0x0F
        )
    }

    /**
     * 
     * @param {*} ciclos 
     */
    enCiclos(ciclos){
        if(true){
        //if(this.activado){
            // 128 Hz
            this.ciclosBarrido = Math.floor((this.ciclosBarridoMod + ciclos) / (65536*4))
            this.ciclosBarridoMod = (this.ciclosBarridoMod + ciclos) % (65536*4);
            if(this.ritmoBarrido != 0){
                var periodoAntes = this.periodo;
                for(var i = 0; i < this.ciclosBarrido; i++){
                    this.periodo -= this.direccionBarrido * 
                        Math.floor(this.periodo / Math.pow(2, this.paso))
                }
                if(this.periodo > 0x7FF){
                    this.activado = false;
                    this.sonido.desactivarCanal(0);
                } else if(this.periodo <= 0){
                    this.activado = false;
                    this.sonido.desactivarCanal(0);
                } else if(periodoAntes != this.periodo){
                    this.sonido.actualizarFrecuencia(0, this.periodo);
                }
            }

            // https://gbdev.io/pandocs/Audio_Registers.html#ff12--nr12-channel-1-volume--envelope
            // 4194304 Hz / 64 Hz  = 65536 ciclos / iteracion
            if(this.velocidadEnvoltorio != 0){
                // Se calculan los ciclos pasados entre la anterior llamada y esta
                this.ciclosEnvoltorio = Math.floor((this.ciclosEnvoltorioMod + ciclos) / ((65536*4)))
                this.ciclosEnvoltorioMod = ((this.ciclosEnvoltorioMod + ciclos) % ((65536*4)));
                this.iterEnvoltorio = Math.floor((this.ciclosEnvoltorioMod + this.ciclosEnvoltorio) / this.velocidadEnvoltorio)
                this.iterEnvoltorioMod =  (this.iterEnvoltorioMod + this.ciclosEnvoltorio) % this.velocidadEnvoltorio;

                var volumenAnterior = this.volumen;
                this.volumen = this.volumen - (this.direccionEnv * this.ciclosEnvoltorio);

                if(this.volumen < 0) this.volumen = 0;
                if(this.volumen > 15) this.volumen = 15;
    
                // Solo actualizar volumen si ha cambiado;
                if(volumenAnterior != this.volumen){
                    this.sonido.actualizarGanancia(0, this.volumen / 15);
                }

            }
            // 4194304 / 128 = 32768
            // Se incrementa el divisor con una frecuencia de 16382Hz, que es cada
            // 64 ciclos de la cpu
            if(this.longitudActivada){
                this.ciclosLongitud += Math.floor((this.ciclosLongitudMod + ciclos) / 32768)
                this.ciclosLongitudMod = (this.ciclosLongitudMod + ciclos) % 32768;
                if(this.ciclosLongitud >= 64){
                    if(this.activado){
                        console.log("canal 0 ha llegado a la longitud")
                        this.activado = false;
                        this.sonido.desactivarCanal(0);
                    }
                }
            }
        }
    }
}

class Canal1{
    constructor(registrosCanal1){
        this.regs = registrosCanal1
    }
}

class RegistrosCanal2{
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
        this.direccionEnvoltorio = false;
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

    escribirCicloYTemporizador(dato){
        this.cicloUtil = (dato & 0xC0) >> 6
        this.temporizadorInicial = dato & 0x3F
        this.sonido.reproducirOnda(1, this.cicloUtil);
    }

    leerCicloYTemporizador(){
        return (
            this.cicloUtil << 6 |
            0x3F
        )
    }

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

    leerVolumenYEnvoltorio(){
        return (
            this.volumenInicial << 4 |
            this.direccionEnvoltorio << 3 |
            this.velocidadEnvoltorio
        )
    }

    escribirPeriodoBajo(dato){
        this.periodo = (this.periodo & 0x700) | (dato & 0x0FF)
        this.sonido.actualizarFrecuencia(1, this.periodo);
    }

    escribirPeriodoAltoYControl(dato){
        this.activado = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6
        // Bits 5-3 sin usar
        this.periodo = (this.periodo & 0x0FF) | ((dato & 0x07) << 8) // Bit 2-0
        this.sonido.actualizarFrecuencia(1, this.periodo);
        this.activado = true;
        this.sonido.activarCanal(1);
    }

    leerPeriodoAltoYControl(){
        return(
            this.longitudActivada << 6 |
            0x0F
        )
    }


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

class Canal2{
    constructor(registrosCanal2){
        this.regs = registrosCanal2
    }
}

/**
 * @param {Sonido} sonido 
 */
class RegistrosCanal3{
    constructor(tipoConsola, sonido){
        this.tiempo = 0;
        this.iteraciones = 0;
        this.sonido = sonido;
        this.ondaActualizada = false;

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
        return (this.activadoDAC << 7) & 0x7f
    }

    escribirTemporizador(dato){
        this.temporizadorInicial = dato & 0xFF;
    }

    leerTemporizador(){
        return 0xff;
    }

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

    leerNivelSalida(){
        return (
            this.nivelSalida << 5 |
            0x1f
        )
    }

    escribirPeriodoBajo(dato){
        this.periodo = (this.periodo & 0x700) | (dato & 0x0FF)
        this.sonido.actualizarFrecuencia(2, this.periodo);
    }

    escribirPeriodoAltoYControl(dato){
        this.activado = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6 Lectura/Escritura
        // Bits 5-3 sin usar
        this.periodo = (this.periodo & 0x0FF) | ((dato & 0x07) << 8) // Bit 2-0
        this.sonido.actualizarFrecuencia(2, this.periodo);
        this.sonido.activarCanal(2)
    }

    leerPeriodoAltoYControl(){
        return(
            this.longitudActivada << 6 |
            0x0F
        )
    }


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

class Canal3{
    constructor(registrosCanal2){
        this.regs = registrosCanal2
    }
}

/** ------- Clase Canal 4 -------- */
class RegistrosCanal4{
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
        this.direccionEnvoltorio = false;
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

    escribirTemporizador(dato){
        this.temporizadorInicial = dato & 0x3F
        this.ciclosLongitud = this.temporizadorInicial;
    }

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

    escribirFrecuenciaYAletoriedad(dato){
        this.cambioReloj = (dato & 0xF0) >> 4; // Bits 7-4
        this.anchoLFSR = (dato & 0x08) >> 3; // Bits 3
        this.divisorReloj = (dato & 0x07);
        this.sonido.actualizarAnchoLFSR(this.anchoLFSR)
        this.sonido.actualizarDivisor(3, this.divisorReloj, this.cambioReloj);
    }

    escribirControl(dato){
        this.activado = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6
        // Bits 5-0 sin usar
        this.sonido.activarCanal(3)
        this.activado = true;
    }

    leerControl(){
        return(
            this.longitudActivada << 6 |
            0x0F
        )
    }

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

class Canal4{
    constructor(){

    }
}

class Audio{
    constructor(registrosAudio, registrosCanal1, registrosCanal2){
        this.canal1 = new Canal1(registrosCanal1);
        this.canal2 = new Canal2(registrosCanal2);
        this.regs = registrosAudio;
    }
}

/** ------- Clase Sonido -------- **/
class Sonido{
    constructor(){

        console.debug("---------- SONIDO ------------")

        this.tamanyoFFT = 512;
        this.contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
        this.fft = new FFT(this.tamanyoFFT)

        this.osciladores = [
            this.contextoAudio.createOscillator(),
            this.contextoAudio.createOscillator(),
            this.contextoAudio.createOscillator(),
            this.contextoAudio.createScriptProcessor(2048, 1, 1)
        ];
        // https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createGain#examples
        this.ganancias = [
            this.contextoAudio.createGain(),
            this.contextoAudio.createGain(),
            this.contextoAudio.createGain(),
            this.contextoAudio.createGain()
        ]
        // https://gbdev.io/pandocs/Audio_Registers.html#ff11--nr11-channel-1-length-timer--duty-cycle
        // Solo existen cuatro tipos de onda cuadrada, dadas por su ciclo util
        this.ondas = [
            this.crearOndaCuandrada(0.125), // 00: 12.5%
            this.crearOndaCuandrada(0.25), // 00: 25%
            this.crearOndaCuandrada(0.5), // 00: 50%
            this.crearOndaCuandrada(0.75), // 00: 12.5%
        ]

        this.periodoLsfr = 1;

        function lfsrBit7(audioProcessingEvent){
            // The output buffer contains the samples that will be modified and played
            let outputBuffer = audioProcessingEvent.outputBuffer;
            let outputData = outputBuffer.getChannelData(0);

            // Loop through the 4096 samples
            for (let sample = 0; sample < outputBuffer.length; sample++) {
                // add noise to each output sample
                outputData[sample] = (Math.random() * 2 - 1) / 4.0;
            }
        }
        function lfsrBit15(audioProcessingEvent){
            // The output buffer contains the samples that will be modified and played
            let outputBuffer = audioProcessingEvent.outputBuffer;
            let outputData = outputBuffer.getChannelData(0);

            // Loop through the 4096 samples
            for (let sample = 0; sample < outputBuffer.length; sample++) {
                // add noise to each output sample
                outputData[sample] = (Math.random() * 2 - 1) / 4.0;
            }
        }

        // Give the node a function to process audio events
        this.osciladores[3].addEventListener("audioprocess", lfsrBit7);

        this.analizadores = [
            this.contextoAudio.createAnalyser(this.osciladores[0]),
            this.contextoAudio.createAnalyser(this.osciladores[1]),
            this.contextoAudio.createAnalyser(this.osciladores[2]),
            this.contextoAudio.createAnalyser(this.osciladores[3])
        ]

        this.activados = [
            true, true, true, true
        ]
        this.osciladores[0].connect(this.ganancias[0]);
        this.osciladores[1].connect(this.ganancias[1]);
        this.osciladores[2].connect(this.ganancias[2]);
        this.osciladores[3].connect(this.ganancias[3]);

        this.analizador = this.contextoAudio.createAnalyser(this.osciladores[2]);
        // Get a canvas defined with ID "oscilloscope"
        const canvas = document.getElementById("oscilloscope");
        const canvasCtx = canvas.getContext("2d");
        this.analizador.fftSize = 512;
        const bufferLength = this.analizador.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analizador.getByteTimeDomainData(dataArray);

        for(var i = 0; i < 4; i++){
            this.ganancias[i].connect(this.analizadores[i])
        }

        canvasCtx.clearRect(0, 0, 160, 144);
        const analizadores = this.analizadores;
        const posX = [0, 160/2, 0, 160/2]
        const posY = [0, 0, 144/2, 144/2]

        // draw an oscilloscope of the current audio source

        function draw() {
            requestAnimationFrame(draw);
            canvasCtx.fillStyle = "rgb(200 200 200)";
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = "rgb(0 0 0)";

            for(var canal = 0; canal < 4; canal++){
                analizadores[canal].getByteTimeDomainData(dataArray);
    
                canvasCtx.beginPath();
    
                const sliceWidth = ((canvas.width * 1.0) / 2) / bufferLength;
                let x = posX[canal];
    
                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * canvas.height / 2;
    
                    if (i === 0) {
                    canvasCtx.moveTo(x, posY[canal] + y/2);
                    } else {
                    canvasCtx.lineTo(x, posY[canal] + y/2);
                    }
    
                    x += sliceWidth;
                }
    
                canvasCtx.lineTo(canvas.width / 2, canvas.height / 2);
                canvasCtx.stroke();
            }
        }

        draw();

        this.ganancias[0].gain.setValueAtTime(0.05, this.contextoAudio.currentTime);
        this.ganancias[1].gain.setValueAtTime(0.05, this.contextoAudio.currentTime);
        this.ganancias[2].gain.setValueAtTime(0.05, this.contextoAudio.currentTime);
        this.ganancias[3].gain.setValueAtTime(0.05, this.contextoAudio.currentTime);

        this.final = this.contextoAudio.createGain();
        this.volumenMaestro = 1;
        this.maestro = this.contextoAudio.createGain();

        this.ganancias[0].connect(this.maestro);
        this.ganancias[1].connect(this.maestro);
        this.ganancias[2].connect(this.maestro);
        this.ganancias[3].connect(this.maestro);

        this.maestro.connect(this.final);

        this.final.connect(this.contextoAudio.destination);

        this.osciladores[0].start();
        this.osciladores[1].start();
        this.osciladores[2].start();
        //this.osciladores[3].start();

    }

    desactivarCanal(numCanal){
        if(this.activados[numCanal] == true){
            this.activados[numCanal] = false;
            this.osciladores[numCanal].disconnect(this.ganancias[numCanal])
        }
    }

    activarCanal(numCanal){
        if(this.activados[numCanal] == false){
            this.activados[numCanal] = true;
            this.osciladores[numCanal].connect(this.ganancias[numCanal]);
        }
    }

    actualizarOnda3(ondaRAM){
        //console.log("actualizar onda")
        var real = new Float32Array(this.tamanyoFFT);
        var imag = new Float32Array(this.tamanyoFFT);
        var muestras = new Float32Array(this.tamanyoFFT);

        for(var i = 0; i < 16; i++){
            var muestraH = ondaRAM[i] >> 4
            for(var j = 0; j < 16; j++){
                muestras[i * 32 + j] = muestraH;
            }
            var muestraL = ondaRAM[i] & 0x0F;
            for(var j = 0; j < 16; j++){
                muestras[i * 32 + 16 + j] = muestraL;
            }
        }
        this.fft.transformar(muestras, real, imag);
        this.osciladores[2].setPeriodicWave(
            this.contextoAudio.createPeriodicWave(real, imag, {disableNormalization: true})
        );

    }

    activarMaestro(){
        this.maestro.gain.setValueAtTime(this.volumenMaestro, this.contextoAudio.currentTime);
    }

    desactivarMaestro(){
        this.maestro.gain.setValueAtTime(0, this.contextoAudio.currentTime);
    }


    actualizarFrecuencia(numCanal, periodo){
        var frecuencia = 131072  / (2048 - periodo)
        this.osciladores[numCanal].frequency.setValueAtTime(
            frecuencia, this.contextoAudio.currentTime
        )
    }

    actualizarDivisor(numCanal, divisor, cambioReloj){
        var frecuencia =  262144 / (divisor * Math.pow(2, cambioReloj))
        //console.log("frecuencia lfsr: " + frecuencia + " Hz")
        var periodo = Math.floor(2048 / frecuencia)
        if(periodo <= 0) {
            periodo = 1
        }
        //console.log("periodo lfsr: " + periodo)
        //this.osciladores[numCanal].frequency.setValueAtTime(
        //    frecuencia, this.contextoAudio.currentTime
        //)
    }

    actualizarGanancia(numCanal, ganancia){
        this.ganancias[numCanal].gain.setValueAtTime(ganancia, this.contextoAudio.currentTime)
    }

    actualizarVolumenMaestro(volumen){
        this.volumenMaestro = volumen
        this.maestro.gain.setValueAtTime(this.volumenMaestro, this.contextoAudio.currentTime);
    }

    actualizarVolumen(volumen){
        this.final.gain.setValueAtTime(volumen, this.contextoAudio.currentTime);
    }

    reproducirOnda(numCanal, indiceOnda){
        this.osciladores[numCanal].setPeriodicWave(this.ondas[indiceOnda])
    }

    reproducirOndaAleatoria(numCanal, ancho){
        this.osciladores[numCanal].setPeriodicWave(this.ondas[indiceOnda])
    }

    actualizarAnchoLFSR(x){
        return;
    }

    crearOndaCuandrada(duty){
        var res = 1024; // up to 8192 according to spec
        var real = new Float32Array(res);
        var imag = new Float32Array(res);
    
        real[0] = 0.5 * duty;
        for (var n = 1; n < res; n++) {
            real[n] = 0.5 * Math.sin( 3.141592653589793 * n * duty )/(1.570796326794896 * n)
        }
        return this.contextoAudio.createPeriodicWave(real, imag, {disableNormalization: true});

    }
}