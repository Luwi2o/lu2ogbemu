// Memoria de GameBoy

// Tiene un bus de direcciones de 16 bits con el que se accede a ROM, RAM y I/O
// https://gbdev.io/pandocs/Memory_Map.html

// Mapa de memoria:
// Start	End	    Description	            Notes
// 0000	    3FFF	16 KiB ROM bank 00	    From cartridge, usually a fixed bank
// 4000	    7FFF	16 KiB ROM Bank 01~NN	From cartridge, switchable bank via mapper (if any)
// 8000	    9FFF	8 KiB Video RAM (VRAM)	In CGB mode, switchable bank 0/1
// A000	    BFFF	8 KiB External RAM	    From cartridge, switchable bank if any
// C000	    CFFF	4 KiB Work RAM (WRAM)	
// D000	    DFFF	4 KiB Work RAM (WRAM)	In CGB mode, switchable bank 1~7
// E000	    FDFF	Mirror of C000~DDFF 	Nintendo says use of this area is prohibited.
// FE00	    FE9F	Sprite attribute table (OAM)	
// FEA0	    FEFF	Not Usable	            Nintendo says use of this area is prohibited
// FF00	    FF7F	I/O Registers	
// FF80	    FFFE	High RAM (HRAM)	
// FFFF	    FFFF	Interrupt Enable register (IE)

// importa constantes.js

const NO_MBC = 0;
const MBC1 = 1;
const MBC2 = 2;
const MBC3 = 3;
const MBC5 = 4;
const MBC6 = 5;
const MBC7 = 6;
const MMM01 = 7;

const ROM = 0;
const FLASH = 1;

class Memoria{


    /** Constructor
     * @param {Array} rOM 
     * @param {RegistrosLCD} regLCD Registros IO de pantalla
     * @param {RegistrosInterrupciones} regInt Registros de interrupciones
     * @param {RegistroBotones} regBot  Registros IO de botones
     * @param {RegistrosAudio} regAud  Registros IO de audio maestro
     * @param {RegistrosCanal1} regCnl1 Registros IO de audio canal 1
     * @param {RegistrosCanal2} regCnl2 Registros IO de audio canal 2
     * @param {RegistrosCanal3} regCnl3 Registros IO de audio canal 3
     * @param {RegistrosCanal4} regCnl4 Registros IO de audio canal 4
     * @param {CPUDebug} cPUDebug
     * @param {Array} guardado Archivo de guardado, se copia a SRAM
     */
    constructor(rOM, regLCD, regInt, regBot, regAud, 
        regCnl1, regCnl2, regCnl3, regCnl4, 
        cPUDebug, guardado, estado){

        // Flag para mostrar los logs
        this.mostrarLogs = false;
        this.cPUDebug = cPUDebug;

        // Registros IO
        this.regLCD = regLCD; // Registros de Pantalla
        this.regInt = regInt; // Registros de Interrupciones
        this.regBot = regBot; // Registros de Entrada por Botones
        this.regAud = regAud; // Registros de Audio
        this.regCnl1 = regCnl1; // Registros de Canal 1 de Audio
        this.regCnl2 = regCnl2; // Registros de Canal 2 de Audio
        this.regCnl3 = regCnl3; // Registros de Canal 3 de Audio
        this.regCnl4 = regCnl4; // Registros de Canal 4 de Audio

        // Reloj para MBC3
        this.regRTCSegundos = 0x3B;
        this.regRTCMinutos = 0x3B;
        this.regRTCHoras = 0x17;
        this.regRTCDiaLow = 0xFF;
        this.regRTCDiaHigh = 0x00;
        // MBC3, escritura de 0 en el rango de direcciones 6000-7FFF
        this.escrituraLatchRTC = false;
        this.latchRTC = false;

        //console.log("Numero de bancos ROM: " + numeroDeBancosROM);
        this.rOM = rOM;
        
        if(estado){
            this.wRAM0 = estado.memoria.wRAM0;
            this.wRAM1 = estado.memoria.wRAM1;
            this.iOReg = estado.memoria.iOReg;
            this.hRAM = estado.memoria.hRAM;
        } else {

            this.wRAM0 = new Uint8Array(0x1000).fill(0);
            this.wRAM1 = new Uint8Array(0x1000).fill(0);
            this.iOReg = new Uint8Array(0x80).fill(0);
            this.hRAM = new Uint8Array(0xFFFF - 0xFF80).fill(0);
        }

        this.memoriaStr = ""
        this.tituloCartucho = "";
        this.codigoFabricaCartucho = "";
        this.mejorasCGBActivadas = false;
        this.soloCGB = false;
        this.flagSGB = false;
        this.tipoCartucho = 0x00;
        
        this.tamanyoROM = 0x8000 // 32KiB
        this.cantidadBancosROM = 2;

        this.tamanyoRAM = 0;
        this.cantidadBancosRAM = 0;

        this.tipoMBC = 0;


        // Registros de memoria
        // 0000–1FFF — Activar RAM (Solo escritura)
        this.activadoRAM = true;
        // 2000–3FFF — Numero de banco ROM (Solo escritura)
        this.numeroBancoROM = 0x01;
        this.numeroBancoROMAlto = 0x00;
        this.bitsNecesariosBancoROM = 0x02 // Bits necesarios para representar el banco
        // 4000–5FFF — Numero de banco RAM — o — Upper Bits del Numero de banco ROM (Solo escritura)
        this.numeroBancoRAM = 0x00;
        // TODO MBC7 implementar
        this.numeroBancoRAMA = 0x00;
        this.numeroBancoRAMB = 0x01;
        this.activadoFlash = false;
        this.activadoEscrituraFlash = false;
        this.numeroBancoFlashA = 0x00;
        this.selectorA = ROM;
        this.numeroBancoFlashB = 0x00;
        this.selectorB = 0x00;
        
        // 6000–7FFF — Banking Mode Select (Solo escritura)
        this.modoBanco = 0;
        this.activadoRTC = false;

        // Encabezado del cartucho
        // https://gbdev.io/pandocs/The_Cartridge_Header.html#0147--cartridge-type
        // 0134-0143 — Titulo
        for(var i = 0; i < 10; i++){
            this.tituloCartucho += String.fromCharCode(rOM[0x0134 + i]);
        }
        // 013F-0142 — Codigo de Fabricante
        for(var i = 0; i < 10; i++){
            this.codigoFabricaCartucho += rOM[0x13F + i];
        }
        // 0143 — CGB flag
        if(rOM[0x0143] == 0x80) this.mejorasCGBActivadas = true;
        if(rOM[0x0143] == 0xC0){ 
            this.mejorasCGBActivadas = true;
            soloCGB = true;
        }
        // 0144–0145 — Codigo de nueva licencia
        // TODO implementar esto
        // 0146 — SGB flag
        if(rOM[0x0146] == 0x03) this.flagSGB = true;
        // 0147 — Tipo de cartucho
        this.tipoCartucho = rOM[0x0147];
        // 0148 — Tamaño de ROM
        switch(rOM[0x0148]){
            case 0x00:
                this.tamanyoROM = 0x8000; // 32KiB
                break;
            case 0x01:
                this.tamanyoROM = 0x10000; // 64KiB
                break;
            case 0x02:
                this.tamanyoROM = 0x20000; // 128KiB
                break;
            case 0x03:
                this.tamanyoROM = 0x40000;  // 256KiB
                break;
            case 0x04:
                this.tamanyoROM = 0x80000;  // 512KiB
                break;
            case 0x05:
                this.tamanyoROM = 0x100000;  // 1MiB
                break;
            case 0x06:
                this.tamanyoROM = 0x200000;  // 2MiB
                break;
            case 0x07:
                this.tamanyoROM = 0x400000;  // 4MiB
                break;
            case 0x08:
                this.tamanyoROM = 0x400000;  // 8MiB
                break;
            case 0x52:
                this.tamanyoROM = 72 * 0x4000;  // 8MiB
                break;
            case 0x53:
                this.tamanyoROM = 80 * 0x4000;  // 1.1 MiB
                break;
            case 0x54:
                this.tamanyoROM = 96 * 0x4000;  // 1.1 MiB
                break;
            default:
                this.tamanyoROM = 0x8000; // 32KiB
                break;
        }

        this.cantidadBancosROM = this.tamanyoROM / 0x4000; // tamaño / 16KiB
        // Mascara de bits
        this.bitsNecesariosBancosROM = 0
        for(var i = 0; i < 8; i++){
            var bit = this.cantidadBancosROM & (1 << i)
            if(bit != 0){
                this.bitsNecesariosBancosROM = i;
            }
        }
        this.mascaraBitsNecesariosBancosROM = 0;
        for(var i = 0; i < this.bitsNecesariosBancosROM; i++){
            this.mascaraBitsNecesariosBancosROM |= (1 << i)
        }

        // 0149 — Tamaño de RAM externa
        // Si el tipo de cartucho no incluye RAM en su nombre se debe poner el tamaño a 0
        switch(this.tipoCartucho){
            case GB_TIPO_CARTUCHO_ROM_SOLO:
            case GB_TIPO_CARTUCHO_MBC1:
            case GB_TIPO_CARTUCHO_MBC2:
            case GB_TIPO_CARTUCHO_MBC2_BATERIA:
            case GB_TIPO_CARTUCHO_MMM01:
            case GB_TIPO_CARTUCHO_MBC3_TIMER_BATERIA:
            case GB_TIPO_CARTUCHO_MBC3:
            case GB_TIPO_CARTUCHO_MBC5:
            case GB_TIPO_CARTUCHO_MBC5_VIBRACION:
            case GB_TIPO_CARTUCHO_MBC6:
            case GB_TIPO_CARTUCHO_POCKET_CAMERA:
            case GB_TIPO_CARTUCHO_BANDAI_TAMA5:
            case GB_TIPO_CARTUCHO_HuC3:
                this.tamanyoRAM = 0; // No RAM
                this.cantidadBancosRAM = 0;
                break;
            // El tipo de cartucho si tiene RAM
            default:
                switch(rOM[0x0149]){
                    case 0x00:
                        this.tamanyoRAM = 0; // No RAM
                        break;
                    case 0x01:
                        this.tamanyoRAM = 0; // Sin usar
                        break;
                    case 0x02:
                        this.tamanyoRAM = 0x2000; // 8 KiB, 1 banco
                        break;
                    case 0x03:
                        this.tamanyoRAM = 0x8000; // 32 KiB, 4 bancos
                        break;
                    case 0x04:
                        this.tamanyoRAM = 0x20000; // 128 KiB, 16 bancos
                        break;
                    case 0x05:
                        this.tamanyoRAM = 0x10000; // 64 KiB, 8 bancos
                        break;
                    default:
                        this.tamanyoRAM = 0;
                        break;
                }
        }
        this.cantidadBancosRAM = this.tamanyoRAM / 0x2000 // Tamaño de banco 8KiB

        if(estado){
            this.sRAM = estado.memoria.sRAM;
        } else {
            if(guardado){
                this.sRAM = guardado;
                console.log("MEMORIA: Cargando archivo de guardado");
            } else {
                this.sRAM = new Uint8Array(this.tamanyoRAM).fill(0); // RAM externa
                console.log("MEMORIA: No archivo de guardado");
            }
        }

        // 014A — Codigo de destino
        // TODO
        // 014B — Antiguo codigo de licencia
        // TODO
        // 014C — Mask ROM version number
        // TODO
        // 014D — Header checksum
        // TODO
        // 014E-014F — Global checksum
        // TODO

        var strTipoMBC = ""
        var strRAM = "NO RAM"
        switch(this.tipoCartucho){
            case GB_TIPO_CARTUCHO_ROM_RAM:
            case GB_TIPO_CARTUCHO_ROM_RAM_BATERIA:
                strRAM = "RAM";
            case GB_TIPO_CARTUCHO_ROM_SOLO:
                this.tipoMBC = ROM;
                strTipoMBC = "ROM";
                break;

            case GB_TIPO_CARTUCHO_MBC1_RAM:
            case GB_TIPO_CARTUCHO_MBC1_RAM_BATERIA:
                strRAM = "RAM";
            case GB_TIPO_CARTUCHO_MBC1:
                this.tipoMBC = MBC1;
                strTipoMBC = "MBC1";
                break;

            case GB_TIPO_CARTUCHO_MBC2:
            case GB_TIPO_CARTUCHO_MBC2_BATERIA:
                this.tipoMBC = MBC2;
                strTipoMBC = "MBC2";
                break;

            case GB_TIPO_CARTUCHO_MBC3_RAM:
            case GB_TIPO_CARTUCHO_MBC3_RAM_BATERIA:
            case GB_TIPO_CARTUCHO_MBC3_TIMER_RAM_BATERIA:
                strRAM = "RAM";
            case GB_TIPO_CARTUCHO_MBC3:
            case GB_TIPO_CARTUCHO_MBC3_TIMER_BATERIA:
                this.tipoMBC = MBC3;
                strTipoMBC = "MBC3";
                break;

            case GB_TIPO_CARTUCHO_MBC5_RAM:
            case GB_TIPO_CARTUCHO_MBC5_RAM_BATERIA:
            case GB_TIPO_CARTUCHO_MBC5_VIBRACION_RAM:
            case GB_TIPO_CARTUCHO_MBC5_VIBRACION_RAM_BATERIA:
                strRAM = "RAM";
            case GB_TIPO_CARTUCHO_MBC5:
            case GB_TIPO_CARTUCHO_MBC5_VIBRACION:
                this.tipoMBC = MBC5;
                strTipoMBC = "MBC5";
                break;

            default:
                this.tipoMBC = ROM;
                strTipoMBC = "OTRO"
        }


        console.debug("-----------MEMORIA-----------")
        console.debug("-----------------------------")
        console.debug("Titulo del cartucho: " + this.tituloCartucho);
        console.debug("Codigo de fabrica: " + this.codigoFabricaCartucho);
        console.debug("Tamaño de ROM: " + (16 * (this.tamanyoROM / 0x4000)) + "KiB")
        console.debug("Numero de bancos de ROM: " + this.cantidadBancosROM)
        console.debug("bits necesarios= " + this.cantidadBancosROM.toString(2));
        console.debug("Tamaño de RAM: " + (8 * (this.tamanyoRAM / 0x2000)) + "KiB" )
        console.debug("Numero de bancos de RAM: " + this.cantidadBancosRAM)
        console.debug("Tipo de cartucho: " + strTipoMBC + " (" + this.tipoCartucho + ")");
        console.debug("RAM: " + strRAM);

        console.debug("Bits de numero de bancos de ROM: " + this.cantidadBancosROM.toString(2))
        console.debug("Bits necesarios ROM: " + this.bitsNecesariosBancosROM)
        console.debug("Mascara bits necesarios ROM: " + this.mascaraBitsNecesariosBancosROM.toString(2))
    
        if(estado){
            this.cargarEstado();
        }
    }


    cargarEstado(estado){
        var s = estado.memoria;
        this.activadoRAM = s.activadoRAM;
        this.numeroBancoROM = s.numeroBancoROM;
        this.numeroBancoRAM = s.numeroBancoRAM;
        this.numeroBancoRAMA = s.numeroBancoRAMA;
        this.numeroBancoRAMB = s.numeroBancoRAMB;
        this.activadoFlash = s.activadoFlash;
        this.activadoEscrituraFlash = s.activadoEscrituraFlash;
        this.numeroBancoFlashA = s.numeroBancoFlashA;
        this.selectorA = s.selectorA;
        this.numeroBancoFlashB = s.numeroBancoFlashB;
        this.selectorB = s.selectorB;
    }

    /**
     * Lee 8 bits (1 byte) de la dirección de memoria emulada indicada.
     * @param {*} indice Direccion de la que se quiere leer el dato.
     * @param {*} dato Dato que se quiere escribir.
     * @returns dato que se encuentra en la direccion.
     */
    leer8Bits(indice){
        var lectura = 0xFF;
        if(indice < 0 || indice >= GB_TAMANO_MEMORIA){
            console.error("Lectura en indice fuera de los limites de memoria dir $" 
                + indice.toString(16))
            return 0xFF;
        }
        
        // 0000-3FFF - 16 KiB ROM bank 00
        if(indice >= 0x0000  && indice <= 0x3FFF){
            if(this.tipoMBC == MBC1){
                if(this.modoBanco == 1){
                    if(bootROM){
                        if(indice < 0x100){ lectura = bootROM[indice]; }
                        else{ lectura = this.rOM[indice]; }
                    } else{
                        lectura = this.rOM[((this.numeroBancoROMAlto << 5) * 0x4000) + indice];
                    }
                } else {
                    if(bootROM){
                        if(indice < 0x100){ lectura = bootROM[indice]; }
                        else{ lectura = this.rOM[indice]; }
                    } else{
                        lectura = this.rOM[indice];
                    }
                }
            } else {
                if(bootROM){
                    if(indice < 0x100){ lectura = bootROM[indice]; }
                    else{ lectura = this.rOM[indice]; }
                } else{
                    lectura = this.rOM[indice];
                }
            }
        }
        // 4000-7FFF - 16 KiB ROM Bank 01~NN
        else if(indice >= 0x4000  && indice <= 0x7FFF){
            lectura = this.rOM[(this.numeroBancoROM * 0x4000) + (indice - 0x4000)];

        }
        // 8000-9FFF - 8 KiB Video RAM (VRAM)
        else if(indice >= 0x8000  && indice <= 0x9FFF){
            //TODO
            lectura = this.regLCD.vRAM[indice - 0x8000];
        }
        // A000-BFFF - 8 KiB RAM externa
        else if(indice >= 0xA000  && indice <= 0xBFFF){
            // MBC1
            if(this.tipoMBC == MBC1){
                if(this.activadoRAM) 
                    lectura =  this.sRAM[indice + 0x2000 * this.numeroBancoRAM - 0xA000];
                else lectura = 0x00;
            }
            // MBC2
            else if(this.tipoMBC == MBC2){
                // Si el tipo de MBC es MBC2 la RAM solo incluye 512 mitades de bytes
                // Solo los 4 ultimos bits de los bytes se usa, el resto no estan definidos
                // Ademas no se usa la ram externa y solo se usan los 9 ultimos bits
                // de la direccion.
                if(this.activadoRAM) lectura = this.sRAM[(indice & 0x01FF) - 0xA000] & 0x0F;
                else lectura = 0x00;
            // MBC3
            } else if (this.tipoMBC == MBC3){
                if(this.activadoRAM){
                    lectura = this.sRAM[indice + (0x2000 * this.numeroBancoRAM) - 0xA000];
                }
                else lectura = 0x00;

            // MBC5
            } else if (this.tipoMBC == MBC5){
                lectura = this.sRAM[indice + 0x2000 * this.numeroBancoRAM - 0xA000];
            // ROM
            } else {
                lectura = this.sRAM[indice - 0xA000];
            }
        }
        // C000-CFFF - 4 KiB Work RAM (WRAM)
        else if(indice >= 0xC000  && indice <= 0xCFFF){
            lectura = this.wRAM0[indice - 0xC000];
        }
        // C000-CFFF - 4 KiB Work RAM (WRAM)
        else if(indice >= 0xD000  && indice <= 0xDFFF){
            lectura = this.wRAM1[indice - 0xD000];
        }
        // E000-FDFF Mirror of C000~DDFF (ECHO RAM)
        else if(indice >= 0xE000  && indice <= 0xEFFF){
            lectura = this.wRAM0[indice - 0xE000];
        }
        else if(indice >= 0xF000  && indice <= 0xFDFF){
            lectura = this.wRAM1[indice - 0xF000];
        }
        // FE00-FE9F - Sprite attribute table (OAM)
        else if(indice >= 0xFE00  && indice <= 0xFE9F){
            var offset = indice - 0xFE00
            var indiceObj = Math.floor(offset / 4)
            switch(offset % 4){
                case 0:
                    lectura = this.regLCD.objetos[indiceObj].y;
                    break;
                case 1:
                    lectura = this.regLCD.objetos[indiceObj].x;
                    break;
                case 2:
                    lectura = this.regLCD.objetos[indiceObj].tileIndice;
                    break;
                case 3:
                    lectura = this.regLCD.getObjAtributos(indiceObj)
                    break
                default:
                    console.error("Algo ha ido mal. offset del atributo del objeto no esperado")
                    break;
            }
        }
        // FEA0-FEFF Not Usable
        // No implementada
        // FF00-FF7F - I/O Registers
        else if(indice >= 0xFF00  && indice <= 0xFF7F){
            // FF30-FF3F RAM de ondas
            if(indice >= 0xFF30  && indice <= 0xFF3F){
                lectura = this.regCnl3.ondaRAM[indice - 0xFF30];
            }
            else{
                switch(indice){
                    // Botones
                    case GB_BOTONES_REG : lectura = this.regBot.leerRegBotones(); break;
    
                    case GB_PANTALLA_REG_CONTROL : lectura = this.regLCD.leerLCDControl(); break;
                    case GB_PANTALLA_REG_ESTADO: lectura = this.regLCD.leerLCDEstado(); break;
                    case GB_PANTALLA_REG_SCROLLY : lectura = this.regLCD.scrollY; break;
                    case GB_PANTALLA_REG_SCROLLX : lectura = this.regLCD.scrollX; break;
                    case GB_PANTALLA_REG_LY_COORD : lectura = this.regLCD.lineaY; break;
                    case GB_PANTALLA_REG_LYC_COMP : lectura = this.regLCD.lineaYComparar; break;
                    case GB_PANTALLA_REG_WX : lectura = this.regLCD.windowX; break;
                    case GB_PANTALLA_REG_WY : lectura = this.regLCD.windowY; break;
                    case GB_PALETA_REG_BG : lectura = this.regLCD.leerPaletaBGVentana(); break;
                    case GB_PALETA_REG_OBP0 : lectura = this.regLCD.leerPaletaObj0(); break;
                    case GB_PALETA_REG_OBP1 : lectura = this.regLCD.leerPaletaObj1(); break;
    
                    case GB_TEMPORIZADOR_REG_DIV : lectura = this.regInt.divisor; break;
                    case GB_INTERRUPCIONES_REG_IF : lectura = this.regInt.leerIF(); break;
                    case GB_TEMPORIZADOR_REG_TAC : lectura = this.regInt.leerTAC(); break;
                    case GB_TEMPORIZADOR_REG_TIMA : lectura = this.regInt.contador; break;
                    case GB_TEMPORIZADOR_REG_TMA : lectura = this.regInt.contadorModulo ; break;
    
                    case GB_SONIDO_REG_NR52 : lectura = this.regAud.leerAudioControlMaestro(); break;
                    case GB_SONIDO_REG_NR51 : lectura = this.regAud.leerAudioPanoramica(); break;
                    case GB_SONIDO_REG_NR50 : lectura = this.regAud.leerVolumenMaestro(); break;
    
                    case GB_SONIDO_REG_NR10 : lectura = this.regCnl1.leerBarrido(); break;
                    case GB_SONIDO_REG_NR11 : lectura = this.regCnl1.leerCicloYTemporizador(); break;
                    case GB_SONIDO_REG_NR12 : lectura = this.regCnl1.leerVolumenYEnvoltorio(); break;
                    // GB_SONIDO_REG_NR13 Solo escritura
                    case GB_SONIDO_REG_NR14 : lectura = this.regCnl1.leerPeriodoAltoYControl(); break;
    
                    case GB_SONIDO_REG_NR21 : lectura = this.regCnl2.leerCicloYTemporizador(); break;
                    case GB_SONIDO_REG_NR22 : lectura = this.regCnl2.leerVolumenYEnvoltorio(); break;
                    // GB_SONIDO_REG_NR23 Solo escritura
                    case GB_SONIDO_REG_NR24 : lectura = this.regCnl2.leerPeriodoAltoYControl(); break;
    
                    // Registros de Audio Canal 3
                    case GB_SONIDO_REG_NR30 : lectura = this.regCnl3.leerActivadoDAC(); break;
                    case GB_SONIDO_REG_NR31 : lectura = this.regCnl3.leerTemporizador(); break;
                    case GB_SONIDO_REG_NR32 : lectura = this.regCnl3.leerNivelSalida(); break;
                    //case GB_SONIDO_REG_NR33 : lectura = this.regCnl3.leerPeriodoBajo(); break;
                    case GB_SONIDO_REG_NR34 : lectura = this.regCnl3.leerPeriodoAltoYControl(); break;

                    // Registros de Audio Canal 4
                    case GB_SONIDO_REG_NR42 : lectura = this.regCnl4.leerVolumenYEnvoltorio(); break;
                    case GB_SONIDO_REG_NR44 : lectura = this.regCnl4.leerControl(); break;
                    
                    default: lectura = this.iOReg[indice - 0xFF00]; break;
                }
            }

        }
        // FF80-FFFE - High RAM (HRAM)
        else if(indice >= 0xFF80  && indice <= 0xFFFE){
            lectura = this.hRAM[indice - 0xFF80];
        }
        // FFFF-FFFF - Interrupt Enable register (IE)
        else if(indice == 0xFFFF){
            lectura = this.regInt.leerIE();
        }
        
        if(lectura == undefined){
            console.error("Error en la lectura de la direccion $" + indice.toString(16));
            console.error("Numero de banco de ROM: " + this.numeroBancoROM)
            console.error("Numero de banco de RAM: " + this.numeroBancoRAM)
            return 0xFF;
        }


        if(this.mostrarLogs){
            this.memoriaStr += ("Lectura $" + indice.toString(16) 
                + " dato " + lectura.toString(16) + " ")
        }
        return lectura;
    }
    
    /**
     * Escribe 8 bits (1 byte) en la dirección de memoria indicada.
     * @param {*} indice Indice en el que se quiere escribir el dato.
     * @param {*} dato Dato que se quiere escribir.
     * @returns 
     */
    escribir8Bits(indice, dato){

        if(indice == undefined || dato == undefined){
            console.error("Error en intento de escritura undefined.")
            return;
        }
        if(indice < 0 && indice >= GB_TAMANO_MEMORIA){
            console.error("Escritura en indice fuera de los limites de memoria.")
            return;
        }

        // https://gbdev.io/pandocs/MBC1.html
        // Cartucho tipo MBC1
        if(this.tipoMBC == MBC1){
            // 0000–1FFF — Activa RAM (Solo Escritura)
            if(indice >= 0x0000  && indice <= 0x1FFF){
                // Cualquier escritura con $A en los 4 bits de menor significado activa 
                // la RAM externa.
                if((dato & 0x0F) == 0x0A) this.activadoRAM = true;
                else this.activadoRAM = false; // Cualquier otro valor desactiva la RAM
                
            }
            // 2000–3FFF — Numero de Banco ROM (Write Only)
            else if(indice >= 0x2000 && indice <= 0x3FFF){
                this.numeroBancoROM = dato & 0x1F;
                if(this.numeroBancoROM == 0){
                    this.numeroBancoROM = 0x01;
                    //console.log("el banco era 0, se pasa a 1")
                }
                // Se enmascaran los bits que no se necesitan
                this.numeroBancoROM &= this.mascaraBitsNecesariosBancosROM;
                //console.log("MBC1 Se cambia el banco ROM a " + this.numeroBancoROM)
            }
            // 4000–5FFF — Numero de Banco de RAM o Bits altos del numero de banco ROM (Solo escritura)
            else if(indice >= 0x4000 && indice <= 0x5FFF){
                // Se utiliza para seleccionar el banco de RAM en los cartuchos con 32KiB
                if(this.tamanyoRAM >= 0x8000){
                    this.numeroBancoRAM = dato & 0x03;
                    //console.log("MBC1 Se cambia el banco RAM a " + this.numeroBancoRAM);
                }
                // O se utiliza para seleccionar los 2 bits mas significantes (5,6) del
                // banco de ROM si es un cartucho con 1MiB o mas.
                else if(this.tamanyoROM >= 0x100000){
                    this.numeroBancoROMAlto = (dato & 0x03)
                    this.numeroBancoROM = (this.numeroBancoROM & 0x1F) 
                                            + (numeroBancoROMAlto << 5);
                    if(this.numeroBancoROM == 0) this.numeroBancoROM = 0x01;
                    this.numeroBancoROM &= this.mascaraBitsNecesariosBancosROM;
                    //console.log("MBC1 Se cambia el banco (bits altos) ROM a " + this.numeroBancoROM);
                }
                // Si la RAM o la ROM no son lo suficientemente grandes no se hace nada
                else{

                }
            }
            // 6000–7FFF — Banking Mode Select (Write Only)
            else if(indice >= 0x6000  && indice <= 0x7FFF){
                // 
                if(dato & 0x01  == 0) this.modoBanco = 0;
                else this.modoBanco = 1;
                console.log("BANCO: " + this.modoBanco);
            }
        }
        // https://gbdev.io/pandocs/MBC2.html
        else if(this.tipoMBC == MBC2){
            // 0000–3FFF — Activa RAM, Numero de Banco de ROM (Solo Escritura)
            if(indice >= 0x0000  && indice <= 0x3FFF){
                // Este rango de direcciones es responsable de activar/desactivar la ram
                // y para controlar el numero de banco de ROM.
                // El bit 8 de la direccion controla si se controla la RAM o el banco ROM 
                // X 0000 0000 
                const bit8 = indice & 0x0100
                // Si el bit 8 es 0
                if(bit8 == 0){
                    // Cuando el valor escrito en la direccion es 0x0A, se activa la RAM
                    if(dato == 0x0A) this.activadoRAM = true;
                    // Cuando el valor es cualquier otro se desactiva
                    else this.activadoRAM = false;
                    
                // Si el bit 8 es 1
                } else {
                    // El valor controla el banco de ROM seleccionado de 4000–7FFF
                    // Especificamente los 4 bits mas bajos del valor escrito en la direccion
                    // especifican el banco de ROM. (dato & 00001111())
                    this.numeroBancoROM = dato & 0x0F;
                    if(this.numeroBancoROM == 0) this.numeroBancoROM = 0x01;
                    //console.log("MBC2 Se cambia el banco a " + this.numeroBancoROM)
                }

            }
        }
        // https://gbdev.io/pandocs/MBC3.html
        else if(this.tipoMBC == MBC3){
            // 0000–1FFF — Activa RAM Y Timer (Solo Escritura)
            if(indice >= 0x0000  && indice <= 0x1FFF){
                // Cualquier escritura con $A en los 4 bits de menor significado activa 
                // la RAM externa.
                if(dato == 0x0A){
                    this.activadoRAM = true;
                    this.activadoRTC = true;
                } else if (dato == 0x00){ // Cualquier otro valor desactiva la RAM
                    this.activadoRAM = false;
                    this.activadoRTC = false;
                }
            }
            // 2000–3FFF — Numero de Banco ROM (Solo Escritura)
            else if(indice >= 0x2000 && indice <= 0x3FFF){
                // Igual que en MBC1 pero con los 7 bits
                this.numeroBancoROM = dato & 0x7F;
                if(this.numeroBancoROM == 0){
                    this.numeroBancoROM = 0x01;
                }
                this.numeroBancoROM &= this.mascaraBitsNecesariosBancosROM;
                //console.log("MBC3 Se cambia el banco ROM a " + this.numeroBancoROM);
            }
            // 4000–5FFF — Numero de Banco de RAM 
            // — o — Selector de Registro RTC (Solo Escritura)
            else if(indice >= 0x4000 && indice <= 0x5FFF){
                // Escribir un valor en el rango 0x00 - 0x03 mapea el banco de RAM externo
                if(dato >= 0x00 && dato <= 0x03){
                    this.numeroBancoRAM = dato;
                    //console.log("MBC3 Se cambia el banco RAM a " + this.numeroBancoRAM)
                } else if (dato >= 0x08 && dato <= 0x0C){
                    this.selectorRegistroRTC = dato;
                }
            }
            else if(indice >= 0x6000  && indice <= 0x7FFF){
                if(dato == 0x00) this.escrituraLatchRTC = true;
                else{
                    if(dato == 0x01){
                        if(this.latchRTC == false) this.latchRTC = true;
                        else this.latchRTC = false;
                    }
                    this.escrituraLatchRTC = false;
                }
            }
            
        }
        // https://gbdev.io/pandocs/MBC5.html
        else if(this.tipoMBC == MBC5){
            // 0000–1FFF — Activado de RAM externa (Solo Escritura)
            if(indice >= 0x0000  && indice <= 0x1FFF){
                // Cualquier escritura con $0A activa la RAM externa.
                if(dato == 0x0A){
                    this.activadoRAM = true;
                // Cualquier escritura con $00 desactiva la RAM
                } else if (dato == 0x00){
                    this.activadoRAM = false;
                }
                return;
            }
            // 2000–2FFF — 8 bits menos significantes del numero de banco ROM (Solo Escritura)
            else if(indice >= 0x2000  && indice <= 0x3FFF){
                this.numeroBancoROM = (this.numeroBancoROM & 0x0100) + (dato & 0xFF);
                //console.log("Se cambia el banco a " + this.numeroBancoROM)
            }
            // 3000–3FFF — bit 9  del numero de banco ROM (Solo Escritura)
            else if(indice >= 0x3000  && indice <= 0x3FFF){
                this.numeroBancoROM = (this.numeroBancoROM & 0x00FF) + ((dato & 0x01) << 8);
                //console.log("Se cambia el banco a " + this.numeroBancoROM)
            }
            // 4000-5FFF - Numero de banco de RAM (Solo Escritura)
            else if(indice >= 0x4000  && indice <= 0x5FFF){
                this.numeroBancoRAM = (dato & 0x0F);
                //console.log("Se cambia el banco de RAM a " + this.numeroBancoRAM)
            }

        }
        else{
            // 0000–1FFF — Activa RAM (Solo Escritura)
            if(indice >= 0x0000  && indice <= 0x1FFF){
                // Cualquier escritura con $A en los 4 bits de menor significado activa 
                // la RAM externa.
                if((dato & 0x0F) == 0x0A) this.activadoRAM = true;
                else this.activadoRAM = false; // Cualquier otro valor desactiva la RAM
                
            }
            // 2000–3FFF — Numero de Banco ROM (Write Only)
            else if(indice >= 0x2000  && indice <= 0x3FFF){
                this.numeroBancoROM = dato & 0x1F;
                if(this.numeroBancoROM == 0) this.numeroBancoROM = 0x01;
                // Se enmascaran los bits que no se necesitan
                this.numeroBancoROM &= this.mascaraBitsNecesariosBancosROM;
                console.log("ROM Se cambia el banco ROM a " + this.numeroBancoROM)
                //console.log("Se cambia el banco a " + this.numeroBancoROM)
            }
            // 4000–5FFF — Numero de Banco de RAM o Bits altos del numero de banco ROM (Solo escritura)
            else if(indice >= 0x4000  && indice <= 0x5FFF){
                // Se utiliza para seleccionar el banco de RAM en los cartuchos con 32KiB
                if(this.tamanyoRAM == 0x8000){
                    this.numeroBancoRAM = dato & 0x03;
                    console.log("MBC1 Se cambia el banco RAM a " + this.numeroBancoRAM);
                }
                // O se utiliza para seleccionar los 2 bits mas significantes (5,6) del
                // banco de ROM si es un cartucho con 1MiB o mas.
                else if(this.tamanyoROM >= 0x100000){

                    this.numeroBancoROM = (this.numeroBancoROM & 0x1F) + ((dato & 0x03) << 5);
                    if(this.numeroBancoROM == 0) this.numeroBancoROM = 0x01;
                    this.numeroBancoROM &= this.mascaraBitsNecesariosBancosROM;
                    console.log("MBC1 Se cambia el banco (bits altos) ROM a " + this.numeroBancoROM);
                }
                // Si la RAM o la ROM no son lo suficientemente grandes no se hace nada
                else{
                    
                }
            }
            // 6000–7FFF — Banking Mode Select (Write Only)
            else if(indice >= 0x6000  && indice <= 0x7FFF){
                // 
                if(dato & 0x01  == 0) this.modoBanco = 0;
                else this.modoBanco = 1;
                console.log("BANCO: " + this.modoBanco);
            }
        }

        // Comienzo de RAM
        // 8000-9FFF - 8 KiB Video RAM (VRAM)
        if(indice >= 0x8000  && indice <= 0x9FFF){
            this.regLCD.vRAM[indice - 0x8000] = dato;
        }
        // A000-BFFF - 8 KiB External RAM (SRAM)
        else if(indice >= 0xA000  && indice <= 0xBFFF){
            if(this.tipoMBC == MBC1){
                this.sRAM[indice - 0xA000] = dato;
            // Si el tipo de MBC es MBC2 la RAM solo incluye 512 mitades de bytes
            // Solo los 4 ultimos bits de los bytes se usa, el resto no estan definidos
            // Ademas no se usa la ram externa y solo se usan los 9 ultimos bits
            // de la direccion.
            } else if(this.tipoMBC == MBC2) {
                this.sRAM[(indice & 0x01FF) - 0xA000] = dato;
            } else if(this.tipoMBC == MBC3){
                this.sRAM[indice + (this.numeroBancoRAM * 0x2000) - 0xA000] = dato;
            }
            else{
                this.sRAM[indice - 0xA000] = dato;
            }
        }
        // C000-CFFF - 4 KiB Work RAM (WRAM)
        else if(indice >= 0xC000  && indice <= 0xCFFF){
            this.wRAM0[indice - 0xC000] = dato;
        }
        // D000-DFFF - 4 KiB Work RAM (WRAM)
        else if(indice >= 0xD000  && indice <= 0xDFFF){
            this.wRAM1[indice - 0xD000] = dato;
        }
        // E000-FDFF Espejo de C000~DDFF (ECHO RAM)
        else if(indice >= 0xE000  && indice <= 0xEFFF){
            this.wRAM0[indice - 0xE000] = dato;
        }
        else if(indice >= 0xF000  && indice <= 0xFDFF){
            this.wRAM1[indice - 0xF000] = dato;
        }
        // FE00-FE9F - Sprite attribute table (OAM)
        else if(indice >= 0xFE00  && indice <= 0xFE9F){
            var offset = indice - 0xFE00
            var indiceObj = Math.floor(offset / 4)
            switch(offset % 4){
                case 0:
                    this.regLCD.objetos[indiceObj].y = dato;
                    break;
                case 1:
                    this.regLCD.objetos[indiceObj].x = dato;
                    break;
                case 2:
                    this.regLCD.objetos[indiceObj].tileIndice = dato;
                    break;
                case 3:
                    this.regLCD.setObjAtributos(indiceObj, dato)
                    break
                default:
                    console.error("Algo ha ido mal. offset del atributo del objeto no esperado")
                    break;
            }
        }
        // FEA0-FEFF Not Usable
        // No implementada
        // FF00-FF7F - I/O Registers
        else if(indice >= 0xFF00  && indice <= 0xFF7F){
            // FF30-FF3F RAM de ondas
            if(indice >= 0xFF30  && indice <= 0xFF3F){
                this.regCnl3.ondaRAM[indice - 0xFF30] = dato;
                this.regCnl3.ondaActualizada = true;
            } else {
                switch(indice){
                    // Registro botones
                    case GB_BOTONES_REG : this.regBot.escribirRegBotones(dato); break;
    
                    // Registros de LCD
                    case GB_PANTALLA_REG_CONTROL : this.regLCD.escribirLCDControl(dato); break;
                    case GB_PANTALLA_REG_ESTADO: this.regLCD.escribirLCDEstado(dato); break;
                    case GB_PANTALLA_REG_SCROLLY : this.regLCD.scrollY = dato; break;
                    case GB_PANTALLA_REG_SCROLLX : this.regLCD.scrollX = dato; break;
                    //case GB_PANTALLA_REG_LY_COORD : this.regLCD.lineY = dato; break; // Solo lectura.
                    case GB_PANTALLA_REG_LYC_COMP : this.regLCD.lineaYComparar = dato; break;
                    case GB_PANTALLA_OAM_DMA_TRANSFER : this.transferenciaDmaOam(dato); break;
                    case GB_PANTALLA_REG_WX : this.regLCD.windowX = dato; break;
                    case GB_PANTALLA_REG_WY : this.regLCD.windowY = dato; break;
                    case GB_PALETA_REG_BG : this.regLCD.escribirPaletaBGVentana(dato); break;
                    case GB_PALETA_REG_OBP0 : this.regLCD.escribirPaletaObj0(dato); break;
                    case GB_PALETA_REG_OBP1 : this.regLCD.escribirPaletaObj1(dato); break;
    
                    // Registros de Interrupciones
                    case GB_TEMPORIZADOR_REG_DIV : this.regInt.divisor = 0x00; break;
                    case GB_INTERRUPCIONES_REG_IF : this.regInt.escribirIF(dato); break;
                    case GB_TEMPORIZADOR_REG_TAC : this.regInt.escribirTAC(dato); break;
                    case GB_TEMPORIZADOR_REG_TIMA : this.regInt.contador = 0; break;
                    case GB_TEMPORIZADOR_REG_TMA : this.regInt.contadorModulo = dato; break;
    
                    // Registros de Audio Maestro
                    case GB_SONIDO_REG_NR52 : this.regAud.escribirAudioControlMaestro(dato); break;
                    case GB_SONIDO_REG_NR51 : this.regAud.escribirAudioPanoramica(dato); break;
                    case GB_SONIDO_REG_NR50 : this.regAud.escribirVolumenMaestro(dato); break;
    
                    // Registros de Audio Canal 1
                    case GB_SONIDO_REG_NR10 : this.regCnl1.escribirBarrido(dato); break;
                    case GB_SONIDO_REG_NR11 : this.regCnl1.escribirCicloYTemporizador(dato); break;
                    case GB_SONIDO_REG_NR12 : this.regCnl1.escribirVolumenYEnvoltorio(dato); break;
                    case GB_SONIDO_REG_NR13 : this.regCnl1.escribirPeriodoBajo(dato); break;
                    case GB_SONIDO_REG_NR14 : this.regCnl1.escribirPeriodoAltoYControl(dato); break;
    
                    // Registros de Audio Canal 2
                    case GB_SONIDO_REG_NR21 : this.regCnl2.escribirCicloYTemporizador(dato); break;
                    case GB_SONIDO_REG_NR22 : this.regCnl2.escribirVolumenYEnvoltorio(dato); break;
                    case GB_SONIDO_REG_NR23 : this.regCnl2.escribirPeriodoBajo(dato); break;
                    case GB_SONIDO_REG_NR24 : this.regCnl2.escribirPeriodoAltoYControl(dato); break;
    
                    // Registros de Audio Canal 3
                    case GB_SONIDO_REG_NR30 : this.regCnl3.escribirActivadoDAC(dato); break;
                    case GB_SONIDO_REG_NR31 : this.regCnl3.escribirTemporizador(dato); break;
                    case GB_SONIDO_REG_NR32 : this.regCnl3.escribirNivelSalida(dato); break;
                    case GB_SONIDO_REG_NR33 : this.regCnl3.escribirPeriodoBajo(dato); break;
                    case GB_SONIDO_REG_NR34 : this.regCnl3.escribirPeriodoAltoYControl(dato); break;

                    // Registros de Audio Canal 4
                    case GB_SONIDO_REG_NR41 : this.regCnl4.escribirTemporizador(dato); break;
                    case GB_SONIDO_REG_NR42 : this.regCnl4.escribirVolumenYEnvoltorio(dato); break;
                    case GB_SONIDO_REG_NR43 : this.regCnl4.escribirFrecuenciaYAletoriedad(dato); break;
                    case GB_SONIDO_REG_NR44 : this.regCnl4.escribirControl(dato); break;
    
                    default: this.iOReg[indice - 0xFF00] = dato; break;
                }
            }
        }
        // FF80-FFFE - High RAM (HRAM)
        else if(indice >= 0xFF80  && indice <= 0xFFFE){
            this.hRAM[indice - 0xFF80] = dato;
        }
        // FFFF-FFFF - Interrupt Enable register (IE)
        else if(indice == 0xFFFF){
            this.regInt.escribirIE(dato);
        }

        // Mostrar logs
        if(this.mostrarLogs)
            this.memoriaStr += ("Escritura $" + indice.toString(16) 
                + " dato " + dato.toString(16) + " ");

        return;
    }

    transferenciaDmaOam(dato){
        var dirOrigen = ((dato % 0xDF) << 8) 
        // Se transfiere de la direccion de origen $XX00-$XX9F, siendo XX el valor del dato
        // escrito y entre el rango $00 a $9F, hasta el destino FE00 - FE9F
        for(var i = 0; i < 40; i++){
            var dir = dirOrigen + (i * 4);
            this.regLCD.objetos[i].y = this.leer8Bits(dir + 0);
            this.regLCD.objetos[i].x = this.leer8Bits(dir + 1);
            this.regLCD.objetos[i].tileIndice = this.leer8Bits(dir + 2);
            this.regLCD.setObjAtributos(i, this.leer8Bits(dir + 3));
        }
    }

    actualizarReg8bits(indice, dato){
        switch(indice){
            case GB_BOTONES_REG : this.regBot.escribirRegBotones(dato); break;

            case GB_PANTALLA_REG_CONTROL : this.regLCD.escribirLCDControl(dato); break;
            case GB_PANTALLA_REG_ESTADO: this.regLCD.escribirLCDEstado(dato); break;
            case GB_PANTALLA_REG_SCROLLY : this.regLCD.scrollY = dato; break;
            case GB_PANTALLA_REG_SCROLLX : this.regLCD.scrollX = dato; break;
            case GB_PANTALLA_REG_LY_COORD : this.regLCD.lineaY = dato; break;
            case GB_PANTALLA_REG_LYC_COMP : this.regLCD.lineaYComparar = dato; break;
            case GB_PANTALLA_REG_WX : this.regLCD.windowX = dato; break;
            case GB_PANTALLA_REG_WY : this.regLCD.windowY = dato; break;
            case GB_PALETA_REG_BG : this.regLCD.escribirPaletaBGVentana(dato); break;
            case GB_PALETA_REG_OBP0 : this.regLCD.escribirPaletaObj0(dato); break;
            case GB_PALETA_REG_OBP1 : this.regLCD.escribirPaletaObj1(dato); break;

            case GB_TEMPORIZADOR_REG_DIV : this.regInt.dIV = dato; break;
            case GB_INTERRUPCIONES_REG_IF : this.regInt.escribirIF(dato); break;
            case GB_TEMPORIZADOR_REG_TAC : this.regInt.escribirTAC(dato); break;
            case GB_TEMPORIZADOR_REG_TIMA : this.regInt.contador = 0; break;
            case GB_TEMPORIZADOR_REG_TMA : this.regInt.contadorModulo = dato; break;

            case GB_SONIDO_REG_NR52 : this.regAud.escribirAudioControlMaestro(dato); break;
            case GB_SONIDO_REG_NR51 : this.regAud.escribirAudioPanoramica(dato); break;
            case GB_SONIDO_REG_NR50 : this.regAud.escribirVolumenMaestro(dato); break;

            case GB_SONIDO_REG_NR10 : this.regCnl1.escribirBarrido(dato); break;
            case GB_SONIDO_REG_NR11 : this.regCnl1.escribirCicloYTemporizador(dato); break;
            case GB_SONIDO_REG_NR12 : this.regCnl1.escribirVolumenYEnvoltorio(dato); break;
            case GB_SONIDO_REG_NR13 : this.regCnl1.escribirPeriodoBajo(dato); break;
            case GB_SONIDO_REG_NR14 : this.regCnl1.escribirPeriodoAltoYControl(dato); break;

            case GB_SONIDO_REG_NR21 : this.regCnl2.escribirCicloYTemporizador(dato); break;
            case GB_SONIDO_REG_NR22 : this.regCnl2.escribirVolumenYEnvoltorio(dato); break;
            case GB_SONIDO_REG_NR23 : this.regCnl2.escribirPeriodoBajo(dato); break;
            case GB_SONIDO_REG_NR24 : this.regCnl2.escribirPeriodoAltoYControl(dato); break;
        }
        this.iOReg[indice - 0xFF00] = dato;
    }
    
    /**
     * Lee 16 bits (2 bytes) de la dirección de memoria indicada.
     * @param {*} indice Direccion de la que se quiere leer el dato.
     * @param {*} dato Dato que se quiere escribir.
     * @returns dato que se encuentra en la direccion.
     */
    leer16Bits(indice){
        if(indice == undefined){
            console.error("Error en intento de escritura undefined.")
            return 0;
        }
        if(indice < 0 && indice + 1 >= GB_TAMANO_MEMORIA){
            console.error("Lectura en indice fuera de los limites de memoria")
            return 0;
        }
        var byte_bajo = this.leer8Bits(indice);
        var byte_alto = this.leer8Bits(indice + 1);
        var resultado = (byte_alto << 8) | byte_bajo;
        if(this.mostrarLogs){
            this.memoriaStr += ("Lectura16 $" + 
                indice.toString(16) + " dato " + resultado.toString(16) + " ")
        }
        return resultado;
    }

    /**
     * Escribe 16 bits (2 bytes) en la dirección de memoria indicada.
     * @param {*} indice Indice en el que se quiere escribir el dato.
     * @param {*} dato Dato que se quiere escribir.
     * @returns 
     */
    escribir16Bits(indice, dato){
        if(indice < 0 && indice >= GB_TAMANO_MEMORIA){
            console.error("Escritura en indice fuera de los limites de memoria")
            return;
        }
        this.escribir8Bits(indice, dato & 0x00FF);
        this.escribir8Bits(indice + 1, (dato & 0xFF00) >> 8);
        return;
    }

}