const AUDIO_NO = 0;
const AUDIO_DER = 1;
const AUDIO_IZQ = 2
const AUDIO_CENTRO = 3

const DIR_RESTAR = -1;
const DIR_SUMAR = +1;

class RegistrosAudio{

    constructor(tipoConsola, sonido){
        this.sonido = sonido;

        // https://gbdev.io/pandocs/Audio_Registers.html#global-control-registers
        this.audioEncendido = false; // boolean
        this.canal4Encendido = false; // boolean
        this.canal3Encendido = false; // boolean
        this.canal2Encendido = false; // boolean
        this.canal1Encendido = false; // boolean
        this.canalDerecha = new Array(4).fill(true);
        this.canalIzquierda = new Array(4).fill(true);
        this.canalEstereo = new Array(4).fill(AUDIO_NO);
        this.vINIzquierda = false;
        this.vINDerecha = false;
        this.volumenIzquierda = 0; // valor 0 - 7
        this.volumenDerecha = 0; // valor 0 - 7

        if(tipoConsola = BGB_DMG0){
            this.iniciarVolumenMaestro(0x80) // NR50
            this.iniciarAudioPanoramica(0xBF) // NR51
            this.iniciarAudioControlMaestro(0xF1) //NR52
        }

        this.sonido.reproducirOnda(0, this.sonido.crearOndaCuandrada(0.5))
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#global-control-registers
     * 
     * @param {*} dato 
     */
    escribirAudioControlMaestro(dato){
        this.audioEncendido = (dato & 0x80) == 0x80; // Bit 7 audio encendido
        // Bit 6, 5, 4 no se usan
        this.canal4Encendido = (dato & 0x08) == 0x08; // Bit 3 Canal 4 On
        this.canal3Encendido = (dato & 0x04) == 0x04; // Bit 2 Canal 3 On
        this.canal2Encendido = (dato & 0x02) == 0x02; // Bit 1 Canal 2 On
        this.canal1Encendido = (dato & 0x01) == 0x01; // Bit 0 Canal 1 On

    }

    iniciarAudioControlMaestro(dato){
        this.audioEncendido = (dato & 0x80) == 0x80; // Bit 7 audio encendido
        // Bit 6, 5, 4 no se usan
        this.canal4Encendido = (dato & 0x08) == 0x08; // Bit 3 Canal 4 On
        this.canal3Encendido = (dato & 0x04) == 0x04; // Bit 2 Canal 3 On
        this.canal2Encendido = (dato & 0x02) == 0x02; // Bit 1 Canal 2 On
        this.canal1Encendido = (dato & 0x01) == 0x01; // Bit 0 Canal 1 On
    }

    /** https://gbdev.io/pandocs/Audio_Registers.html#global-control-registers
     * @returns valor del registro
     */
    leerAudioControlMaestro(){
        return(
            this.audioEncendido << 7 | // Bit 7 audio encendido
            0x7 |
            this.canal4Encendido << 3 |
            this.canal3Encendido << 2 |
            this.canal2Encendido << 1 |
            this.canal1Encendido
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

    iniciarAudioPanoramica(dato){
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
    }

    iniciarVolumenMaestro(dato){
        this.vINIzquierda = dato & 0x80 == 0x80; // Bit 7
        this.volumenIzquierda = (dato & 0x70) >> 4; // Bits 6-4 
        this.vINDerecha = dato & 0x08 == 0x08; // Bit 3
        this.volumenDerecha = dato & 0x07; //Bits 2-0
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
        this.ritmo = 0x00
        this.direccion = DIR_RESTAR
        this.paso = 0x00


        // https://gbdev.io/pandocs/Audio_Registers.html#ff11--nr11-channel-1-length-timer--duty-cycle
        this.cicloUtil = 0x0 // Lectura/Escritura
        this.temporizadorInicial = 0x0 // Solo escritura

        // https://gbdev.io/pandocs/Audio_Registers.html#ff12--nr12-channel-1-volume--envelope
        // Se pueden leer estos bits pero no se actualizan por
        // la funcionalidad de la envoltura
        this.volumenInicial = 0x00;
        this.direccionEnvoltura = 0;
        this.direccionEnv = +1;
        // Controla cuanto se incrementa/decrementa la envoltura
        this.velocidadBarrido = 0x00;

        this.volumen = 0;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff13--nr13-channel-1-period-low-write-only
        // https://gbdev.io/pandocs/Audio_Registers.html#ff14--nr14-channel-1-period-high--control
        this.periodo = 0x00; // Solo escritura
        this.trigger = false; // Solo escritura
        this.longitudActivada = false; // Lectura/Escritura

        if(tipoConsola == BGB_DMG0){
            this.iniciarBarrido(0x80); // NR10
            this.iniciarCicloYTemporizador(0xBF); // NR11
            this.iniciarVolumenYBarrido(0xF3); // NR12
            this.iniciarPeriodoBajo(0xFF) // NR13
            this.iniciarPeriodoAltoYControl(0xBF) // NR14
            
        }

        this.sonido.actualizarFrecuencia(0, this.periodo);
    }

    escribirBarrido(dato){
        this.ritmo = (dato & 0x70) >> 4; // Bits 6-4
        var direccionBit = (dato & 0x08) >> 3; // Bit 3
        if(direccionBit == 0) this.direccion = DIR_RESTAR;
        else this.direccion = DIR_SUMAR;
        this.paso = dato & 0x07; // Bits 2-0
    }

    iniciarBarrido(dato){
        this.ritmo = (dato & 0x70) >> 4; // Bits 6-4
        this.direccion = (dato & 0x08) >> 3; // Bit 3
        if((dato & 0x08) >> 3 == 0) this.direccion = DIR_RESTAR;
        else this.direccion = DIR_SUMAR;
        this.paso = dato & 0x07; // Bits 2-0
    }

    leerBarrido(){
        var direccionBit = 0
        if(this.direccion == DIR_RESTAR) direccionBit = 0
        else direccionBit = 1
        return(
            this.ritmo << 4 |
            direccionBit << 3 |
            this.paso
        )
    }

    escribirCicloYTemporizador(dato){
        this.cicloUtil = (dato & 0xC0) >> 6
        this.temporizadorInicial = dato & 0x3F
    }

    iniciarCicloYTemporizador(dato){
        this.cicloUtil = (dato & 0xC0) >> 6
        this.temporizadorInicial = dato & 0x3F
    }

    leerCicloYTemporizador(){
        return (
            this.cicloUtil << 6 |
            0x3F
        )
    }

    escribirVolumenYBarrido(dato){
        this.volumenInicial = (dato & 0xF0) >> 4;
        this.volumen = this.volumenInicial;
        this.direccionEnvoltura = (dato & 0x80) >> 3;
        if(this.direccionEnvoltura == 0) this.direccionEnv = -1;
        else this.direccionEnv = +1;
        this.velocidadBarrido = dato & 0x03;
    }

    iniciarVolumenYBarrido(dato){
        this.volumenInicial = (dato & 0xF0) >> 4;
        this.volumen = this.volumenInicial;
        this.direccionEnvoltura = (dato & 0x80) >> 3;
        if(this.direccionEnvoltura == 0) this.direccionEnv = -1;
        else this.direccionEnv = +1;
        this.velocidadBarrido = dato & 0x03;
    }

    leerVolumenYBarrido(){
        return (
            this.volumenInicial << 4 |
            this.direccionEnvoltura << 3 |
            this.velocidadBarrido 
        )
    }

    escribirPeriodoBajo(dato){
        this.periodo = (this.periodo & 0x700) | (dato & 0x0FF)
        this.sonido.actualizarFrecuencia(0, this.periodo);
    }

    iniciarPeriodoBajo(dato){
        this.periodo = (this.periodo & 0x700) | (dato & 0x0FF)
        this.sonido.actualizarFrecuencia(0, this.periodo);
    }

    escribirPeriodoAltoYControl(dato){
        this.trigger = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6
        // Bits 5-3 sin usar
        this.periodo = (this.periodo & 0x0FF) | ((dato & 0x07) << 8) // Bit 2-0
        this.sonido.actualizarFrecuencia(0, this.periodo);
    }

    iniciarPeriodoAltoYControl(dato){
        this.trigger = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6
        // Bits 5-3 sin usar
        this.periodo = (this.periodo & 0x0FF) | (dato << 8) // Bit 2-0
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
     * @param {*} tiempo Tiempo en milisegundos
     */
    actualizar(delta){
        var viejoTiempo = this.tiempo;
        var nuevoTiempo = this.tiempo + delta;
        if(this.ritmo != 0){
            var iteracionesAntes = Math.floor(viejoTiempo / (this.ritmo * 7.8))
            var iteracionesDespues = Math.floor(nuevoTiempo / (this.ritmo * 7.8))
            var iteraciones = iteracionesDespues - iteracionesAntes;
            for(var i = 0; i < iteraciones; i++){
                this.periodo = this.periodo + 
                            this.direccion * Math.floor((this.periodo / Math.pow(2, iteracionesDespues)))
            }
            this.sonido.actualizarFrecuencia(0, this.periodo);
        }
        if(this.velocidadBarrido != 0){
            var periodoEnv = 1000.0 / 64.0;
            var iteracionesEnvAntes = Math.floor(viejoTiempo / periodoEnv)
            var iteracionesEnvDespues = Math.floor(nuevoTiempo / periodoEnv)
            var interacionesEnv = iteracionesEnvDespues - iteracionesEnvAntes;
            for(var i = 0; i < interacionesEnv; i++){
                this.volumen -= this.direccionEnv;
                if(this.volumen < 0) { this.volumen = 0; }
                if(this.volumen > 15) { this.volumen = 15; }
            }
            this.sonido.actualizarGanancia(0, this.volumen / 15);
        }
        this.tiempo = nuevoTiempo;
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

        // https://gbdev.io/pandocs/Audio_Registers.html#ff12--nr12-channel-1-volume--envelope
        this.ritmo = 0x00
        this.direccion = DIR_RESTAR
        this.paso = 0x00


        // https://gbdev.io/pandocs/Audio_Registers.html#ff11--nr11-channel-1-length-timer--duty-cycle
        this.cicloUtil = 0x0 // Lectura/Escritura
        this.temporizadorInicial = 0x0 // Solo escritura

        // https://gbdev.io/pandocs/Audio_Registers.html#ff12--nr12-channel-1-volume--envelope
        // Se pueden leer estos bits pero no se actualizan por
        // la funcionalidad de la envoltura
        this.volumenInicial = 0x00;
        this.direccionEnvoltura = false;
        this.direccionEnv = +1;
        // Controla cuanto se incrementa/decrementa la envoltura
        this.velocidadBarrido = 0x00;


        this.volumen;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff13--nr13-channel-1-period-low-write-only
        // https://gbdev.io/pandocs/Audio_Registers.html#ff14--nr14-channel-1-period-high--control
        this.periodo = 0x00; // Solo escritura
        this.trigger = false; // Solo escritura
        this.longitudActivada = false; // Lectura/Escritura

        if(tipoConsola == BGB_DMG0){
            this.iniciarBarrido(0x80); // NR10
            this.iniciarCicloYTemporizador(0xBF); // NR11
            this.iniciarVolumenYBarrido(0xF3); // NR12
            this.iniciarPeriodoBajo(0xFF) // NR13
            this.iniciarPeriodoAltoYControl(0xBF) // NR14
            
        }

        this.sonido.actualizarFrecuencia(1, this.periodo);
    }

    escribirBarrido(dato){
        this.ritmo = (dato & 0x70) >> 4; // Bits 6-4
        this.direccion = (dato & 0x08) >> 3; // Bit 3
        this.paso = dato & 0x07; // Bits 2-0
    }

    iniciarBarrido(dato){
        this.ritmo = (dato & 0x70) >> 4; // Bits 6-4
        this.direccion = (dato & 0x08) >> 3; // Bit 3
        this.paso = dato & 0x07; // Bits 2-0
    }

    leerBarrido(){
        return(
            this.ritmo << 4 |
            this.direccion << 3 |
            this.paso
        )
    }

    escribirCicloYTemporizador(dato){
        this.cicloUtil = (dato & 0xC0) >> 6
        this.temporizadorInicial = dato & 0x3F
    }

    iniciarCicloYTemporizador(dato){
        this.cicloUtil = (dato & 0xC0) >> 6
        this.temporizadorInicial = dato & 0x3F
    }

    leerCicloYTemporizador(){
        return (
            this.cicloUtil << 6 |
            0x3F
        )
    }

    escribirVolumenYBarrido(dato){
        this.volumenInicial = (dato & 0xF0) >> 4;
        this.volumen = this.volumenInicial;
        this.direccionEnvoltura = (dato & 0x80) >> 3;
        if(this.direccionEnvoltura == 0) this.direccionEnv = -1;
        else this.direccionEnv = +1;
        this.velocidadBarrido = dato & 0x03;
    }

    iniciarVolumenYBarrido(dato){
        this.volumenInicial = (dato & 0xF0) >> 4;
        this.volumen = this.volumenInicial;
        this.direccionEnvoltura = (dato & 0x80) >> 3;
        if(this.direccionEnvoltura == 0) this.direccionEnv = -1;
        else this.direccionEnv = +1;
        this.velocidadBarrido = dato & 0x03;
    }

    leerVolumenYBarrido(){
        return (
            this.volumenInicial << 4 |
            this.direccionEnvoltura << 3 |
            this.velocidadBarrido 
        )
    }

    escribirPeriodoBajo(dato){
        this.periodo = (this.periodo & 0x700) | (dato & 0x0FF)
        this.sonido.actualizarFrecuencia(1, this.periodo);
    }

    iniciarPeriodoBajo(dato){
        this.periodo = (this.periodo & 0x700) | (dato & 0x0FF)
        this.sonido.actualizarFrecuencia(1, this.periodo);
    }

    escribirPeriodoAltoYControl(dato){
        this.trigger = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6
        // Bits 5-3 sin usar
        this.periodo = (this.periodo & 0x0FF) | ((dato & 0x07) << 8) // Bit 2-0
        this.sonido.actualizarFrecuencia(1, this.periodo);
    }

    iniciarPeriodoAltoYControl(dato){
        this.trigger = (dato & 0x80) == 0x80 // Bit 7
        this.longitudActivada = (dato & 0x40) == 0x40 // Bit 6
        // Bits 5-3 sin usar
        this.periodo = (this.periodo & 0x0FF) | (dato << 8) // Bit 2-0
        this.sonido.actualizarFrecuencia(1, this.periodo);
    }

    leerPeriodoAltoYControl(){
        return(
            this.longitudActivada << 6 |
            0x0F
        )
    }

    /**
     * 
     * @param {*} tiempo Tiempo en milisegundos
     */
    actualizar(delta){
        var viejoTiempo = this.tiempo;
        var nuevoTiempo = this.tiempo + delta;
        if(this.ritmo != 0){
            var iteracionesAntes = Math.floor(viejoTiempo / (this.ritmo * 7.8))
            var iteracionesDespues = Math.floor(nuevoTiempo / (this.ritmo * 7.8))
            var iteraciones = iteracionesDespues - iteracionesAntes;
            for(var i = 0; i < iteraciones; i++){
                this.periodo = this.periodo + 
                            this.direccion * Math.floor((this.periodo / Math.pow(2, iteracionesDespues)))
            }
            this.sonido.actualizarFrecuencia(1, this.periodo);
        }
        if(this.velocidadBarrido != 0){
            var periodoEnv = 1000.0 / 64.0;
            var iteracionesEnvAntes = Math.floor(viejoTiempo / periodoEnv)
            var iteracionesEnvDespues = Math.floor(nuevoTiempo / periodoEnv)
            var interacionesEnv = iteracionesEnvDespues - iteracionesEnvAntes;
            for(var i = 0; i < interacionesEnv; i++){
                this.volumen -= this.direccionEnv;
                if(this.volumen < 0) { this.volumen = 0; }
                if(this.volumen > 15) { this.volumen = 15; }
            }
            this.sonido.actualizarGanancia(1, this.volumen / 15);
        }
        this.tiempo = nuevoTiempo;
    }

}

class Canal2{
    constructor(registrosCanal2){
        this.regs = registrosCanal2
    }
}

class RegistrosCanal3{
    constructor(){

    }
}

/** ------- Clase Canal 4 -------- */
class RegistrosCanal4{
    constructor(){


        this.tiempo = 0;
        this.iteraciones = 0;
        this.sonido = sonido;

        // https://gbdev.io/pandocs/Audio_Registers.html#ff21--nr42-channel-4-volume--envelope
        // Se pueden leer estos bits pero no se actualizan por
        // la funcionalidad de la envoltura
        this.volumenInicial = 0x00;
        this.direccionEnvoltura = false;
        this.direccionEnv = +1;

        this.temporizadorInicial = 0;

        // periodo = 1000 / (262144 / (1*2))
    }

    /** NR42: Volumen y envoltura de canal 4
     * https://gbdev.io/pandocs/Audio_Registers.html#ff21--nr42-channel-4-volume--envelope
     * @param {*} dato 
     */
    escribirVolumenYEnvoltura(dato){
        this.volumenInicial = (dato & 0xF0) >> 4;
        this.volumen = this.volumenInicial;
        this.direccionEnvoltura = (dato & 0x80) >> 3;
        if(this.direccionEnvoltura == 0) this.direccionEnv = -1;
        else this.direccionEnv = +1;
        this.velocidadBarrido = dato & 0x03;
    }

    /** NR42: Volumen y envoltura de canal 4
     * https://gbdev.io/pandocs/Audio_Registers.html#ff21--nr42-channel-4-volume--envelope
     * @param {*} dato 
     */
    iniciarVolumenYEnvoltura(dato){
        this.volumenInicial = (dato & 0xF0) >> 4;
        this.volumen = this.volumenInicial;
        this.direccionEnvoltura = (dato & 0x80) >> 3;
        if(this.direccionEnvoltura == 0) this.direccionEnv = -1;
        else this.direccionEnv = +1;
        this.velocidadBarrido = dato & 0x03;
    }

    /** NR42: Volumen y envoltura de canal 4
     * https://gbdev.io/pandocs/Audio_Registers.html#ff21--nr42-channel-4-volume--envelope
     * @returns 
     */
    leerVolumenYEnvoltura(){
        return (
            this.volumenInicial << 4 |
            this.direccionEnvoltura << 3 |
            this.velocidadBarrido 
        )
    }

    /**
     * 
     * @param {*} tiempo Tiempo en milisegundos
     */
    actualizar(delta){
        var viejoTiempo = this.tiempo;
        var nuevoTiempo = this.tiempo + delta;
        if(this.velocidadBarrido != 0){
            var periodoEnv = 1000.0 / 64.0;
            var iteracionesEnvAntes = Math.floor(viejoTiempo / periodoEnv)
            var iteracionesEnvDespues = Math.floor(nuevoTiempo / periodoEnv)
            var interacionesEnv = iteracionesEnvDespues - iteracionesEnvAntes;
            for(var i = 0; i < interacionesEnv; i++){
                this.volumen -= this.direccionEnv;
                if(this.volumen < 0) { this.volumen = 0; }
                if(this.volumen > 15) { this.volumen = 15; }
                console.log("vol = " + this.volumen);
            }
            this.sonido.actualizarGanancia(1, this.volumen / 15);
        }
        this.tiempo = nuevoTiempo;
    }


}

class Canal4{
    constructor(){

    }
}

class Audio{
    constructor(registrosAudio, registrosCanal1){
        this.canal1 = new Canal1(registrosCanal1)
        this.regs = registrosAudio;
    }
}

/** ------- Clase Sonido -------- **/
class Sonido{
    constructor(){

        console.debug("SONIDO")

        this.contextoAudio = new (window.AudioContext || window.webkitAudioContext)();

        this.osciladores = [
            this.contextoAudio.createOscillator(),
            this.contextoAudio.createOscillator(),
            this.contextoAudio.createOscillator(),
            this.contextoAudio.createOscillator()
        ];
        // https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createGain#examples
        this.ganancias = [
            this.contextoAudio.createGain(),
            this.contextoAudio.createGain(),
            this.contextoAudio.createGain(),
            this.contextoAudio.createGain()
        ]

        this.osciladores[0].setPeriodicWave(this.crearOndaCuandrada(0.125));
        this.osciladores[1].setPeriodicWave(this.crearOndaCuandrada(0.125));
        this.osciladores[0].connect(this.ganancias[0]);
        this.osciladores[1].connect(this.ganancias[1]);
        this.osciladores[3].connect(this.ganancias[3]);
        this.ganancias[0].gain.setValueAtTime(0.05, this.contextoAudio.currentTime);
        this.ganancias[1].gain.setValueAtTime(0.05, this.contextoAudio.currentTime);
        this.ganancias[3].gain.setValueAtTime(0.05, this.contextoAudio.currentTime);

        this.final = this.contextoAudio.createGain();

        this.ganancias[0].connect(this.final);
        this.ganancias[1].connect(this.final);
        this.ganancias[3].connect(this.final);

        this.final.connect(this.contextoAudio.destination);

        this.osciladores[0].start();
        this.osciladores[1].start();


    }

    actualizarFrecuencia(numCanal, periodo){
        var frecuencia = 131072  / (2048 - periodo)
        this.osciladores[numCanal].frequency.setValueAtTime(
            frecuencia, this.contextoAudio.currentTime
        )
    }

    actualizarGanancia(numCanal, ganancia){
        this.ganancias[numCanal].gain.setValueAtTime(ganancia, this.contextoAudio.currentTime)
    }

    actualizarVolumen(volumen){
        this.final.gain.setValueAtTime(volumen, this.contextoAudio.currentTime);
    }

    reproducirOnda(numCanal, onda){
        this.osciladores[numCanal].setPeriodicWave(onda)
    }

    crearOndaCuandrada(duty){
        var res = 256; // up to 8192 according to spec
        var real = new Float32Array(res);
        var imag = new Float32Array(res);
    
        real[0] = 0.5 * duty;
        for (var n = 1; n < res; n++) {
            real[n] = 0.5 * Math.sin( 3.141592653589793 * n * duty )/(1.570796326794896 * n)
        }
        return this.contextoAudio.createPeriodicWave(real, imag, {disableNormalization: true});

    }
}