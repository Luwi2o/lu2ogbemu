// CPU de GameBoy

class CPUDebug{
    constructor(){
        // Para hacer debug
        this.instruccionStr = "";
        this.instruccionPC = ""
        this.codigoStr = ""
        this.registrosStr = ""
        this.registros16Str = ""
        this.flagsStr = ""

        this.breakpoints = [];

        this.pausasActivadas = true;
        this.pausado = false;
    }
}

class CPU{

    /**
     * 
     * @param {Memoria} memoria 
     * @param {Interrupciones} interrupciones 
     * @param {number} tipoConsola
     */
    constructor(memoria, interrupciones, tipoConsola, cPUDebug, estado){

        this.memoria = memoria;
        this.interrupciones = interrupciones;
        this.cPUDebug = cPUDebug;

        this.ciclos = 0;
        this.ciclosTimer = 0;
        this.halted = false;

        // ***Flags***
        // Existe un registro que contiene los flags, aqui se representaran como variables diferentes
        // El registro F tiene 4 bits en la parte superior los cuales son Z, N, H y C:

        // Z, "zero" es 1 cuando el resultado de una op matematica es 0 o cuando dos valores son iguales
        this.Z = 0;
        // N, "substract" es 1 cuando la anterior op matematica es una resta 
        this.N = 0;
        // H, "half carry" es 1 cuando ocurre un carry de la mitad inferior
        this.H = 0;
        // C, "carry" es 1 cuando ocurre un carry en la anterior operacion 
        // matematica o si el registro A es el menor valor cuando se
        // ejecuta una operacion de comparación
        this.C = 0;

        this.iME = 1;

        this.registros = new Registros(tipoConsola, estado);
        this.anteriorPC = this.registros.PC;

        if(estado){
            var s = estado.cpu

            this.ciclos = s.ciclos;
            this.ciclosTimer = s.ciclosTimer;
            this.halted = s.halted;
            this.iME = s.iME;
            this.Z = s.Z;
            this.N = s.N;
            this.H = s.H;
            this.C = s.C;
            this.actualizarFlag();

        } else {
            if(bootROM){
                this.iME = 0;
                this.Z = 0;
                this.N = 0;
                this.H = 0;
                this.C = 0;
                this.actualizarFlag();
            } else if(tipoConsola = BGB_DMG0){
                this.iME = 1;
                this.Z = 1;
                this.N = 0;
                this.H = 1;
                this.C = 1;
                this.actualizarFlag();
            }
        }

        
        /** LD reg, imm
         * Carga el immediato
         * @param {number} regd Registro destino
         * @returns 
         */
        this.ld_r_i_8b = function(regd){
            var imm = this.memoria.leer8Bits(this.registros.PC);
            this.registros.PC++;
            this.registros.R[regd] = imm;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("ld_r_i_8b " + this.nombreR(regd) + ", " + imm.toString(16));
            return;
        }

        /** LD reg, reg
         * Carga un registro en otro registro
         * @param {number} regd Registro de destino
         * @param {number} regs Registro de origen
         * @returns 
         */
        this.ld_r_r_8b = function(regd, regs){
            this.registros.R[regd] = this.registros.R[regs];
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("ld_r_r_8b " + this.nombreR(regd) + ", " + this.nombreR(regs));
            return;
            
        }

        /** LD reg, mem[reg, reg]
         * Carga en un registro un valor en memoria
         * @param {number} regd Registro de destino
         * @param {number} regmemh Registro en la que se encuentra la parte significativa
         * @param {number} regmeml Registro en la que se encuentra la parte menos significativa
         * @param {number} offset
         * @returns 
         */
        this.ld_r_mrr_8b = function(regd, regmemh, regmeml, offset){
            var dir = this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]);
            this.registros.R[regd] = this.memoria.leer8Bits(dir);
            if(offset != undefined){
                dir += offset
                this.registros.R[regmemh] = this.msb(dir)
                this.registros.R[regmeml] = this.lsb(dir)
                this.cPUDebug.instruccionStr = ("ld_r_mrr_8b " + this.nombreR(regd) + ", (" + this.nombreR(regmemh) + this.nombreR(regmeml) + offset +")");
            } else {
                this.cPUDebug.instruccionStr = ("ld_r_mrr_8b " + this.nombreR(regd) + ", (" + this.nombreR(regmemh) + this.nombreR(regmeml) +")");
            }
            this.ciclos = 8;
            return;
        }

        /** LD reg, mem(FF00 + [reg]).
         * Lee del n-puerto de IO. 
         * @param {number} regd Registro de destino
         * @param {number} regmem1 Registro 
         * @returns 
         */
        this.ld_r_mff00r_8b = function(regd, regmem){
            var i = 0xFF00 + this.registros.R[regmem];
            this.registros.R[regd] = this.memoria.leer8Bits(i);
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("ld_r_mff00r_8b " + this.nombreR(regd) +", (FF00+" + this.nombreR(regmem)+ ")")
            return;
        }

        /** LD mem(FF00 + [reg]), reg.
         * Escribe al n-puerto de IO.
         * @param {number} regd Registro de destino
         * @param {number} regmem1 Registro 
         * @returns 
         */
        this.ld_mff00r_r_8b = function(regmem, reg){
            var i = 0xFF00 + this.registros.R[regmem];
            this.memoria.escribir8Bits(i, this.registros.R[reg]);
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("ld_mff00r_r_8b (FF00+" + this.nombreR(regmem)+ "), " + this.nombreR(reg))
            return;
        }

        /** LD mem([regh], [regl]), reg.
         * Escribe en memoria el valor de un registro
         * @param {number} regmemh 
         * @param {number} regmeml 
         * @param {number} regs 
         * @returns 
         */
        this.ld_mrr_r_8b = function(regmemh, regmeml, regs, offset){
            var dir = this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]);
            this.memoria.escribir8Bits(dir, this.registros.R[regs]);
            if(offset != undefined){
                dir += offset
                this.registros.R[regmemh] = this.msb(dir);
                this.registros.R[regmeml] = this.lsb(dir);
                this.cPUDebug.instruccionStr = ("ld_mrr_r_8b (" + this.nombreR(regmemh) +  this.nombreR(regmeml) + offset + "), " + this.nombreR(regs))
            } else {
                this.cPUDebug.instruccionStr = ("ld_mrr_r_8b (" + this.nombreR(regmemh) +  this.nombreR(regmeml) + "), " + this.nombreR(regs))
            }
            this.ciclos = 8
            return;
        }

        /** LD reg, mem(immh, imml).
         * Lee de la direccion memoria almacenada en dos immediatos.
         * @param {*} regd Registro de destino.
         * @returns 
         */
        this.ld_r_mii_8b = function(regd){
            var dir = this.sinSigno16Bits(this.memoria.leer8Bits(this.registros.PC++), 
                this.memoria.leer8Bits(this.registros.PC++))
            this.registros.R[regd] = this.memoria.leer8Bits(dir);
            this.cPUDebug.instruccionStr = ("ld_r_mii_8b " + this.nombreR(regd) + ", ("+  dir.toString(16) + ")")
            this.ciclos = 16;
            return;
        }

        this.ld_r_mff00i_8b = function(regd){
            var imm = this.memoria.leer8Bits(this.registros.PC++);
            var dir = 0xFF00 + imm;
            this.registros.R[regd] = this.memoria.leer8Bits(dir);
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("ld_r_mff00i_8b " + this.nombreR(regd) +", (FF00 + " + imm.toString(16) + ")")
            return;
        }

        /** LD mem(immh, imml), reg.
         * Escribe en la direccion memoria almacenada en dos immediatos.
         * @param {*} regs Registro de origen.
         * @returns 
         */
        this.ld_mii_r_8b = function(regs){
            var dir = this.sinSigno16Bits(this.memoria.leer8Bits(this.registros.PC++), 
                this.memoria.leer8Bits(this.registros.PC++));
            this.memoria.escribir8Bits(dir, this.registros.R[regs]);
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("ld_mii_r_8b (" + dir.toString(16) + "), " + this.nombreR(regs));
            return;
        }

        /** LD mem(FF00 + imm), reg.
         * Escribe en la direccion memoria almacenada en las direcciones de puertos io.
         * @param {*} regs Registro de origen.
         * @returns 
         */
        this.ld_mff00i_r_8b = function(regs){
            var imm = this.memoria.leer8Bits(this.registros.PC++);
            var dir = 0xFF00 + imm;
            this.memoria.escribir8Bits(dir, this.registros.R[regs])
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("ld_mff00i_r_8b (0xFF00 + " + imm.toString(16) + "), " + this.nombreR(regs))
            return;
        }

        /** LD regh regl, immh imml.
         * Lee dos immediatos y lo mete en registros de 16 bits
         * @param {*} regh 
         * @param {*} regl 
         */
        this.ld_rr_ii_16b = function(regh, regl){
            var imml = this.memoria.leer8Bits(this.registros.PC++);
            var immh = this.memoria.leer8Bits(this.registros.PC++);
            this.registros.R[regl] = imml;
            this.registros.R[regh] = immh;
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("ld_rr_ii_16b " + this.nombreR(regh) + this.nombreR(regl) + ", " + (immh * 0x100 + imml).toString(16))
        }

        /** LD reghregl, reghregl.
         * Lee un registro de 16 bits en otro registro de 16 bits
         * @param {*} regd1 Registro H de origen
         * @param {*} regd2 Registro L de origen
         * @param {*} regs1 Registro H de destino
         * @param {*} regs2 Registro L de destino
         */
        this.ld_rr_rr_16b = function(regdh, regdl, regsh, regsl){
            this.registros.R[regdh] = this.registros.R[regsh];
            this.registros.R[regdl] = this.registros.R[regsl];
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("ld_rr_rr_16b " + this.nombreR(regdh) + this.nombreR(regdl) + ", " + this.nombreR(regsh) + this.nombreR(regsl))
        }

        /** LD SP, imm imm.
         *
         */
        this.ld_sp_ii_16b = function(){
            var dir = this.sinSigno16Bits(this.memoria.leer8Bits(this.registros.PC++),
                this.memoria.leer8Bits(this.registros.PC++));
            this.registros.SP = dir;
            this.ciclos = 20;
            this.cPUDebug.instruccionStr = ("ld_sp_ii_16b SP, " + dir.toString(16))
        }
        
        /** LD regh rehl, SP
         * 
         * @param {*} regh 
         * @param {*} regl 
         */
        this.ld_sp_rr_16b = function(regh, regl){
            this.registros.SP = this.sinSigno16Bits(this.registros.R[regl], this.registros.R[regh]);
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("ld_sp_rr_16b SP, " + this.nombreR(regh) + this.nombreR(regl))
        }

        /** LD HL, SP + e
         * 
         * @param {*} regh 
         * @param {*} regl 
         */
        this.ld_hl_sp_imm_16b = function(){
            var e = this.memoria.leer8Bits(this.registros.PC++)
            e = e << 24 >> 24;
            var spe = this.registros.SP + e
            this.C = 0; this.H = 0; this.N = 0; this.Z = 0;
            if((this.registros.SP & 0xFF) + (e & 0xFF) > 0xFF) this.C = 1;
            if((this.registros.SP & 0x0F) + (e & 0x0F) > 0x0F) this.H = 1;
            this.registros.R[H] = this.msb(spe);
            this.registros.R[L] = this.lsb(spe);
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("ld_hl_sp_imm_16b HL, SP + " + e)
        }

        //TODO BORRAR SI NO FAFFA
        /** LD regh regl, SP + imm
         * Lee
         * @param {*} reg1 
         * @param {*} reg2 
         */
        this.ldn_rr_sp_16b = function(regh, regl){
            var imm = this.memoria.leer8Bits(this.registros.PC);
            this.registros.PC++;
            var auxsp = SP + imm;
            this.registros.R[regh] = this.msb(auxsp);
            this.registros.R[regl] = this.lsb(auxsp);
            this.cPUDebug.instruccionStr = ("ldn_rr_sp_16b "+this.nombreR(regh)+this.nombreR(regl)+", SP + " + imm)
        }

        /** LD mem(imm imm), SP
         * Escribe el valor de SP en memoria
         */
        this.ld_mii_sp_16b = function(){
            var dir = this.sinSigno16Bits(this.memoria.leer8Bits(this.registros.PC++), 
                this.memoria.leer8Bits(this.registros.PC++));
            this.memoria.escribir16Bits(dir, this.registros.SP)
            this.ciclos = 20;
            this.cPUDebug.instruccionStr = ("ld_mii_sp_16b (" + dir + "), SP");
        }

        /** LD mem(regh regl), imm
         * Escribe immediato en memoria
         * @param {*} regh 
         * @param {*} regl 
         */
        this.ld_mrr_i_8b = function(regh, regl){
            var imm = this.memoria.leer8Bits(this.registros.PC++);
            var dir = this.sinSigno16Bits(this.registros.R[regl], this.registros.R[regh]);
            this.memoria.escribir8Bits(dir, imm);
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("ld_mrr_i_8b (" + this.nombreR(regh) + this.nombreR(regl) + ")");
        }

        
        /** PUSH regh regl
         * SP=SP-2 (SP)=rr
         * @param {*} regh 
         * @param {*} regl 
         * @returns 
         */
        this.push_rr_16b = function(regh, regl){
            this.registros.SP --;
            this.memoria.escribir8Bits(this.registros.SP-- , this.registros.R[regh]);
            this.memoria.escribir8Bits(this.registros.SP, this.registros.R[regl]);
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("push_rr_16b " + this.nombreR(regh) + this.nombreR(regl));
            return;
        }

        /** POP regh, regl.
         * rr=(SP) SP=SP+2
         * @param {*} regh 
         * @param {*} regl 
         * @returns 
         */
        this.pop_rr_16b = function(regh, regl){
            this.registros.R[regl] = this.memoria.leer8Bits(this.registros.SP++);
            this.registros.R[regh] = this.memoria.leer8Bits(this.registros.SP++);
            if(regl == F){
                this.Z = (this.registros.R[regl] & 0x80) >> 7;
                this.N = (this.registros.R[regl] & 0x40) >> 6;
                this.H = (this.registros.R[regl] & 0x20) >> 5;
                this.C = (this.registros.R[regl] & 0x10) >> 4;
                this.registros.R[regl] &= 0xF0
            }
            //TODO si es F se tiene que escribir las flags XD
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("pop_rr_16b " + this.nombreR(regh) + this.nombreR(regl));
            return;
        }

        /** ADD reg, reg
         * regd = regd + regds
         * @param {*} regd Registro de destino.
         * @param {*} regs Registro de origen.
         */
        this.add_r_r_8b = function(regd, regs){
            var res = this.registros.R[regd] + this.registros.R[regs];
            this.N = 0, this.Z = 0; this.H = 0; this.C = 0
            if(((this.registros.R[regd] & 0x0F) + (this.registros.R[regs] & 0x0F)) > 0x0F) this.H = 1;
            if(res > 0xFF) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("add_r_r_8b " + this.nombreR(regd) + ", " + this.nombreR(regs));
            return;
        }

        /** ADD reg, mem(reg reg)
         * regd = regd + regds
         * @param {*} regd Registro de destino.
         * @param {*} regs Registro de origen.
         */
        this.add_r_mrr_8b = function(regd, regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var res = this.registros.R[regd] + regfrommem;
            this.N = 0, this.Z = 0, this.H = 0, this.C = 0;
            if((this.registros.R[regd] & 0x0F) + (regfrommem & 0x0F) > 0x0F) this.H = 1;
            if(res > 0xFF) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = 
                ("add_r_mrr_8b " + this.nombreR(regd) + ", " 
                + this.nombreR(regmemh) + ", " + this.nombreR(regmeml));
            return;
        }

        /** ADD reg, imm
         * 
         * @param {*} regd 
         */
        this.add_r_i_8b = function(regd){
            var imm = this.memoria.leer8Bits(this.registros.PC);
            this.registros.PC++;
            var res = this.registros.R[regd] + imm;
            this.N = 0, this.Z = 0, this.H = 0, this.C = 0;
            if((this.registros.R[regd] & 0x0F) + (imm & 0x0F) > 0x0F) this.H = 1;
            if(res > 0xFF) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("add_r_i_8b");
        }

        /** ADC
         * Suma los dos numeros y el flag de carry
         * @param {*} regd 
         * @param {*} regs 
         */
        this.adc_r_r_8b = function(regd, regs){
            var res = this.registros.R[regd] + this.registros.R[regs] + this.C;
            var resH = (this.registros.R[regd] & 0x0F) + (this.registros.R[regs] & 0x0F) + this.C
            this.N = 0, this.Z = 0, this.H = 0, this.C = 0;
            if(resH > 0x0F) this.H = 1;
            if(res > 0xFF) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("adc_r_r_8b");
            return;
        }

        /** ADC regd, mem(regmemh regmeml)
         * 
         * @param {*} regd 
         * @param {*} regmemh 
         * @param {*} regmeml 
         * @returns 
         */
        this.adc_r_mrr_8b = function(regd, regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits( this.registros.R[regmeml], this.registros.R[regmemh]) );
            var res = this.registros.R[regd] + regfrommem + this.C;
            var resH = (this.registros.R[regd] & 0x0F) + (regfrommem & 0x0F) + this.C
            
            this.N = 0, this.Z = 0, this.H = 0, this.C = 0
            if(resH > 0x0F) this.H = 1;
            if(res > 0xFF) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("adc_r_mrr_8b");
            return;
            
        }

        /** ADC regd, imm
         * 
         * @param {*} regd 
         */
        this.adc_r_i_8b = function(regd){

            var imm = this.memoria.leer8Bits(this.registros.PC);
            this.registros.PC++;
            var res = this.registros.R[regd] + imm + this.C;
            var resH = (this.registros.R[regd] & 0x0F) + (imm & 0x0F) + this.C

            this.N = 0, this.Z = 0, this.H = 0, this.C = 0
            if(resH > 0x0F) this.H = 1;
            if(res > 0xFF) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("adc_r_i_8b");
            return;
        }

        /** SUB regd, regs
         * Resta los registros
         * @param {*} regd 
         * @param {*} regs 
         */
        this.sub_r_r_8b = function(regd, regs){
            var res = this.registros.R[regd] - this.registros.R[regs];
            var resH = (this.registros.R[regd] & 0x0F) - (this.registros.R[regs] & 0x0F)
            this.N = 1; this.Z = 0, this.H = 0, this.C = 0;
            if(resH < 0) this.H = 1;
            if(res < 0) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("sub_r_r_8b", this.nombreR(regd), " ", this.nombreR(regs));
        }

        /** SUB regd, mem(reg reg)
         * Resta el registro con la memoria
         * @param {*} regd 
         * @param {*} regs 
         */
        this.sub_r_mrr_8b = function(regd, regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(this.registros.R[regmemh] << 8 | this.registros.R[regmeml])
            var res = this.registros.R[regd] - regfrommem;
            var resH = (this.registros.R[regd] & 0x0F) - (regfrommem & 0x0F)
            this.N = 1; this.Z = 0, this.H = 0, this.C = 0;
            if(resH < 0) this.H = 1;
            if(res < 0) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("sub_r_mrr_8b", this.nombreR(regd), " (", 
            this.nombreR(regmemh), this.nombreR(regmeml), ")");
        }

        /** SUB reg, imm
         * Le resta al registro un immediato
         * @param {*} regd 
         */
        this.sub_r_i_8b = function(regd){
            var imm = this.memoria.leer8Bits(this.registros.PC)
            this.registros.PC++;
            var res = this.registros.R[regd] - imm;
            var resH = (this.registros.R[regd] & 0x0F) - (imm & 0x0F);
            this.N = 1, this.Z = 0, this.H = 0, this.C = 0;
            if(resH < 0) this.H = 1;
            if(res < 0) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("sub_r_i_8b " + this.nombreR(regd) + ", " + imm.toString(16));
            return; 
        }

        /** SBC reg, reg
         * 
         * @param {*} regd 
         * @param {*} regs 
         */
        this.sbc_r_r_8b = function(regd, regs){
            this.cPUDebug.instruccionStr = ("sbc_r_r_8b");
            var res  = this.registros.R[regd] - this.registros.R[regs] - this.C;
            var resH = (this.registros.R[regd] & 0x0F) - (this.registros.R[regs] & 0x0F) - this.C
            this.N = 1; this.Z = 0, this.H = 0, this.C = 0;
            if(resH < 0) this.H = 1;
            if(res < 0) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("sbc_r_r_8b " + this.nombreR(regd) + ", " + this.nombreR(regs));
            return
        }

        /** SBC reg, mem(reg reg)
         * 
         * @param {*} regd 
         * @param {*} regmem1 
         * @param {*} regmem2 
         */
        this.sbc_r_mrr_8b = function(regd, regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits( this.registros.R[regmeml], this.registros.R[regmemh]) );
            var res = this.registros.R[regd] - (regfrommem + this.C);
            var resH = (this.registros.R[regd] & 0x0F) - (regfrommem & 0x0F) - this.C
            this.N = 1; this.Z = 0, this.H = 0, this.C = 0;
            if(resH < 0) this.H = 1;
            if(res < 0) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("sbc_r_mrr_8b " + this.nombreR(regd) + " (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
            return;
        }

        /** SBC reg, imm
         * 
         * @param {*} regd 
         */
        this.sbc_r_i_8b = function(regd){
            var imm = this.memoria.leer8Bits(this.registros.PC);
            this.registros.PC++;
            var res = this.registros.R[regd] - (imm + this.C);
            var resH = (this.registros.R[regd] & 0x0F) - (imm & 0x0F) - this.C;
            this.N = 1; this.Z = 0, this.H = 0, this.C = 0;
            if(resH < 0) this.H = 1;
            if(res < 0) this.C = 1;
            this.registros.R[regd] = res;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("sbc_reg8_imm_8b");
        }

        /** AND reg
         * Hace and con el registro A y lo pone en A
         * @param {*} regs 
         */
        this.and_r_8b = function(regs){
            this.cPUDebug.instruccionStr = ("and_r_8b");
            var res = this.registros.R[A] & this.registros.R[regs];
            this.registros.R[A] = res;
            this.N = 0; this.Z = 0, this.H = 1, this.C = 0;
            if((res & 0xFF) == 0) this.Z = 1;
            this.ciclos = 4;
            return;
        }

        /** AND mem(reg reg)
         * Hace and con el registro A y lo pone en A
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.and_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var res = this.registros.R[A] & regfrommem;
            this.registros.R[A] = res;
            this.N = 0; this.Z = 0, this.H = 1, this.C = 0;
            if((res & 0xFF) == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("and_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
        }

        /** AND imm
         * Hace and con el registro A y lo pone en A
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.and_i_8b = function(){
            var imm = this.memoria.leer8Bits(this.registros.PC);
            this.registros.PC++;
            var res = this.registros.R[A] & imm;
            this.registros.R[A] = res;
            this.N = 0; this.Z = 0, this.H = 1, this.C = 0;
            if((res & 0xFF) == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("and_imm_8b " + imm.toString(16));
        }
        
        /** OR reg
         * Hace la operacion binaria or con el registro A y otro registro y pone el resultado en A
         * @param {*} regs 
         */
        this.or_r_8b = function(regs){
            var res = this.registros.R[A] | this.registros.R[regs];
            this.registros.R[A] = res
            this.N = 0; this.Z = 0, this.H = 0, this.C = 0;
            if((res & 0xFF) == 0) this.Z = 1;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("or_reg8_8b " + this.nombreR(regs));
            return;
        }

        /** OR mem(reg reg)
         * Hace la operacion binaria or con el registro A y otro registro y pone el resultado en A
         * @param {*} regs 
         */
        this.or_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits( this.registros.R[regmeml], this.registros.R[regmemh] ));
            var res = this.registros.R[A] | regfrommem;
            this.registros.R[A] = res;
            this.N = 0; this.Z = 0, this.H = 0, this.C = 0;
            if((res & 0xFF) == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("or_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
            return;
        }

        /** OR imm
         * Hace la operacion binaria or con el registro A y un immediato y pone el resultado en A
         * @param {*} regs 
         */
        this.or_i_8b = function(){
            var imm = this.memoria.leer8Bits(this.registros.PC)
            this.registros.PC++;
            var res = this.registros.R[A] | imm;
            this.registros.R[A] = res;
            this.N = 0; this.Z = 0, this.H = 0, this.C = 0;
            if((res & 0xFF) == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("or_imm_8b " + imm.toString(16));
        }

        /** XOR reg
         * 
         * @param {*} regs 
         */
        this.xor_r_8b = function(regs){
            var res = this.registros.R[A] ^ this.registros.R[regs];
            this.registros.R[A] = res;
            this.N = 0; this.Z = 0; this.H = 0; this.C = 0;
            if((res & 0xFF) == 0) this.Z = 1;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("xor_r_8b " + this.nombreR(regs));
            return;
        }

        /** XOR mem(reg reg)
         * 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.xor_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var res = this.registros.R[A] ^ regfrommem;
            this.registros.R[A] = res;
            this.N = 0; this.Z = 0; this.H = 0; this.C = 0;
            if((res & 0xFF) == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("xor_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
            return;
        }

        /** XOR imm
         * 
         */
        this.xor_i_8b = function(){
            var imm = this.memoria.leer8Bits(this.registros.PC);
            this.registros.PC++;
            var res = this.registros.R[A] ^ imm;
            this.registros.R[A] = res;
            this.N = 0; this.Z = 0; this.H = 0; this.C = 0;
            if((res & 0xFF) == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("xor_i_8b " + imm.toString(16));
            return;
        }

        /** CP reg
         * Compara el contenido del operando s y el registro A y activa las flags si son iguales
         * @param {*} regs 
         */
        this.cp_r_8b = function(regs){
            var res = this.registros.R[A] - this.registros.R[regs];
            this.Z = 0, this.H = 0, this.C = 0, this.N = 1;
            if((res & 0xFF) == 0) this.Z = 1;
            if(((this.registros.R[A] & 0x0F) - (this.registros.R[regs] & 0x0F)) < 0) this.H = 1;
            if(res < 0) this.C = 1;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("cp_r_8b " + regs);
            return;
        }

        /** CP mem(reg reg)
         * Compara el contenido del operando s y el registro A y activa las flags si son iguales
         * @param {*} regmeml 
         * @param {*} regmemh
         */
        this.cp_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var res = this.registros.R[A] - regfrommem;
            this.Z = 0, this.H = 0, this.C = 0, this.N = 1;
            if((res & 0xFF) == 0) this.Z = 1;
            if(((this.registros.R[A] & 0x0F) - (regfrommem & 0x0F)) < 0) this.H = 1;
            if(res < 0) this.C = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("cp_mrr_8b (" + regmemh + regmeml + ")");
            return;
        }

        /** CP imm
         * 
         */
        this.cp_i_8b = function(){
            var imm = this.memoria.leer8Bits(this.registros.PC);
            this.registros.PC++;
            var res = this.registros.R[A] - imm;
            this.Z = 0, this.H = 0, this.C = 0, this.N = 1;
            if((res & 0xFF) == 0) this.Z = 1;
            if(((this.registros.R[A] & 0x0F) - (imm & 0x0F)) < 0) this.H = 1;
            if(res < 0) this.C = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("cp_imm_8b " + imm);
            return;
        }

        /** INC reg
         * Incrementa por 1 el contenido del registro
         * @param {*} regd 
         */
        this.inc_r_8b = function(regd){
            this.cPUDebug.instruccionStr = ("inc_r_8b");
            var res = this.registros.R[regd] + 1;
            var resH = ((this.registros.R[regd] & 0x0F) + 1)
            this.registros.R[regd] = res;
            this.Z = 0, this.H = 0, this.N = 0;
            if(this.registros.R[regd] == 0) this.Z = 1;
            if(resH > 0x0F) this.H = 1;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("inc_r_8b " + this.nombreR(regd) );
            return;
        }

        /** INC mem(reg reg)
         * Incrementa por 1 el contenido del registro
         * @param {*} regd 
         */
        this.inc_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var res = (regfrommem + 1) & 0xFF;
            var resH = ((regfrommem & 0x0F) + 1)
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.Z = 0, this.H = 0, this.N = 0;
            if((res & 0xFF) == 0) this.Z = 1;
            if(resH > 0x0F) this.H = 1;
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("inc_mrr_8b (" + regmemh + regmeml + ")");
            return;
        }

        /** DEC reg
         * 
         * @param {*} regd 
         */
        this.dec_r_8b = function(regd){
            var res = this.registros.R[regd] - 1;
            var resH = ((this.registros.R[regd] & 0x0F) - 1)
            this.registros.R[regd] = res;
            this.Z = 0, this.H = 0, this.N = 1;
            if(res == 0) this.Z = 1;
            if(resH < 0) this.H = 1;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("dec_r_8b " + this.nombreR(regd));
            return;
        }

        /** DEC rr
         * 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.dec_mrr_8b = function(regmemh, regmeml){
            this.cPUDebug.instruccionStr = ("dec_mrr_8b");
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var res = regfrommem - 1;
            var resH = (regfrommem & 0x0F) - 1;
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.Z = 0, this.H = 0, this.N = 1;
            if(res == 0) this.Z = 1;
            if(resH < 0) this.H = 1;
            this.ciclos = 12;
        }

        // *** 16BIT ADD */
        /** ADD rr, rr
         * 
         * @param {*} reghd 
         * @param {*} regld 
         * @param {*} reghs 
         * @param {*} regls 
         */
        this.add_rr_rr_16b = function(reghd, regld, reghs, regls){
            var regd = this.registros.leer16Bits(reghd, regld);
            var regs = this.registros.leer16Bits(reghs, regls);
            var res = regd + regs;
            var resH = ((regd & 0x0FFF) + (regs & 0x0FFF));
            this.registros.escribir16Bits(reghd, regld, res);
            this.H = 0, this.C = 0, this.N = 0;
            if(resH > 0x0FFF) this.H = 1;
            if(res > 0xFFFF) this.C = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = 
                ("add_rr_rr_16b " + this.nombreR(reghd) + this.nombreR(regld) + ", " 
                + this.nombreR(reghs) + this.nombreR(regls) )
        }

        // *** 16BIT ADD */
        /** ADD rr, SP
         * 
         * @param {*} reghd 
         * @param {*} regld 
         */
        this.add_rr_sp_16b = function(reghd, regld){
            var regd = this.registros.leer16Bits(reghd, regld);
            var regs = this.registros.SP;
            var res = regd + regs;
            var resH = ((regd & 0x0FFF) + (regs & 0x0FFF));
            this.registros.escribir16Bits(reghd, regld, res);
            this.H = 0, this.C = 0, this.N = 0;
            if(resH > 0x0FFF) this.H = 1;
            if(res > 0xFFFF) this.C = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("add_rr_sp_16b " + this.nombreR(reghd) + this.nombreR(regld) + " SP")
            return;
        }

        // *** 16BIT ADD */
        /** ADD SP, imm
         * Anade el contenido de un immediato de 8 bits a SP y guarda el resultado en SP
         */
        this.add_sp_i_16b = function(){
            var sp = this.registros.SP;
            var e = this.memoria.leer8Bits(this.registros.PC++);
            e = e << 24 >> 24;
            this.registros.SP = (sp + e) & 0xFFFF;
            this.H = 0, this.C = 0, this.N = 0, this.Z = 0;
            if((sp & 0x0F) + (e & 0x0F) > 0x0F) this.H = 1;
            if((sp & 0xFF) + (e & 0xFF) > 0xFF) this.C = 1;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("add_rr_sp_16b SP " + e)
            return
        }

        // *** 16BIT INC */
        /** INC rr
         * 
         * @param {*} reghd 
         * @param {*} regld 
         * @returns 
         */
        this.inc_rr_16b = function(reghd, regld){
            var regd = this.registros.leer16Bits(reghd, regld)
            var res = (regd + 1) & 0xFFFF;
            this.registros.escribir16Bits(reghd, regld, res);
            this.cPUDebug.instruccionStr = ("inc_rr_16b " + this.nombreR(reghd) + this.nombreR(regld));
            this.ciclos = 8;
            return;
        }

        /** INC SP
         * 
         * @returns 
         */
        this.inc_sp_16b = function(){
            this.registros.SP = (this.registros.SP + 1) & 0xFFFF
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("inc_sp_16b")
            return;
        }

        /** DEC rr
         * 
         * @param {*} reghd 
         * @param {*} regld 
         * @returns 
         */
        this.dec_rr_16b = function(reghd, regld){
            var regd = this.registros.leer16Bits(reghd, regld)
            var res = regd - 1;
            this.registros.escribir16Bits(reghd, regld, res);
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("dec_rr_16b (" + this.nombreR(reghd) + this.nombreR(regld) + ")");
            return;
        }

        /** DEC SP
         * 
         * @returns 
         */
        this.dec_sp_16b = function(){
            this.registros.SP = (this.registros.SP - 1) & 0xFFFF;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("dec_sp_16b");
            return;
        }

        /** SWAP reg
         * Cambia los 4 primeros bits de orden bajo con los 4 ultimos bits de orden alto del registro
         * @param {*} regd 
         */
        this.swap_r_8b = function(regd){
            var res = (((this.registros.R[regd] & 0x0F) << 4) + ((this.registros.R[regd] & 0xF0) >> 4 ));
            this.registros.R[regd] = res;
            this.H = 0, this.C = 0, this.N = 0, this.Z = 0;
            if(res == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("swap_r_8b " + this.nombreR(regd));
            return;
        }

        /** SWAP mem(reg reg)
         * Cambia los 4 primeros bits de orden bajo con los 4 ultimos bits de orden alto del registro
         * @param {*} regd 
         */
        this.swap_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var res = (((regfrommem & 0x0F) << 4) + ((regfrommem & 0xF0) >> 4));
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.H = 0, this.C = 0, this.N = 0, this.Z = 0;
            if(res == 0) this.Z = 1;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("swap_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
            return;
        }

        /** DAA
         * 
         */
        this.daa_8b = function(){
            var rA = new Uint8Array(1);
            rA[0] = this.registros.R[A];
            // Simplemente funciona
            if(!this.N)
            {
                if(this.C || rA[0] > 0x99){
                    rA[0] += 0x60;
                    this.C = 1;
                }
                if(this.H || (rA[0] & 0x0F) > 0x09)
                    rA[0] += 0x6;
            }
            else
            {
                if(this.C)
                    rA[0] = rA[0] - 0x60;
                if(this.H)
                    rA[0] = rA[0] - 0x6;
            }
            this.H = 0;
            if(rA[0] == 0) this.Z = 1;
            else this.Z = 0;

            
            this.registros.R[A] = rA[0];
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("daa_8b");
            return;
        }

        /** CPL
         * Complementario del registro
         * @param {*} regd 
         */
        this.cpl_8b = function(regd){
            this.cPUDebug.instruccionStr = ("cpl_8b");
            this.registros.R[regd] = ~this.registros.R[regd];
            this.N = 1, this.H = 1;
            this.ciclos = 4;
            return;
        }

        /** CCF
         * Cambia el Flag CY
         */
        this.ccf_8b = function(){
            this.cPUDebug.instruccionStr = ("ccf_8b");
            this.H = 0; this.N = 0;
            if(this.C == 1) this.C = 0;
            else this.C = 1;
            this.ciclos = 4;
            return;
        }

        /** SCF
         * Pone el Flag CY a 1
         */
        this.scf_8b = function(){
            this.H = 0; this.N = 0;
            this.C = 1;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("scf_8b");
            return;
        }

        // TODO
        /** NOP
         * 
         * @returns 
         */
        this.nop = function(){
            this.ciclos = 4
            this.cPUDebug.instruccionStr = ("nop");
            return;
        }

        // TODO
        /** HALT
         * 
         * @returns 
         */
        this.halt = function(){
            this.ciclos = 4;
            this.halted = true;
            this.cPUDebug.instruccionStr = ("halt");
            return;
        }

        // TODO
        /** STOP
         * 
         * @returns 
         */
        this.stop = function(){
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("stop");
            return;
        }

        /** DI
         * Deshabilita las interrupciones pero no inmediatamente
         * Las interrupciones son deshabilitadas despues de que sea ejecutado
         * @returns 
         */
        this.di = function(){
            this.ciclos = 4;
            this.iME = 0;
            //console.log("di");
            this.cPUDebug.instruccionStr = ("di");
            return;
        }

        /** EI
         * Habilita las interrupciones pero no inmediatamente
         * Las interrupciones son habilitadas despues de que sea ejecutado
         * @returns 
         */
        this.ei = function(){
            this.ciclos = 4;
            this.iME = 1;
            //console.log("ei");
            this.cPUDebug.instruccionStr = ("ei");
            return;
        }

        /** RLCA
         * 
         */
        this.rlca_8b = function(){
            var bit7 = (this.registros.R[A] & 0x80) >> 7;
            var res = ( this.registros.R[A] << 1 ) + bit7;
            this.registros.R[A] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit7;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("rlca_8b");
            return;
        }

        /** RLA
         * 
         * @returns 
         */
        this.rla_8b = function(){
            var bit7 = (this.registros.R[A] & 0x80) >> 7;
            var res = (( this.registros.R[A] << 1 ) & 0xFE) + this.C;
            this.registros.R[A] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit7;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("rla_8b");
            return;
        }

        /** RRCA
         * 
         * @returns 
         */
        this.rrca_8b = function(){
            var bit0 = (this.registros.R[A] & 0x01);
            var res = (bit0 << 7) + (this.registros.R[A] >> 1 );
            this.registros.R[A] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit0;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("rrca_8b");
            return;
        }

        /** RRA
         * 
         */
        this.rra_8b = function(){
            var bit0 = (this.registros.R[A] & 0x01);
            var res = (this.C << 7) + (this.registros.R[A] >> 1 );
            this.registros.R[A] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit0;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("rra_8b");
        }

        /** RLC reg
         * 
         * @param {*} regd 
         * @returns 
         */
        this.rlc_r_8b = function(regd){
            var bit7 = (this.registros.R[regd] & 0x80) >> 7;
            var res = ( this.registros.R[regd] << 1 ) + bit7;
            this.registros.R[regd] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit7;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("rlc_r_8b " + this.nombreR(regd));
            return;
        }

        /** RLC mem(reg reg)
         * 
         * @param {*} regmemh 
         * @param {*} regmem2 
         */
        this.rlc_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var bit7 = (regfrommem & 0x80) >> 7;
            var res = ((regfrommem << 1) + bit7) & 0xFF;
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit7;
            if(res == 0) this.Z = 1;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("rlc_mrr_8b (" + this.nombreR(regmemh), this.nombreR(regmeml) + ")");
        }

        /** RL reg
         * 
         * @param {*} regd 
         * @returns 
         */
        this.rl_r_8b = function(regd){
            var bit7 = (this.registros.R[regd] & 0x80) >> 7;
            var res = ( this.registros.R[regd] << 1 ) + this.C;
            this.registros.R[regd] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit7;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.cPUDebug.instruccionStr = ("rl_r_8b " + this.nombreR(regd));
            this.ciclos = 8;
            return;
        }

        /** RL mem(reg reg)
         * 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.rl_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var bit7 = (regfrommem & 0x80) >> 7;
            var res = ((regfrommem << 1) + this.C) & 0xFF;
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit7;
            if(res == 0) this.Z = 1;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("rl_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
        }

        /** RRC reg
         * 
         * @param {*} regd 
         * @returns 
         */
        this.rrc_r_8b = function(regd){
            var bit0 = (this.registros.R[regd] & 0x01);
            var res = (bit0 << 7) + (this.registros.R[regd] >> 1 );
            this.registros.R[regd] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit0;
            if(res == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("rrc_r_8b " + this.nombreR(regd));
            return;
        }

        /** RRC mem(reg, reg)
         * 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.rrc_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var bit0 = (regfrommem & 0x01);
            var res = ((bit0 << 7) + (regfrommem >> 1)) & 0xFF;
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit0;
            if(res == 0) this.Z = 1;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("rrc_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
        }

        /** RR reg 
         * 
         * @param {*} regd 
         */
        this.rr_r_8b = function(regd){
            var bit0 = (this.registros.R[regd] & 0x01);
            var res = (this.C << 7) + (this.registros.R[regd] >> 1 );
            this.registros.R[regd] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit0;
            if(res == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("rr_r_8b " + this.nombreR(regd));
            return;
        }

        /** RR mem(reg reg)
         * 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.rr_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var bit0 = (regfrommem & 0x01);
            var res = ((this.C << 7) + (regfrommem >> 1)) & 0xFF;
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit0;
            if(res == 0) this.Z = 1;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("rr_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
            return;
        }

        /** SLA reg
         * 
         * @param {*} regd 
         */
        this.sla_r_8b = function(regd){
            var bit7 = (this.registros.R[regd] & 0x80) >> 7;
            var res = this.registros.R[regd] << 1;
            this.registros.R[regd] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit7;
            if(this.registros.R[regd] == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("sla_8b "+ this.nombreR(regd));
            return;
        }

        /** SLA mem(reg reg)
         * 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.sla_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var bit7 = (regfrommem & 0x80) >> 7;
            var res = (regfrommem << 1) & 0xFF;
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit7;
            if(res == 0) this.Z = 1;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("sla_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
        }

        /** SRA reg
         * 
         * @param {*} regd 
         * @returns 
         */
        this.sra_r_8b = function(regd){
            var bit0 = (this.registros.R[regd] & 0x01);
            var bit7 = (this.registros.R[regd] & 0x80);
            var res = (this.registros.R[regd] >> 1 ) + bit7;
            this.registros.R[regd] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit0;
            if(res == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("sra_r_8b " + this.nombreR(regd));
            return;
        }

        /** SRA mem(reg reg)
         * 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.sra_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var bit0 = (regfrommem & 0x01);
            var bit7 = (regfrommem & 0x80);
            var res = ((regfrommem >> 1) + bit7)& 0xFF;
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit0;
            if(res == 0) this.Z = 1;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("sra_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
        }

        /** SRL reg
         * 
         * @param {*} regd 
         */
        this.srl_r_8b = function(regd){
            var bit0 = (this.registros.R[regd] & 0x01);
            var res = (this.registros.R[regd] >> 1);
            this.registros.R[regd] = res;
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit0;
            if(res == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("srl_r_8b " + this.nombreR(regd));
            return;
        }

        /** SRL mem(reg reg)
         * 
         * @param {*} regmeml 
         * @param {*} regmemh 
         */
        this.srl_mrr_8b = function(regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var bit0 = (regfrommem & 0x01);
            var res = (regfrommem >> 1) & 0xFF;
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.Z = 0, this.H = 0, this.N = 0, this.C = bit0;
            if(res == 0) this.Z = 1;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("srl_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
        }

        /** BIT nbit reg
         * 
         * @param {*} nbit 
         * @param {*} nreg 
         */
        this.bit = function(nbit, nreg){
            switch(nreg){
                case 6:
                    this.bit_nbit_mrr_b8(nbit, H, L);
                    break;
                default:
                    this.bit_nbit_r_b8(nbit, nreg);
            }
        }

        /** Complemento del bit n del registro
         * 
         * @param {*} nbit 
         * @param {*} regd 
         */
        this.bit_nbit_r_b8 = function(nbit, regd){
            var res = ( this.registros.R[regd] >> nbit ) & 0x01;
            this.Z = 0;
            this.H = 1, this.N = 0;
            if(res == 0) this.Z = 1;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("bit_nbit_r_b8" + nbit + " " + this.nombreR(regd));
        }

        /** Complemento del bit n de memoria
         * 
         * @param {*} nbit 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.bit_nbit_mrr_b8 = function(nbit, regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var res = (regfrommem >> nbit) & 0x01;
            this.Z = 0;
            this.H = 1, this.N = 0;
            if(res == 0) this.Z = 1;
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = 
            ("bit_nbit_mrr_b8 " + nbit + " (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
        }

        //*** SET
        this.set = function(nbit, nreg){
            switch(nreg){
                case 6:
                    this.set_nbit_mrr_b8(nbit, H, L);
                    break;
                default:
                    this.set_nbit_r_b8(nbit, nreg);
                    break;
            }
        }

        /** SET nbit reg
         * 
         * @param {*} nbit 
         * @param {*} regd 
         */
        this.set_nbit_r_b8 = function(nbit, regd){
            var res = ( 0x01 << (nbit) ) | this.registros.R[regd];
            this.registros.R[regd] = res;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("set_nbit_r_b8" + nbit + " " + this.nombreR(regd));
        }

        /** SET nbit, mem(reg reg)
         * 
         * @param {*} nbit 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.set_nbit_mrr_b8 = function(nbit, regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var res = ( 0x01 << nbit) | regfrommem;
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = 
                ("set_nbit_mrr_b8" + nbit + " (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
        }

        /** RES nbit, reg
         * 
         * @param {*} nbit 
         * @param {*} regd 
         */
        this.res_nbit_r_b8 = function(nbit, regd){
            this.cPUDebug.instruccionStr = ("res_nbit_r_b8");
            var res = (0xFF - ( 0x01 << nbit)) & this.registros.R[regd];
            this.registros.R[regd] = res;
            this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("res_nbit_r_b8" + nbit + " " + this.nombreR(regd));
            return;
        }

        /** RES nbit, mem(reg reg)
         * 
         * @param {*} nbit 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.res_nbit_mrr_b8 = function(nbit, regmemh, regmeml){
            var regfrommem = this.memoria.leer8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]));
            var res = (0xFF - ( 0x01 << nbit)) & regfrommem;
            this.memoria.escribir8Bits(
                this.sinSigno16Bits(this.registros.R[regmeml], this.registros.R[regmemh]), res);
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = 
                ("res_nbit_mrr_b8" + nbit + " (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
            return;
        }

        /** RES
         * 
         * @param {*} nbit 
         * @param {*} nreg 
         * @returns 
         */
        this.res_8b = function(nbit, nreg){
            switch(nreg){
                case 6:
                    this.res_nbit_mrr_b8(nbit, H, L);
                    break;
                default:
                    this.res_nbit_r_b8(nbit, nreg);
                    break;
            }
            return;
        }

        //** CB */
        this.cb = function(){
            var opcode2 = this.memoria.leer8Bits(this.registros.PC);
            this.registros.PC ++;
            switch(opcode2){

                case 0x00: this.rlc_r_8b(B); break;
                case 0x01: this.rlc_r_8b(C); break;
                case 0x02: this.rlc_r_8b(D); break;
                case 0x03: this.rlc_r_8b(E); break;
                case 0x04: this.rlc_r_8b(H); break;
                case 0x05: this.rlc_r_8b(L); break;
                case 0x06: this.rlc_mrr_8b(H, L); break;
                case 0x07: this.rlc_r_8b(A); break;
                case 0x08: this.rrc_r_8b(B); break;
                case 0x09: this.rrc_r_8b(C); break;
                case 0x0A: this.rrc_r_8b(D); break;
                case 0x0B: this.rrc_r_8b(E); break;
                case 0x0C: this.rrc_r_8b(H); break;
                case 0x0D: this.rrc_r_8b(L); break;
                case 0x0E: this.rrc_mrr_8b(H, L); break;
                case 0x0F: this.rrc_r_8b(A); break;

                case 0x10: this.rl_r_8b(B); break;
                case 0x11: this.rl_r_8b(C); break;
                case 0x12: this.rl_r_8b(D); break;
                case 0x13: this.rl_r_8b(E); break;
                case 0x14: this.rl_r_8b(H); break;
                case 0x15: this.rl_r_8b(L); break;
                case 0x16: this.rl_mrr_8b(H, L); break;
                case 0x17: this.rl_r_8b(A); break;
                case 0x18: this.rr_r_8b(B); break;
                case 0x19: this.rr_r_8b(C); break;
                case 0x1A: this.rr_r_8b(D); break;
                case 0x1B: this.rr_r_8b(E); break;
                case 0x1C: this.rr_r_8b(H); break;
                case 0x1D: this.rr_r_8b(L); break;
                case 0x1E: this.rr_mrr_8b(H, L); break;
                case 0x1F: this.rr_r_8b(A); break;

                case 0x20: this.sla_r_8b(B); break;
                case 0x21: this.sla_r_8b(C); break;
                case 0x22: this.sla_r_8b(D); break;
                case 0x23: this.sla_r_8b(E); break;
                case 0x24: this.sla_r_8b(H); break;
                case 0x25: this.sla_r_8b(L); break;
                case 0x26: this.sla_mrr_8b(H, L); break;
                case 0x27: this.sla_r_8b(A); break;
                case 0x28: this.sra_r_8b(B); break;
                case 0x29: this.sra_r_8b(C); break;
                case 0x2A: this.sra_r_8b(D); break;
                case 0x2B: this.sra_r_8b(E); break;
                case 0x2C: this.sra_r_8b(H); break;
                case 0x2D: this.sra_r_8b(L); break;
                case 0x2E: this.sra_mrr_8b(H, L); break;
                case 0x2F: this.sra_r_8b(A); break;

                case 0x30: this.swap_r_8b(B); break;
                case 0x31: this.swap_r_8b(C); break;
                case 0x32: this.swap_r_8b(D); break;
                case 0x33: this.swap_r_8b(E); break;
                case 0x34: this.swap_r_8b(H); break;
                case 0x35: this.swap_r_8b(L); break;
                case 0x36: this.swap_mrr_8b(H, L); break;
                case 0x37: this.swap_r_8b(A); break;
                case 0x38: this.srl_r_8b(B); break;
                case 0x39: this.srl_r_8b(C); break;
                case 0x3A: this.srl_r_8b(D); break;
                case 0x3B: this.srl_r_8b(E); break;
                case 0x3C: this.srl_r_8b(H); break;
                case 0x3D: this.srl_r_8b(L); break;
                case 0x3E: this.srl_mrr_8b(H, L); break;
                case 0x3F: this.srl_r_8b(A); break;

                case 0x40: this.bit_nbit_r_b8(0, B); break;
                case 0x41: this.bit_nbit_r_b8(0, C); break;
                case 0x42: this.bit_nbit_r_b8(0, D); break;
                case 0x43: this.bit_nbit_r_b8(0, E); break;
                case 0x44: this.bit_nbit_r_b8(0, H); break;
                case 0x45: this.bit_nbit_r_b8(0, L); break;
                case 0x46: this.bit_nbit_mrr_b8(0, H, L); break;
                case 0x47: this.bit_nbit_r_b8(0, A); break;
                case 0x48: this.bit_nbit_r_b8(1, B); break;
                case 0x49: this.bit_nbit_r_b8(1, C); break;
                case 0x4A: this.bit_nbit_r_b8(1, D); break;
                case 0x4B: this.bit_nbit_r_b8(1, E); break;
                case 0x4C: this.bit_nbit_r_b8(1, H); break;
                case 0x4D: this.bit_nbit_r_b8(1, L); break;
                case 0x4E: this.bit_nbit_mrr_b8(1, H, L); break;
                case 0x4F: this.bit_nbit_r_b8(1, A); break;

                case 0x50: this.bit_nbit_r_b8(2, B); break;
                case 0x51: this.bit_nbit_r_b8(2, C); break;
                case 0x52: this.bit_nbit_r_b8(2, D); break;
                case 0x53: this.bit_nbit_r_b8(2, E); break;
                case 0x54: this.bit_nbit_r_b8(2, H); break;
                case 0x55: this.bit_nbit_r_b8(2, L); break;
                case 0x56: this.bit_nbit_mrr_b8(2, H, L); break;
                case 0x57: this.bit_nbit_r_b8(2, A); break;
                case 0x58: this.bit_nbit_r_b8(3, B); break;
                case 0x59: this.bit_nbit_r_b8(3, C); break;
                case 0x5A: this.bit_nbit_r_b8(3, D); break;
                case 0x5B: this.bit_nbit_r_b8(3, E); break;
                case 0x5C: this.bit_nbit_r_b8(3, H); break;
                case 0x5D: this.bit_nbit_r_b8(3, L); break;
                case 0x5E: this.bit_nbit_mrr_b8(3, H, L); break;
                case 0x5F: this.bit_nbit_r_b8(3, A); break;
                
                case 0x60: this.bit_nbit_r_b8(4, B); break;
                case 0x61: this.bit_nbit_r_b8(4, C); break;
                case 0x62: this.bit_nbit_r_b8(4, D); break;
                case 0x63: this.bit_nbit_r_b8(4, E); break;
                case 0x64: this.bit_nbit_r_b8(4, H); break;
                case 0x65: this.bit_nbit_r_b8(4, L); break;
                case 0x66: this.bit_nbit_mrr_b8(4, H, L); break;
                case 0x67: this.bit_nbit_r_b8(4, A); break;
                case 0x68: this.bit_nbit_r_b8(5, B); break;
                case 0x69: this.bit_nbit_r_b8(5, C); break;
                case 0x6A: this.bit_nbit_r_b8(5, D); break;
                case 0x6B: this.bit_nbit_r_b8(5, E); break;
                case 0x6C: this.bit_nbit_r_b8(5, H); break;
                case 0x6D: this.bit_nbit_r_b8(5, L); break;
                case 0x6E: this.bit_nbit_mrr_b8(5, H, L); break;
                case 0x6F: this.bit_nbit_r_b8(5, A); break;

                case 0x70: this.bit_nbit_r_b8(6, B); break;
                case 0x71: this.bit_nbit_r_b8(6, C); break;
                case 0x72: this.bit_nbit_r_b8(6, D); break;
                case 0x73: this.bit_nbit_r_b8(6, E); break;
                case 0x74: this.bit_nbit_r_b8(6, H); break;
                case 0x75: this.bit_nbit_r_b8(6, L); break;
                case 0x76: this.bit_nbit_mrr_b8(6, H, L); break;
                case 0x77: this.bit_nbit_r_b8(6, A); break;
                case 0x78: this.bit_nbit_r_b8(7, B); break;
                case 0x79: this.bit_nbit_r_b8(7, C); break;
                case 0x7A: this.bit_nbit_r_b8(7, D); break;
                case 0x7B: this.bit_nbit_r_b8(7, E); break;
                case 0x7C: this.bit_nbit_r_b8(7, H); break;
                case 0x7D: this.bit_nbit_r_b8(7, L); break;
                case 0x7E: this.bit_nbit_mrr_b8(7, H, L); break;
                case 0x7F: this.bit_nbit_r_b8(7, A); break;

                case 0x80: this.res_nbit_r_b8(0, B); break;
                case 0x81: this.res_nbit_r_b8(0, C); break;
                case 0x82: this.res_nbit_r_b8(0, D); break;
                case 0x83: this.res_nbit_r_b8(0, E); break;
                case 0x84: this.res_nbit_r_b8(0, H); break;
                case 0x85: this.res_nbit_r_b8(0, L); break;
                case 0x86: this.res_nbit_mrr_b8(0, H, L); break;
                case 0x87: this.res_nbit_r_b8(0, A); break;
                case 0x88: this.res_nbit_r_b8(1, B); break;
                case 0x89: this.res_nbit_r_b8(1, C); break;
                case 0x8A: this.res_nbit_r_b8(1, D); break;
                case 0x8B: this.res_nbit_r_b8(1, E); break;
                case 0x8C: this.res_nbit_r_b8(1, H); break;
                case 0x8D: this.res_nbit_r_b8(1, L); break;
                case 0x8E: this.res_nbit_mrr_b8(1, H, L); break;
                case 0x8F: this.res_nbit_r_b8(1, A); break;

                case 0x90: this.res_nbit_r_b8(2, B); break;
                case 0x91: this.res_nbit_r_b8(2, C); break;
                case 0x92: this.res_nbit_r_b8(2, D); break;
                case 0x93: this.res_nbit_r_b8(2, E); break;
                case 0x94: this.res_nbit_r_b8(2, H); break;
                case 0x95: this.res_nbit_r_b8(2, L); break;
                case 0x96: this.res_nbit_mrr_b8(2, H, L); break;
                case 0x97: this.res_nbit_r_b8(2, A); break;
                case 0x98: this.res_nbit_r_b8(3, B); break;
                case 0x99: this.res_nbit_r_b8(3, C); break;
                case 0x9A: this.res_nbit_r_b8(3, D); break;
                case 0x9B: this.res_nbit_r_b8(3, E); break;
                case 0x9C: this.res_nbit_r_b8(3, H); break;
                case 0x9D: this.res_nbit_r_b8(3, L); break;
                case 0x9E: this.res_nbit_mrr_b8(3, H, L); break;
                case 0x9F: this.res_nbit_r_b8(3, A); break;
                
                case 0xA0: this.res_nbit_r_b8(4, B); break;
                case 0xA1: this.res_nbit_r_b8(4, C); break;
                case 0xA2: this.res_nbit_r_b8(4, D); break;
                case 0xA3: this.res_nbit_r_b8(4, E); break;
                case 0xA4: this.res_nbit_r_b8(4, H); break;
                case 0xA5: this.res_nbit_r_b8(4, L); break;
                case 0xA6: this.res_nbit_mrr_b8(4, H, L); break;
                case 0xA7: this.res_nbit_r_b8(4, A); break;
                case 0xA8: this.res_nbit_r_b8(5, B); break;
                case 0xA9: this.res_nbit_r_b8(5, C); break;
                case 0xAA: this.res_nbit_r_b8(5, D); break;
                case 0xAB: this.res_nbit_r_b8(5, E); break;
                case 0xAC: this.res_nbit_r_b8(5, H); break;
                case 0xAD: this.res_nbit_r_b8(5, L); break;
                case 0xAE: this.res_nbit_mrr_b8(5, H, L); break;
                case 0xAF: this.res_nbit_r_b8(5, A); break;

                case 0xB0: this.res_nbit_r_b8(6, B); break;
                case 0xB1: this.res_nbit_r_b8(6, C); break;
                case 0xB2: this.res_nbit_r_b8(6, D); break;
                case 0xB3: this.res_nbit_r_b8(6, E); break;
                case 0xB4: this.res_nbit_r_b8(6, H); break;
                case 0xB5: this.res_nbit_r_b8(6, L); break;
                case 0xB6: this.res_nbit_mrr_b8(6, H, L); break;
                case 0xB7: this.res_nbit_r_b8(6, A); break;
                case 0xB8: this.res_nbit_r_b8(7, B); break;
                case 0xB9: this.res_nbit_r_b8(7, C); break;
                case 0xBA: this.res_nbit_r_b8(7, D); break;
                case 0xBB: this.res_nbit_r_b8(7, E); break;
                case 0xBC: this.res_nbit_r_b8(7, H); break;
                case 0xBD: this.res_nbit_r_b8(7, L); break;
                case 0xBE: this.res_nbit_mrr_b8(7, H, L); break;
                case 0xBF: this.res_nbit_r_b8(7, A); break;

                case 0xC0: this.set_nbit_r_b8(0, B); break;
                case 0xC1: this.set_nbit_r_b8(0, C); break;
                case 0xC2: this.set_nbit_r_b8(0, D); break;
                case 0xC3: this.set_nbit_r_b8(0, E); break;
                case 0xC4: this.set_nbit_r_b8(0, H); break;
                case 0xC5: this.set_nbit_r_b8(0, L); break;
                case 0xC6: this.set_nbit_mrr_b8(0, H, L); break;
                case 0xC7: this.set_nbit_r_b8(0, A); break;
                case 0xC8: this.set_nbit_r_b8(1, B); break;
                case 0xC9: this.set_nbit_r_b8(1, C); break;
                case 0xCA: this.set_nbit_r_b8(1, D); break;
                case 0xCB: this.set_nbit_r_b8(1, E); break;
                case 0xCC: this.set_nbit_r_b8(1, H); break;
                case 0xCD: this.set_nbit_r_b8(1, L); break;
                case 0xCE: this.set_nbit_mrr_b8(1, H, L); break;
                case 0xCF: this.set_nbit_r_b8(1, A); break;

                case 0xD0: this.set_nbit_r_b8(2, B); break;
                case 0xD1: this.set_nbit_r_b8(2, C); break;
                case 0xD2: this.set_nbit_r_b8(2, D); break;
                case 0xD3: this.set_nbit_r_b8(2, E); break;
                case 0xD4: this.set_nbit_r_b8(2, H); break;
                case 0xD5: this.set_nbit_r_b8(2, L); break;
                case 0xD6: this.set_nbit_mrr_b8(2, H, L); break;
                case 0xD7: this.set_nbit_r_b8(2, A); break;
                case 0xD8: this.set_nbit_r_b8(3, B); break;
                case 0xD9: this.set_nbit_r_b8(3, C); break;
                case 0xDA: this.set_nbit_r_b8(3, D); break;
                case 0xDB: this.set_nbit_r_b8(3, E); break;
                case 0xDC: this.set_nbit_r_b8(3, H); break;
                case 0xDD: this.set_nbit_r_b8(3, L); break;
                case 0xDE: this.set_nbit_mrr_b8(3, H, L); break;
                case 0xDF: this.set_nbit_r_b8(3, A); break;
                
                case 0xE0: this.set_nbit_r_b8(4, B); break;
                case 0xE1: this.set_nbit_r_b8(4, C); break;
                case 0xE2: this.set_nbit_r_b8(4, D); break;
                case 0xE3: this.set_nbit_r_b8(4, E); break;
                case 0xE4: this.set_nbit_r_b8(4, H); break;
                case 0xE5: this.set_nbit_r_b8(4, L); break;
                case 0xE6: this.set_nbit_mrr_b8(4, H, L); break;
                case 0xE7: this.set_nbit_r_b8(4, A); break;
                case 0xE8: this.set_nbit_r_b8(5, B); break;
                case 0xE9: this.set_nbit_r_b8(5, C); break;
                case 0xEA: this.set_nbit_r_b8(5, D); break;
                case 0xEB: this.set_nbit_r_b8(5, E); break;
                case 0xEC: this.set_nbit_r_b8(5, H); break;
                case 0xED: this.set_nbit_r_b8(5, L); break;
                case 0xEE: this.set_nbit_mrr_b8(5, H, L); break;
                case 0xEF: this.set_nbit_r_b8(5, A); break;

                case 0xF0: this.set_nbit_r_b8(6, B); break;
                case 0xF1: this.set_nbit_r_b8(6, C); break;
                case 0xF2: this.set_nbit_r_b8(6, D); break;
                case 0xF3: this.set_nbit_r_b8(6, E); break;
                case 0xF4: this.set_nbit_r_b8(6, H); break;
                case 0xF5: this.set_nbit_r_b8(6, L); break;
                case 0xF6: this.set_nbit_mrr_b8(6, H, L); break;
                case 0xF7: this.set_nbit_r_b8(6, A); break;
                case 0xF8: this.set_nbit_r_b8(7, B); break;
                case 0xF9: this.set_nbit_r_b8(7, C); break;
                case 0xFA: this.set_nbit_r_b8(7, D); break;
                case 0xFB: this.set_nbit_r_b8(7, E); break;
                case 0xFC: this.set_nbit_r_b8(7, H); break;
                case 0xFD: this.set_nbit_r_b8(7, L); break;
                case 0xFE: this.set_nbit_mrr_b8(7, H, L); break;
                case 0xFF: this.set_nbit_r_b8(7, A); break;

                default:
                     console.error("ERROR, CB no identificado")
                
            }
        }

        /** JP imm imm
         * 
         */
        this.jp_ii_8b = function(){
            var dir = this.sinSigno16Bits(
                this.memoria.leer8Bits(this.registros.PC++), this.memoria.leer8Bits(this.registros.PC++));
            this.registros.PC = dir;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("jp_ii_8b " + dir.toString(16));
        }

        /** JP HL
         * 
         */
        this.jp_hl_8b = function(){
            var dir = this.sinSigno16Bits(
                this.registros.R[L], this.registros.R[H]);
            this.registros.PC = dir;
            this.ciclos = 4;
            this.cPUDebug.instruccionStr = ("jp_hl_8b " + dir.toString(16));
        }

        /** JPNZ
         * 
         */
        this.jpnz_8b = function(){
            var dir = this.sinSigno16Bits(
                this.memoria.leer8Bits(this.registros.PC++), this.memoria.leer8Bits(this.registros.PC++));
            if(!this.Z) {
                this.registros.PC = dir;
                this.ciclos = 16;
            } 
            else this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("jpnz_8b " + dir.toString(16));
        }

        /** JPZ
         * 
         */
        this.jpz_8b = function(){
            var dir = this.sinSigno16Bits(
                this.memoria.leer8Bits(this.registros.PC++), this.memoria.leer8Bits(this.registros.PC++));
            if(this.Z) {
                this.registros.PC = dir;
                this.ciclos = 16;
            } 
            else this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("jpz_8b " + dir.toString(16));
        }
        
        /** JPNC
         * 
         */
        this.jpnc_8b = function(){
            var dir = this.sinSigno16Bits(
                this.memoria.leer8Bits(this.registros.PC++), this.memoria.leer8Bits(this.registros.PC++));
            if(!this.C) {
                this.registros.PC = dir;
                this.ciclos = 16;
            } 
            else this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("jpnc_8b " + dir.toString(16));
        }

        /** JPC
         * 
         */
        this.jpc_8b = function(){
            var dir = this.sinSigno16Bits(
                this.memoria.leer8Bits(this.registros.PC++), this.memoria.leer8Bits(this.registros.PC++));
            if(this.C) {
                this.registros.PC = dir;
                this.ciclos = 16;
            } 
            else this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("jpc_8b " + dir.toString(16));
        }

        /** JP mem(reg reg)
         * 
         * @param {*} regmemh 
         * @param {*} regmeml 
         */
        this.jp_mrr_8b = function(regmemh, regmeml){
            var dir = this.memoria.leer8Bits(this.registros.R[regmemh] * 0x100 + this.registros.R[regmeml]);
            this.registros.PC = dir;
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("jp_mrr_8b (" + this.nombreR(regmemh) + this.nombreR(regmeml) + ")");
        }

        /** JR imm
         * 
         */
        this.jr_8b = function(){
            var e = this.memoria.leer8Bits(this.registros.PC++);
            e = e << 24 >> 24;
            this.registros.PC = (this.registros.PC + (e)) & 0xFFFF;
            this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("jr_8b " + e);
        }

        /** JRNZ imm
         * 
         */
        this.jrnz_8b = function(){
            var e = this.memoria.leer8Bits(this.registros.PC++);
            e = e << 24 >> 24;
            if(!this.Z){
                this.registros.PC = (this.registros.PC + (e)) & 0xFFFF;
                this.ciclos = 12;
            } else this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("jrnz_8b " + e);
        }

        /** JRZ
         * 
         */
        this.jrz_8b = function(){
            var e = this.memoria.leer8Bits(this.registros.PC++);
            e = e << 24 >> 24;
            if(this.Z){
                this.registros.PC = (this.registros.PC + (e)) & 0xFFFF;
                this.ciclos = 12;
            } else this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("jrz_8b " + e);
        }

        /** JRNC
         * 
         */
        this.jrnc_8b = function(){
            var e = this.memoria.leer8Bits(this.registros.PC++);
            e = e << 24 >> 24;
            if(!this.C){
                this.registros.PC = (this.registros.PC + (e)) & 0xFFFF;
                this.ciclos = 12;
            } else this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("jrnc_8b " + e);
            return;
        }

        /** JRC
         * 
         */
        this.jrc_8b = function(){
            var e = this.memoria.leer8Bits(this.registros.PC++);
            e = e << 24 >> 24;
            if(this.C){
                this.registros.PC = (this.registros.PC + (e)) & 0xFFFF;
                this.ciclos = 12;
            } else this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("jrc_8b " + e);
            return;
        }

        /** CALL nn
         * Inserta la dirección de la proxima instruccion en la pila y luego
         * salta a la direccion nn.
         * @returns 
         */
        this.call = function(){
            // Leer la instruccion a la que se quiere saltar
            var dir = this.sinSigno16Bits(
                this.memoria.leer8Bits(this.registros.PC++), this.memoria.leer8Bits(this.registros.PC++));
            // Insertar la dir a la proxima instruccion en la pila
            this.registros.SP--;
            this.memoria.escribir8Bits(this.registros.SP--, this.msb(this.registros.PC));
            this.memoria.escribir8Bits(this.registros.SP, this.lsb(this.registros.PC));
            // Salta a la direccion nn
            this.registros.PC = dir;
            this.ciclos = 24;
            this.cPUDebug.instruccionStr = ("call " + dir.toString(16))
            return;
        }

        /** CALLNZ nn
         * Inserta la dirección de la proxima instruccion en la pila y luego
         * salta a la direccion nn.
         * @returns 
         */
        this.callnz = function(){
            
            // Leer la proxima instruccion
            var dirl = this.memoria.leer8Bits(this.registros.PC++)
            var dirh = this.memoria.leer8Bits(this.registros.PC++)
            var dir = dirh * 0x100 + dirl;
            if(!this.Z){
                // Insertar la dir a la proxima instruccion en la pila
                this.memoria.escribir8Bits(--this.registros.SP, this.msb(this.registros.PC));
                this.memoria.escribir8Bits(--this.registros.SP, this.lsb(this.registros.PC));
                // Salta a la direccion nn
                this.registros.PC = dir;
                this.ciclos = 24;
            } else this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("callnz " + dir.toString(16))
            return;
        }

        /** CALLZ nn
         * Inserta la dirección de la proxima instruccion en la pila y luego
         * salta a la direccion nn.
         * @returns 
         */
        this.callz = function(){
            // Leer la proxima instruccion
            var dirl = this.memoria.leer8Bits(this.registros.PC++)
            var dirh = this.memoria.leer8Bits(this.registros.PC++)
            var dir = dirh * 0x100 + dirl;
            if(this.Z){
                // Insertar la dir a la proxima instruccion en la pila
                this.memoria.escribir8Bits(--this.registros.SP, this.msb(this.registros.PC));
                this.memoria.escribir8Bits(--this.registros.SP, this.lsb(this.registros.PC));
                // Salta a la direccion nn
                this.registros.PC = dir;
                this.ciclos = 24;
            } else this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("callz " + dir.toString(16))
            return;
        }

        /** CALLNC nn
         * Inserta la dirección de la proxima instruccion en la pila y luego
         * salta a la direccion nn.
         * @returns 
         */
        this.callnc = function(){
            // Leer la proxima instruccion
            var dirl = this.memoria.leer8Bits(this.registros.PC++)
            var dirh = this.memoria.leer8Bits(this.registros.PC++)
            var dir = dirh * 0x100 + dirl;
            if(!this.C){
                // Insertar la dir a la proxima instruccion en la pila
                this.memoria.escribir8Bits(--this.registros.SP, this.msb(this.registros.PC));
                this.memoria.escribir8Bits(--this.registros.SP, this.lsb(this.registros.PC));
                // Salta a la direccion nn
                this.registros.PC = dir;
                this.ciclos = 24;
            } else this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("callnc " + dir.toString(16))
            return;
        }

        /** CALLC nn
         * Inserta la dirección de la proxima instruccion en la pila y luego
         * salta a la direccion nn.
         * @returns 
         */
        this.callc = function(){
            // Leer la proxima instruccion
            var dirl = this.memoria.leer8Bits(this.registros.PC++)
            var dirh = this.memoria.leer8Bits(this.registros.PC++)
            var dir = dirh * 0x100 + dirl;
            if(this.C){
                // Insertar la dir a la proxima instruccion en la pila
                this.memoria.escribir8Bits(--this.registros.SP, this.msb(this.registros.PC));
                this.memoria.escribir8Bits(--this.registros.SP, this.lsb(this.registros.PC));
                // Salta a la direccion nn
                this.registros.PC = dir;
                this.ciclos = 24;
            } else this.ciclos = 12;
            this.cPUDebug.instruccionStr = ("callc " + dir.toString(16))
            return;
        }

        // TODO
        /** RST n.
         * Inserta la dirección de la direccion actual en la pila.
         * Salta a la direccion 0x0000 + n.
         * @param {*} n 
         * @returns 
         */
        this.rst = function(n){
            // Insertar la dir a la direccion actual en la pila
            if(this.registros.SP != 0){
                this.memoria.escribir8Bits(--this.registros.SP >>> 0, this.msb(this.registros.PC));
                this.memoria.escribir8Bits(--this.registros.SP >>> 0, this.lsb(this.registros.PC));
                this.registros.PC = this.sinSigno16Bits(n, 0x00);
            }
            this.cPUDebug.instruccionStr = ("rst");
            this.ciclos = 16;
            return;
        }

        /** RET 
         * 
         */
        this.ret = function(){
            this.registros.PC = this.sinSigno16Bits(this.memoria.leer8Bits(this.registros.SP++),
                this.memoria.leer8Bits(this.registros.SP++));
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("ret");
            return;
        }

        /** RETZ
         * 
         */
        this.retz = function(){
            if(this.Z){
                this.registros.PC = this.sinSigno16Bits(this.memoria.leer8Bits(this.registros.SP++),
                    this.memoria.leer8Bits(this.registros.SP++));
                this.ciclos = 20;
            } else this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("retz")
            return;
        }

        /** RETNZ
         * 
         */
        this.retnz = function(){
            if(!this.Z){
                this.registros.PC = this.sinSigno16Bits(this.memoria.leer8Bits(this.registros.SP++),
                    this.memoria.leer8Bits(this.registros.SP++));
                this.ciclos = 20;
            } else this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("retnz")
            return;
        }

        /** RETC
         * 
         */
        this.retc = function(){
            if(this.C){
                this.registros.PC = this.sinSigno16Bits(this.memoria.leer8Bits(this.registros.SP++),
                    this.memoria.leer8Bits(this.registros.SP++));
                this.ciclos = 20;
            } else this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("retc")
            return 4;
        }

        /** RETNC
         * 
         */
        this.retnc = function(){
            if(!this.C){
                this.registros.PC = this.sinSigno16Bits(this.memoria.leer8Bits(this.registros.SP++),
                    this.memoria.leer8Bits(this.registros.SP++));
                this.ciclos = 20;
            } else this.ciclos = 8;
            this.cPUDebug.instruccionStr = ("retnc")
            return;
        }

        /** RETI 
         * 
         */
        this.reti = function(){
            this.registros.PC = this.sinSigno16Bits(this.memoria.leer8Bits(this.registros.SP++),
                this.memoria.leer8Bits(this.registros.SP++));
            //TODO: activa la interrupciones IME
            this.iME = 1;
            this.ciclos = 16;
            this.cPUDebug.instruccionStr = ("reti")
            return;
        }

        /** NULL
         * 
         */
        this.null = function(){
            this.cPUDebug.instruccionStr = ("**NULL**")
            this.ciclos = 4;
            return;
        }

    }

    ejecutar(codigo){

        switch(codigo){

            case 0x00: this.nop(); break;
            case 0x01: this.ld_rr_ii_16b(B, C); break;
            case 0x02: this.ld_mrr_r_8b(B, C, A); break;
            case 0x03: this.inc_rr_16b(B, C); break;
            case 0x04: this.inc_r_8b(B); break;
            case 0x05: this.dec_r_8b(B); break;
            case 0x06: this.ld_r_i_8b(B); break;
            case 0x07: this.rlca_8b(); break;
            case 0x08: this.ld_mii_sp_16b(); break;
            case 0x09: this.add_rr_rr_16b(H, L, B, C); break;
            case 0x0A: this.ld_r_mrr_8b(A, B, C); break;
            case 0x0B: this.dec_rr_16b(B, C); break;
            case 0x0C: this.inc_r_8b(C); break;
            case 0x0D: this.dec_r_8b(C); break;
            case 0x0E: this.ld_r_i_8b(C); break;
            case 0x0F: this.rrca_8b(); break;

            case 0x10: this.stop(); break;
            case 0x11: this.ld_rr_ii_16b(D, E); break;
            case 0x12: this.ld_mrr_r_8b(D, E, A); break;
            case 0x13: this.inc_rr_16b(D, E); break;
            case 0x14: this.inc_r_8b(D); break;
            case 0x15: this.dec_r_8b(D); break;
            case 0x16: this.ld_r_i_8b(D); break;
            case 0x17: this.rla_8b(); break;
            case 0x18: this.jr_8b(); break;
            case 0x19: this.add_rr_rr_16b(H, L, D, E); break;
            case 0x1A: this.ld_r_mrr_8b(A, D, E); break;
            case 0x1B: this.dec_rr_16b(D, E); break;
            case 0x1C: this.inc_r_8b(E); break;
            case 0x1D: this.dec_r_8b(E); break;
            case 0x1E: this.ld_r_i_8b(E); break;
            case 0x1F: this.rra_8b(); break;

            case 0x20: this.jrnz_8b(); break;
            case 0x21: this.ld_rr_ii_16b(H, L); break;
            case 0x22: this.ld_mrr_r_8b(H, L, A, +1); break;
            case 0x23: this.inc_rr_16b(H, L); break;
            case 0x24: this.inc_r_8b(H); break;
            case 0x25: this.dec_r_8b(H); break;
            case 0x26: this.ld_r_i_8b(H); break;
            case 0x27: this.daa_8b(); break;
            case 0x28: this.jrz_8b(); break;
            case 0x29: this.add_rr_rr_16b(H, L, H, L); break;
            case 0x2A: this.ld_r_mrr_8b(A, H, L, +1); break;
            case 0x2B: this.dec_rr_16b(H, L); break;
            case 0x2C: this.inc_r_8b(L); break;
            case 0x2D: this.dec_r_8b(L); break;
            case 0x2E: this.ld_r_i_8b(L); break;
            case 0x2F: this.cpl_8b(A); break;

            case 0x30: this.jrnc_8b(); break;
            case 0x31: this.ld_sp_ii_16b(); break;
            case 0x32: this.ld_mrr_r_8b(H, L, A, -1); break;
            case 0x33: this.inc_sp_16b(); break;
            case 0x34: this.inc_mrr_8b(H, L); break;
            case 0x35: this.dec_mrr_8b(H, L); break;
            case 0x36: this.ld_mrr_i_8b(H, L); break;
            case 0x37: this.scf_8b(); break;
            case 0x38: this.jrc_8b(); break;
            case 0x39: this.add_rr_sp_16b(H, L); break;
            case 0x3A: this.ld_r_mrr_8b(A, H, L, -1); break;
            case 0x3B: this.dec_sp_16b(); break;
            case 0x3C: this.inc_r_8b(A); break;
            case 0x3D: this.dec_r_8b(A); break;
            case 0x3E: this.ld_r_i_8b(A); break;
            case 0x3F: this.ccf_8b(); break;

            case 0x40: this.ld_r_r_8b(B ,B); break;
            case 0x41: this.ld_r_r_8b(B ,C); break;
            case 0x42: this.ld_r_r_8b(B, D); break;
            case 0x43: this.ld_r_r_8b(B, E); break;
            case 0x44: this.ld_r_r_8b(B, H); break;
            case 0x45: this.ld_r_r_8b(B, L); break;
            case 0x46: this.ld_r_mrr_8b(B, H, L); break;
            case 0x47: this.ld_r_r_8b(B ,A); break;
            case 0x48: this.ld_r_r_8b(C ,B); break;
            case 0x49: this.ld_r_r_8b(C ,C); break;
            case 0x4A: this.ld_r_r_8b(C ,D); break;
            case 0x4B: this.ld_r_r_8b(C ,E); break;
            case 0x4C: this.ld_r_r_8b(C ,H); break;
            case 0x4D: this.ld_r_r_8b(C ,L); break;
            case 0x4E: this.ld_r_mrr_8b(C, H, L); break;
            case 0x4F: this.ld_r_r_8b(C ,A); break;

            case 0x50: this.ld_r_r_8b(D ,B); break;
            case 0x51: this.ld_r_r_8b(D ,C); break;
            case 0x52: this.ld_r_r_8b(D, D); break;
            case 0x53: this.ld_r_r_8b(D, E); break;
            case 0x54: this.ld_r_r_8b(D, H); break;
            case 0x55: this.ld_r_r_8b(D, L); break;
            case 0x56: this.ld_r_mrr_8b(D, H, L); break;
            case 0x57: this.ld_r_r_8b(D ,A); break;
            case 0x58: this.ld_r_r_8b(E ,B); break;
            case 0x59: this.ld_r_r_8b(E ,C); break;
            case 0x5A: this.ld_r_r_8b(E ,D); break;
            case 0x5B: this.ld_r_r_8b(E ,E); break;
            case 0x5C: this.ld_r_r_8b(E ,H); break;
            case 0x5D: this.ld_r_r_8b(E ,L); break;
            case 0x5E: this.ld_r_mrr_8b(E, H, L); break;
            case 0x5F: this.ld_r_r_8b(E ,A); break;

            case 0x60: this.ld_r_r_8b(H ,B); break;
            case 0x61: this.ld_r_r_8b(H ,C); break;
            case 0x62: this.ld_r_r_8b(H, D); break;
            case 0x63: this.ld_r_r_8b(H, E); break;
            case 0x64: this.ld_r_r_8b(H, H); break;
            case 0x65: this.ld_r_r_8b(H, L); break;
            case 0x66: this.ld_r_mrr_8b(H, H, L); break;
            case 0x67: this.ld_r_r_8b(H ,A); break;
            case 0x68: this.ld_r_r_8b(L ,B); break;
            case 0x69: this.ld_r_r_8b(L ,C); break;
            case 0x6A: this.ld_r_r_8b(L ,D); break;
            case 0x6B: this.ld_r_r_8b(L ,E); break;
            case 0x6C: this.ld_r_r_8b(L ,H); break;
            case 0x6D: this.ld_r_r_8b(L ,L); break;
            case 0x6E: this.ld_r_mrr_8b(L, H, L); break;
            case 0x6F: this.ld_r_r_8b(L ,A); break;

            case 0x70: this.ld_mrr_r_8b(H, L, B); break;
            case 0x71: this.ld_mrr_r_8b(H, L, C); break;
            case 0x72: this.ld_mrr_r_8b(H, L, D); break;
            case 0x73: this.ld_mrr_r_8b(H, L, E); break;
            case 0x74: this.ld_mrr_r_8b(H, L, H); break;
            case 0x75: this.ld_mrr_r_8b(H, L, L); break;
            case 0x76: this.halt(); break;
            case 0x77: this.ld_mrr_r_8b(H, L, A); break;
            case 0x78: this.ld_r_r_8b(A ,B); break;
            case 0x79: this.ld_r_r_8b(A ,C); break;
            case 0x7A: this.ld_r_r_8b(A ,D); break;
            case 0x7B: this.ld_r_r_8b(A ,E); break;
            case 0x7C: this.ld_r_r_8b(A ,H); break;
            case 0x7D: this.ld_r_r_8b(A ,L); break;
            case 0x7E: this.ld_r_mrr_8b(A, H, L); break;
            case 0x7F: this.ld_r_r_8b(A ,A); break;

            case 0x80: this.add_r_r_8b(A, B); break;
            case 0x81: this.add_r_r_8b(A, C); break;
            case 0x82: this.add_r_r_8b(A, D); break;
            case 0x83: this.add_r_r_8b(A, E); break;
            case 0x84: this.add_r_r_8b(A, H); break;
            case 0x85: this.add_r_r_8b(A, L); break;
            case 0x86: this.add_r_mrr_8b(A, H, L); break;
            case 0x87: this.add_r_r_8b(A, A); break;
            case 0x88: this.adc_r_r_8b(A, B); break;
            case 0x89: this.adc_r_r_8b(A, C); break;
            case 0x8A: this.adc_r_r_8b(A, D); break;
            case 0x8B: this.adc_r_r_8b(A, E); break;
            case 0x8C: this.adc_r_r_8b(A, H); break;
            case 0x8D: this.adc_r_r_8b(A, L); break;
            case 0x8E: this.adc_r_mrr_8b(A, H, L); break;
            case 0x8F: this.adc_r_r_8b(A, A); break;

            case 0x90: this.sub_r_r_8b(A, B); break;
            case 0x91: this.sub_r_r_8b(A, C); break;
            case 0x92: this.sub_r_r_8b(A, D); break;
            case 0x93: this.sub_r_r_8b(A, E); break;
            case 0x94: this.sub_r_r_8b(A, H); break;
            case 0x95: this.sub_r_r_8b(A, L); break;
            case 0x96: this.sub_r_mrr_8b(A, H, L); break;
            case 0x97: this.sub_r_r_8b(A, A); break;
            case 0x98: this.sbc_r_r_8b(A, B); break;
            case 0x99: this.sbc_r_r_8b(A, C); break;
            case 0x9A: this.sbc_r_r_8b(A, D); break;
            case 0x9B: this.sbc_r_r_8b(A, E); break;
            case 0x9C: this.sbc_r_r_8b(A, H); break;
            case 0x9D: this.sbc_r_r_8b(A, L); break;
            case 0x9E: this.sbc_r_mrr_8b(A, H, L); break;
            case 0x9F: this.sbc_r_r_8b(A, A); break;

            case 0xA0: this.and_r_8b(B); break;
            case 0xA1: this.and_r_8b(C); break;
            case 0xA2: this.and_r_8b(D); break;
            case 0xA3: this.and_r_8b(E); break;
            case 0xA4: this.and_r_8b(H); break;
            case 0xA5: this.and_r_8b(L); break;
            case 0xA6: this.and_mrr_8b(H, L); break;
            case 0xA7: this.and_r_8b(A); break;
            case 0xA8: this.xor_r_8b(B); break;
            case 0xA9: this.xor_r_8b(C); break;
            case 0xAA: this.xor_r_8b(D); break;
            case 0xAB: this.xor_r_8b(E); break;
            case 0xAC: this.xor_r_8b(H); break;
            case 0xAD: this.xor_r_8b(L); break;
            case 0xAE: this.xor_mrr_8b(H, L); break;
            case 0xAF: this.xor_r_8b(A); break;

            case 0xB0: this.or_r_8b(B); break;
            case 0xB1: this.or_r_8b(C); break;
            case 0xB2: this.or_r_8b(D); break;
            case 0xB3: this.or_r_8b(E); break;
            case 0xB4: this.or_r_8b(H); break;
            case 0xB5: this.or_r_8b(L); break;
            case 0xB6: this.or_mrr_8b(H, L); break;
            case 0xB7: this.or_r_8b(A); break;
            case 0xB8: this.cp_r_8b(B); break;
            case 0xB9: this.cp_r_8b(C); break;
            case 0xBA: this.cp_r_8b(D); break;
            case 0xBB: this.cp_r_8b(E); break;
            case 0xBC: this.cp_r_8b(H); break;
            case 0xBD: this.cp_r_8b(L); break;
            case 0xBE: this.cp_mrr_8b(H, L); break;
            case 0xBF: this.cp_r_8b(A); break;

            case 0xC0: this.retnz(); break;
            case 0xC1: this.pop_rr_16b(B, C); break;
            case 0xC2: this.jpnz_8b(); break;
            case 0xC3: this.jp_ii_8b(); break;
            case 0xC4: this.callnz(); break;
            case 0xC5: this.push_rr_16b(B, C); break;
            case 0xC6: this.add_r_i_8b(A); break;
            case 0xC7: this.rst(0x00); break;
            case 0xC8: this.retz(); break;
            case 0xC9: this.ret(); break;
            case 0xCA: this.jpz_8b(); break;
            case 0xCB: this.cb(); break;
            case 0xCC: this.callz(); break;
            case 0xCD: this.call(); break;
            case 0xCE: this.adc_r_i_8b(A); break;
            case 0xCF: this.rst(0x08); break;

            case 0xD0: this.retnc(); break;
            case 0xD1: this.pop_rr_16b(D, E); break;
            case 0xD2: this.jpnc_8b(); break;
            case 0xD3: this.null(); break;
            case 0xD4: this.callnc(); break;
            case 0xD5: this.push_rr_16b(D, E); break;
            case 0xD6: this.sub_r_i_8b(A); break;
            case 0xD7: this.rst(0x10); break;
            case 0xD8: this.retc(); break;
            case 0xD9: this.reti(); break;
            case 0xDA: this.jpc_8b(); break;
            case 0xDB: this.null(); break;
            case 0xDC: this.callc(); break;
            case 0xDD: this.null(); break;
            case 0xDE: this.sbc_r_i_8b(A); break;
            case 0xDF: this.rst(0x18); break;

            case 0xE0: this.ld_mff00i_r_8b(A); break;
            case 0xE1: this.pop_rr_16b(H, L); break;
            case 0xE2: this.ld_mff00r_r_8b(C, A); break;
            case 0xE3: this.null(); break;
            case 0xE4: this.null(); break;
            case 0xE5: this.push_rr_16b(H, L); break;
            case 0xE6: this.and_i_8b(); break;
            case 0xE7: this.rst(0x20); break;
            case 0xE8: this.add_sp_i_16b(); break;
            case 0xE9: this.jp_hl_8b(); break;
            case 0xEA: this.ld_mii_r_8b(A); break;
            case 0xEB: this.null(); break;
            case 0xEC: this.null(); break;
            case 0xED: this.null(); break;
            case 0xEE: this.xor_i_8b(); break;
            case 0xEF: this.rst(0x28); break;

            case 0xF0: this.ld_r_mff00i_8b(A); break;
            case 0xF1: this.pop_rr_16b(A, F); break;
            case 0xF2: this.ld_r_mff00r_8b(A, C); break;
            case 0xF3: this.di(); break;
            case 0xF4: this.null(); break;
            case 0xF5: this.push_rr_16b(A, F); break;
            case 0xF6: this.or_i_8b(); break;
            case 0xF7: this.rst(0x30); break;
            case 0xF8: this.ld_hl_sp_imm_16b(); break;
            case 0xF9: this.ld_sp_rr_16b(H, L); break;
            case 0xFA: this.ld_r_mii_8b(A); break;
            case 0xFB: this.ei(); break;
            case 0xFC: this.null(); break;
            case 0xFD: this.null(); break;
            case 0xFE: this.cp_i_8b(); break;
            case 0xFF: this.rst(0x38); break;

            default: 
                this.cPUDebug.instruccionStr = ("CUIDADO, NO ES UN OP IMPLEMENTADO")
            break;
        }
    }

    msb(n_16b) {
        return (n_16b >> 8) & 0xFF
    }

    lsb(n_16b) {
        return n_16b & 0xFF
    }

    sinSigno16Bits(lsb, msb){
        return msb * 0x100 + lsb 
    }
    
    /**
     * D
     */
    ciclo(){
        this.memoria.memoriaStr = "";

        this.rutinaInterrupcion()

        if(!this.halted){
            var codigo = this.memoria.leer8Bits(this.registros.PC);
            this.anteriorPC = this.registros.PC;
            this.cPUDebug.instruccionPC = this.registros.PC.toString(16);
            // Debug
            if(this.cPUDebug.pausasActivadas){
                if(this.cPUDebug.breakpoints.includes(this.registros.PC))
                    this.cPUDebug.pausado = true;
            }
            // Se aumenta el contador de programa
            this.registros.PC++;
            if(this.registros.PC > 0xFFFF){
                console.log("PC fuera de rango!")
                this.registros.PC = 0;
            }

            this.memoria.mostrarLogs = true;
            this.ejecutar(codigo);
            this.memoria.mostrarLogs = false;

            // Se actualizan el registro de F con los flags
            this.actualizarFlag();

            // Mensajes de debug
            this.cPUDebug.codigoStr = codigo.toString(16);
            this.cPUDebug.registros16Str = this.imprimirRegistros16Bits();
            this.cPUDebug.registrosStr = this.imprimirRegistros8Bits();
            this.cPUDebug.flagsStr = this.imprimirFlags();
            this.ciclos = this.ciclos
        }
    }

    rutinaInterrupcion(){
        // Si el IME esta a 0 las interrupciones estan desactivadas
        if(this.iME == 0 && !this.halted) return;

        var intActivada = false;
        var i = 0;
        // Se recorren las flags de activacion para b
        while(!intActivada && i < 5){
            // Solo se ejecutarán las interrupciones si el registro IE esta activado
            if(this.interrupciones.regs.interrupcionActivada[i]){
                if(this.interrupciones.regs.flagsInterrupcion[i]){
                    if(i == TIMER_INT) console.debug("LCDSTAT_INT lanzada");
                    intActivada = true;
                } else i++;
            }
            else i++;
        }
        if(intActivada && this.halted)
        {
            this.halted = false;
        }
        // Ha encontrado una peticion de interrupcion
        if(intActivada && this.iME == 1){
            //console.log("intActivada")
            //TODO esperar cinco ciclos
            this.iME = 0;
            // Se resetea el flag.
            this.interrupciones.regs.flagsInterrupcion[i] = false;

            // Insertar el valor actual del registro PC en la pila. Consume 2 ciclos.
            this.registros.SP--;
            this.memoria.escribir8Bits(this.registros.SP--, this.msb(this.registros.PC));
            this.memoria.escribir8Bits(this.registros.SP, this.lsb(this.registros.PC));
            // PC se actualiza con la direccion del manejador de la instruccion.
            this.registros.PC = this.interrupciones.regs.iHandlerDir[i];
            this.ciclos += 5;
        }
        return;
    }



    // Debug ---

    nombreR(registro){
        if(registro == A) return "A";
        if(registro == B) return "B";
        if(registro == C) return "C";
        if(registro == D) return "D";
        if(registro == E) return "E";
        if(registro == F) return "F";
        if(registro == H) return "H";
        if(registro == L) return "L";
    }

    actualizarFlag() {
        this.registros.R[F] = this.Z * 0x80 + this.N * 0x40 + this.H * 0x20 + this.C * 0x10 + (this.registros.R[F] & 0x0F); 
    }

    imprimirRegistros8Bits(){
        var str = "AF: [" + this.registros.R[A].toString(16) + " " + this.registros.R[F].toString(16) + "], "
        + "BC: [" + this.registros.R[B].toString(16) + " " + this.registros.R[C].toString(16) + "], "
        + "DE: [" + this.registros.R[D].toString(16) + " " + this.registros.R[E].toString(16) + "], "
        + "HL: [" + this.registros.R[H].toString(16) + " " + this.registros.R[L].toString(16) + "] ";
        return str;
    }

    imprimirRegistros16Bits(){
        var str = "PC: [" + this.registros.PC.toString(16) + "]"
        +" SP: [" + this.registros.SP.toString(16) + "]";
        return (str)
    }

    imprimirFlags(){
        var str = "Z:"+this.Z+" N:"+this.N+" H:"+this.H+" C:"+this.C;
        return str;
    }

    pausarEn(pc){
        this.cPUDebug.breakpoints.push(pc);
    }

    pausar(){
        this.cPUDebug.pausasActivadas = true;
        this.cPUDebug.pausado = true;
    }

    continuar(){
        this.cPUDebug.pausado = false;
    }

    continuarSinPausa(){
        this.cPUDebug.pausasActivadas = false;
        this.cPUDebug.pausado = false;
    }
}