// CPU de GameBoy
export class CPUDebug{
    constructor(){
        this.activo = false;
        // Para hacer debug
        this.instruccionStr = "";
        this.instruccionPC = ""
        this.codigoStr = ""
        this.registrosStr = ""
        this.registros16Str = ""
        this.flagsStr = ""

        this.breakpointsSet = new Set();

        this.pausasActivadas = true;
        this.pausado = false;
    }
}