// @ts-check
import { RegistrosAudio } from "../../memoria/registros/registros_audio.js";
import { RegistrosCanal1 } from "../../memoria/registros/registros_canal1.js";
import { RegistrosCanal2 } from "../../memoria/registros/registros_canal2.js";
import { RegistrosCanal3 } from "../../memoria/registros/registros_canal3.js";
import { RegistrosCanal4 } from "../../memoria/registros/registros_canal4.js";


class Canal1{
    /**
     * Constructor de Canal1
     * @param {RegistrosCanal1} registrosCanal1 Registros del canal 1
     */
    constructor(registrosCanal1){
        this.regs = registrosCanal1
    }
}

class Canal2{
    /**
     * Constructor de Canal2
     * @param {RegistrosCanal2} registrosCanal2 Registros del canal 2
     */
    constructor(registrosCanal2){
        this.regs = registrosCanal2
    }
}

class Canal3{
    /**
     * Constructor de Canal3
     * @param {RegistrosCanal3} registrosCanal3 Registros del canal 3
     */
    constructor(registrosCanal3){
        this.regs = registrosCanal3
    }
}

class Canal4{
    /**
     * Constructor de Canal4
     */
    constructor(){

    }
}

class Audio{
    /**
     * Constructor de Audio
     * @param {RegistrosAudio} registrosAudio 
     * @param {RegistrosCanal1} registrosCanal1 
     * @param {RegistrosCanal2} registrosCanal2 
     * @param {RegistrosCanal3} registrosCanal3 
     * @param {RegistrosCanal4} registrosCanal4 
     */
    constructor(registrosAudio, registrosCanal1, registrosCanal2, registrosCanal3, registrosCanal4){
        this.canal1 = new Canal1(registrosCanal1);
        this.canal2 = new Canal2(registrosCanal2);
        this.canal3 = new Canal3(registrosCanal3);
        this.canal4 = new Canal4();
        this.regs = registrosAudio;
    }
}

export { Audio };
