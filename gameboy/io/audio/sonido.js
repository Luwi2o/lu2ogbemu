// @ts-check
import { FFT } from "../../util/fft.js";

/**
 * Clase Sonido
 */
export class Sonido{

    /**
     * Constructor
     */
    constructor(){
        this.destruido = false;
        this._oscilloscopeRaf = null;

        this.tamanyoFFT = 512;
        /** @type {AudioContext} */
        this.contextoAudio = new (
            window.AudioContext ||
            /** @type {any} */ (window).webkitAudioContext
        )();
        /** @type {FFT} */
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

        // 
        // https://gbdev.io/pandocs/Audio_Registers.html#ff11--nr11-channel-1-length-timer--duty-cycle
        // Solo existen cuatro tipos de onda cuadrada, dadas por su ciclo util
        this.ondas = [
            this.crearOndaCuandrada(0.125), // 00: 12.5%
            this.crearOndaCuandrada(0.25), // 00: 25%
            this.crearOndaCuandrada(0.5), // 00: 50%
            this.crearOndaCuandrada(0.75), // 00: 12.5%
        ]

        this.gananciaCanal = [0, 0, 0, 0];
        this.recorteCanal = [0.055, 0.055, 0.04, 0.014];
        this.lfsr = 0x7FFF;
        this.lfsrAncho7 = false;
        this.lfsrFrecuencia = 440;
        this.lfsrFase = 0;
        this.lfsrSalida = 0;

        // Dar al canal 4 su funcionalidad de LFSR.
        this.osciladores[3].addEventListener("audioprocess", (event) => this.procesarRuido(event));

        this.analizadores = [
            this.contextoAudio.createAnalyser(),
            this.contextoAudio.createAnalyser(),
            this.contextoAudio.createAnalyser(),
            this.contextoAudio.createAnalyser()
        ]

        this.activados = [
            true, true, true, true
        ]
        this.osciladores[0].connect(this.ganancias[0]);
        this.osciladores[1].connect(this.ganancias[1]);
        this.osciladores[2].connect(this.ganancias[2]);
        this.osciladores[3].connect(this.ganancias[3]);

        for(var i = 0; i < 4; i++){
            this.ganancias[i].connect(this.analizadores[i])
        }

        // Crear analizador para canal 3
        this.analizador = this.contextoAudio.createAnalyser();
        this.analizador.fftSize = 512;
        const bufferLength = this.analizador.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analizador.getByteTimeDomainData(dataArray); 


        const analizadores = this.analizadores;

        // Dibujar en canvas
        const canvas = document.getElementById("oscilloscope");
        const canvasCtx = canvas ? /** @type {HTMLCanvasElement} */ (canvas).getContext("2d") : null;
        if (canvas && canvasCtx) {
            canvasCtx.clearRect(0, 0, 160, 144);
            const posX = [0, 160/2, 0, 160/2] // Posiciones X de los canales
            const posY = [0, 0, 144/2, 144/2] // Posiciones Y de los canales

            // Dibujar las formas de onda de los canales
            function draw() {
                thisRef._oscilloscopeRaf = requestAnimationFrame(draw);
                const canvasElement = /** @type {HTMLCanvasElement} */ (canvas);
                canvasCtx.fillStyle = "rgb(200 200 200)";
                canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
                canvasCtx.lineWidth = 1;
                canvasCtx.strokeStyle = "rgb(0 0 0)";
                
                // Dibujar cada canal
                for(var canal = 0; canal < 4; canal++){
                    analizadores[canal].getByteTimeDomainData(dataArray);
        
                    canvasCtx.beginPath();
        
                    const sliceWidth = ((canvasElement.width * 1.0) / 2) / bufferLength;
                    let x = posX[canal];
                    
                    // Dibujar la forma de onda
                    for (let i = 0; i < bufferLength; i++) {
                        const v = dataArray[i] / 128.0;
                        const y = v * canvasElement.height / 2;
        
                        if (i === 0) {
                            canvasCtx.moveTo(x, posY[canal] + y/2);
                        } else {
                            canvasCtx.lineTo(x, posY[canal] + y/2);
                        }
        
                        x += sliceWidth;
                    }
                    canvasCtx.stroke();
                }
            }

            const thisRef = this;
            draw();
        }

        // Inicializar ganancias
        const currentTime = this.contextoAudio.currentTime ?? 0;
        this.actualizarGanancia(0, 0);
        this.actualizarGanancia(1, 0);
        this.actualizarGanancia(2, 0);
        this.actualizarGanancia(3, 0);

        this.final = this.contextoAudio.createGain();
        this.volumenMaestro = /** @type {number} */ 1;
        this.maestro = this.contextoAudio.createGain();

        this.ganancias[0].connect(this.maestro);
        this.ganancias[1].connect(this.maestro);
        this.ganancias[2].connect(this.maestro);
        this.ganancias[3].connect(this.maestro);

        this.maestro.connect(this.final);

        this.final.connect(this.contextoAudio.destination);

        /** @type {OscillatorNode} */ (this.osciladores[0]).start();
        /** @type {OscillatorNode} */ (this.osciladores[1]).start();
        /** @type {OscillatorNode} */ (this.osciladores[2]).start();
        //this.osciladores[3].start();

    }

    /**
     * Desactiva un canal de audio
     * @param {number} numCanal Numero de canal a desactivar
     */
    desactivarCanal(numCanal){
        this.activados[numCanal] = false;
        if(!this.osciladores[numCanal] || !this.ganancias[numCanal]) return;
        this.ganancias[numCanal].gain.setValueAtTime(0, this.contextoAudio.currentTime ?? 0);
        // Comprobar si el canal ya esta desconectado
        if(this.osciladores[numCanal].numberOfOutputs == 0) return;
        //this.osciladores[numCanal].disconnect(this.ganancias[numCanal])
        
    }

    /**
     * Activa un canal de audio
     * @param {*} numCanal Numero de canal a activar
     */
    activarCanal(numCanal){
        if(this.activados[numCanal] == false){
            this.activados[numCanal] = true;
            if(!this.osciladores[numCanal] || !this.ganancias[numCanal]) return;
            this.actualizarGanancia(numCanal, this.gananciaCanal[numCanal] ?? 0);
        }
    }

    /**
     * Actualiza la onda del canal 3 con datos de RAM
     * @param {Uint8Array} ondaRAM Datos de onda de RAM
     */
    actualizarOnda3(ondaRAM){
        const real = new Float32Array(this.tamanyoFFT);
        const imag = new Float32Array(this.tamanyoFFT);
        const muestras = new Float32Array(this.tamanyoFFT);

        for(let i = 0; i < 16; i++){
            const muestraH = ondaRAM[i] >> 4;
            for(let j = 0; j < 16; j++){
                muestras[i * 32 + j] = (muestraH / 7.5) - 1;
            }
            const muestraL = ondaRAM[i] & 0x0F;
            for(let j = 0; j < 16; j++){
                muestras[i * 32 + 16 + j] = (muestraL / 7.5) - 1;
            }
        }
        this.fft.transformar(muestras, real, imag);
        /** @type {OscillatorNode} */ (this.osciladores[2]).setPeriodicWave(
            this.contextoAudio.createPeriodicWave(real, imag, {disableNormalization: true})
        );

    }

    activarMaestro(){
        if (this.maestro && this.volumenMaestro) {
            this.maestro.gain.setValueAtTime(this.volumenMaestro, /** @type {number} */ (this.contextoAudio.currentTime) ?? 0);
        }
    }

    desactivarMaestro(){
        if (this.maestro) {
            this.maestro.gain.setValueAtTime(0, /** @type {number} */ (this.contextoAudio.currentTime) ?? 0);
        }
    }

    /**
     * Actualiza la frecuencia de un canal
     * @param {number} numCanal Numero de canal
     * @param {number} periodo Periodo a actualizar
     **/
    actualizarFrecuencia(numCanal, periodo){
        var frecuencia = /** @type {number} */ (131072  / (2048 - periodo)); // Hz
        /** @type {OscillatorNode} */ (this.osciladores[numCanal]).frequency.setValueAtTime(
            frecuencia, this.contextoAudio.currentTime ?? 0
        )
    }

    /**
     * Actualiza el divisor de un canal, el divisor determina la frecuencia
     * @param {*} numCanal Numero de canal
     * @param {*} divisor Divisor a actualizar
     * @param {*} cambioReloj Cambio de reloj
     */
    actualizarDivisor(numCanal, divisor, cambioReloj){
        if(numCanal != 3) return;

        const divisoresRuido = [0.5, 1, 2, 3, 4, 5, 6, 7];
        const divisorRuido = divisoresRuido[divisor & 0x07];
        this.lfsrFrecuencia = 262144 / (divisorRuido * Math.pow(2, cambioReloj));
        if(!Number.isFinite(this.lfsrFrecuencia) || this.lfsrFrecuencia <= 0){
            this.lfsrFrecuencia = 440;
        }
    }

    /**
     * Actualiza la ganancia de un canal
     * @param {number} numCanal Numero de canal
     * @param {number} ganancia Ganancia a actualizar
     */
    actualizarGanancia(numCanal, ganancia){
        const normalizada = Math.max(0, Math.min(1, ganancia));
        this.gananciaCanal[numCanal] = normalizada;
        const recorte = this.recorteCanal[numCanal] ?? 0.05;
        this.ganancias[numCanal].gain.setValueAtTime(
            normalizada * recorte, 
            /** @type {number} */ (this.contextoAudio.currentTime ?? 0))
    }

    /**
     * Actualiza el volumen maestro
     * @param {number} volumen 
     */
    actualizarVolumenMaestro(volumen){
        this.volumenMaestro = volumen
        if(!this.maestro) return;
        this.maestro.gain.setValueAtTime(this.volumenMaestro, /** @type {number} */ (this.contextoAudio.currentTime) ?? 0);
    }

    /**
     * Actualiza el volumen final
     * @param {number} volumen 
     */
    actualizarVolumen(volumen){
        if(!this.final) return;
        this.final.gain.setValueAtTime(
            volumen, 
            /** @type {number} */ (this.contextoAudio.currentTime) ?? 0
        );
    }

    /**
     * Reproduce una onda personalizada
     * @param {*} numCanal 
     * @param {*} indiceOnda 
     */
    reproducirOnda(numCanal, indiceOnda){
        /** @type {OscillatorNode} */ (this.osciladores[numCanal]).setPeriodicWave(this.ondas[indiceOnda])
    }

    /**
     * Reproduce una onda aleatoria
     * @param {*} numCanal 
     * @param {*} indiceOnda 
     */
    reproducirOndaAleatoria(numCanal, indiceOnda){
        /** @type {OscillatorNode} */ (this.osciladores[numCanal]).setPeriodicWave(this.ondas[indiceOnda])
    }


    /**
     * 
     * @param {number} dato 
     * @returns 
     */
    actualizarAnchoLFSR(dato){
        this.lfsrAncho7 = (dato & 0x01) == 0x01;
    }

    reiniciarLFSR(){
        this.lfsr = 0x7FFF;
        this.lfsrFase = 0;
        this.lfsrSalida = 0;
    }

    async desbloquear(){
        if(!this.contextoAudio || this.contextoAudio.state !== "suspended") return;
        await this.contextoAudio.resume();
    }

    destruir(){
        if(this.destruido) return;
        this.destruido = true;

        if(this._oscilloscopeRaf !== null){
            cancelAnimationFrame(this._oscilloscopeRaf);
            this._oscilloscopeRaf = null;
        }

        const ahora = this.contextoAudio?.currentTime ?? 0;
        for(let i = 0; i < this.ganancias.length; i++){
            try {
                this.ganancias[i].gain.cancelScheduledValues(ahora);
                this.ganancias[i].gain.setValueAtTime(0, ahora);
            } catch (err) {}
        }

        try {
            this.maestro?.gain?.setValueAtTime(0, ahora);
            this.final?.gain?.setValueAtTime(0, ahora);
        } catch (err) {}

        for(const oscilador of this.osciladores){
            try {
                if(typeof oscilador.stop === "function") oscilador.stop();
            } catch (err) {}
            try {
                oscilador.disconnect();
            } catch (err) {}
        }

        for(const ganancia of this.ganancias){
            try {
                ganancia.disconnect();
            } catch (err) {}
        }
        for(const analizador of this.analizadores){
            try {
                analizador.disconnect();
            } catch (err) {}
        }
        try { this.maestro?.disconnect(); } catch (err) {}
        try { this.final?.disconnect(); } catch (err) {}

        if(this.contextoAudio && this.contextoAudio.state !== "closed"){
            this.contextoAudio.close().catch(() => {});
        }
    }

    /**
     * Genera ruido de canal 4 con el LFSR de Game Boy.
     * @param {AudioProcessingEvent} audioProcessingEvent
     */
    procesarRuido(audioProcessingEvent){
        const outputBuffer = audioProcessingEvent.outputBuffer;
        const outputData = outputBuffer.getChannelData(0);
        const sampleRate = outputBuffer.sampleRate || this.contextoAudio.sampleRate || 44100;
        const pasosPorMuestra = this.lfsrFrecuencia / sampleRate;

        for (let sample = 0; sample < outputBuffer.length; sample++) {
            this.lfsrFase += pasosPorMuestra;
            while(this.lfsrFase >= 1){
                this.lfsrFase -= 1;
                const xor = (this.lfsr & 0x01) ^ ((this.lfsr >> 1) & 0x01);
                this.lfsr = (this.lfsr >> 1) | (xor << 14);
                if(this.lfsrAncho7){
                    this.lfsr = (this.lfsr & ~(1 << 6)) | (xor << 6);
                }
                this.lfsrSalida = (this.lfsr & 0x01) == 0 ? 1 : -1;
            }

            outputData[sample] = this.lfsrSalida * 0.65;
        }
    }

    /**
     * Crea una onda cuadrada
     * @param {*} duty Ciclo util
     * @returns PeriodicWave Onda cuadrada
     */
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
