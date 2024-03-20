
/**
 * Emula una gameboy
 */
const DMG0 = 0;
const BGB = 1;
const BGB_DMG0 = 2;
class Gameboy{

    /**
     * Constructor
     * @param {*} bytesPrograma 
     */
    constructor(bytesPrograma, guardado, estado){
        console.debug("---------- INICIO GAMEBOY ----------");

        if(guardado){
            console.log("GAMEBOY: Se ha proporcionado un archivo de guardado")
            this.guardado = guardado;
        }

        if(estado){
            console.log("GAMEBOY: Se ha proporcionado un archivo de estado")
        }

        this.tiempoAhora = performance.now();
        this.tiempoAntes = performance.now();

        this.tipoConsola = BGB_DMG0;
        // Si no se ha insertado un programa se inserta un ROM vacío
        if(!bytesPrograma) bytesPrograma = new Uint8Array(0x8000).fill(0);

        this.sonido = new Sonido();

        // Registros
        this.regLCD = new RegistrosLCD(this.tipoConsola, estado);
        this.regInt = new RegistrosInterrupciones(this.tipoConsola, estado);
        this.regBot = new RegistrosBotones(this.tipoConsola, estado);
        this.regCnl1 = new RegistrosCanal1(this.tipoConsola, this.sonido, estado);
        this.regCnl2 = new RegistrosCanal2(this.tipoConsola, this.sonido, estado);
        this.regAud = new RegistrosAudio(this.tipoConsola, this.sonido, estado);

        this.cPUDebug = new CPUDebug()

        // Memoria
        this.memoria = new Memoria(bytesPrograma, this.regLCD, this.regInt, this.regBot, this.regAud, 
                                    this.regCnl1, this.regCnl2, this.cPUDebug, this.guardado, estado);
        // CPU
        this.interrupciones = new Interrupciones(this.regInt, this.memoria);
        this.cpu = new CPU(this.memoria, this.interrupciones, this.tipoConsola, this.cPUDebug, estado);
        // IO
        this.pantalla = new Pantalla(this.regLCD, this.interrupciones, estado);
        this.botones = new Botones(this.regBot, this.interrupciones);
        this.audio = new Audio(this.regAud, this.regCnl1, this.regCnl2)

        this.intervalo_ciclo = null;
    }

    /**
     * Pausa la CPU en un PC determinado. Usado para hacer debug.
     * @param {*} pc Contador de programa en el que se quiere pausar.
     */
    pausarEn(pc){
        this.cpu.pausarEn(pc);
    }

    /**
     * Bucle de emulación.
     */
    emular(){
        var gb = this;
        window.requestAnimationFrame(function(){gb.emular()});

        this.tiempoAhora = performance.now();
        var diferencia = this.tiempoAhora - this.tiempoAntes;

        if(diferencia > 1000/60){
            this.pantalla.terminada = false;
            while(!this.pantalla.terminada && !this.cPUDebug.pausado){
                this.cpu.ciclo();
                //contadorCiclos += this.cpu.ciclos;
                this.pantalla.enCiclos(this.cpu.ciclos);
                this.interrupciones.enCiclos(this.cpu.ciclos);
                //this.regCnl1.enCiclos(this.cpu.ciclos);
                //this.regCnl2.enCiclos(this.cpu.ciclos);
            }
            this.regCnl1.actualizar(diferencia);
            this.regCnl2.actualizar(diferencia);
            this.tiempoAntes = this.tiempoAhora;// - (diferencia % 1000/60)
        }
    }

    cambiarEscalaPantalla(escala){
        this.pantalla.cambiarEscala(escala);
    }


    // --- Debug

    paso(){
        this.cpu.ciclo()
        this.pantalla.enCiclos(this.cpu.ciclos)
        this.interrupciones.enCiclos(this.cpu.ciclos);
    }

    pausar(){
        this.cpu.pausar();
    }

    continuar(){
        this.cpu.continuar();
    }

    continuarSinPausa(){
        this.cpu.continuarSinPausa();
    }

    /**
     * Se comienza el bucle de emulación.
     */
    iniciar(){
        this.emular();
    }

    pulsar(boton){
        this.botones.pulsar(boton);
    }

    soltar(boton){
        this.botones.soltar(boton);
    }
}