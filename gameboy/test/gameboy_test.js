
function gb_test(){

    var tests = new Array();

    // test load de un inmediato a un registro
    tests.push(function test_ld_r_i_8b(){
        var gb = new Gameboy();
        gb.memoria.escribir_8bits(0x1000, 0x69);
        gb.memoria.leer_8bits(0x1000, 0x69);
        gb.cpu.registros.PC = 0x1000;
        gb.cpu.ld_r_i_8b(B);
        return gb.cpu.registros.R[B] == 0x69
    })

    // test load de un registro src a otro dst
    tests.push(function test_ld_r_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[B] = 0x12
        gb.cpu.ld_r_r_8b(C, B);
        return gb.cpu.registros.R[C] == 0x12
    })

    // test load de un registro a una direccion de memoria ubicada en registros
    tests.push(function test_ld_r_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[D] = 0x01
        gb.cpu.registros.R[C] = 0x12
        gb.cpu.registros.R[B] = 0x12
        gb.memoria.escribir_8bits(0x1212, 0x69);
        gb.cpu.ld_r_mrr_8b(D, C, B);
        return gb.cpu.registros.R[D] == 0x69
    })

    // test load de un registro a una direccion + ff00
    tests.push(function test_ld_r_mff00r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[C] = 0x12
        gb.cpu.registros.R[B] = 0x23
        gb.memoria.escribir_8bits(0xFF23, 0x69);
        gb.cpu.ld_r_mff00r_8b(C, B);
        return gb.cpu.registros.R[C] == 0x69
    })

    tests.push(function test_ld_mff00r_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[D] = 0x23;
        gb.cpu.registros.R[B] = 0x68;
        gb.cpu.ld_mff00r_r_8b(D, B);
        return  gb.memoria.leer_8bits(0xFF23) == 0x68;
    })

    // test load de una direccion de memoria a un registro
    tests.push(function test_ld_mrr_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[C] = 0x23;
        gb.cpu.registros.R[D] = 0x23;
        gb.cpu.registros.R[B] = 0xFF;
        gb.cpu.ld_mrr_r_8b(C, D, B);
        return gb.memoria.leer_8bits(0x2323) == 0xFF;
    })

    tests.push(function test_ld_r_mii_8b(){
        var gb = new Gameboy();
        gb.memoria.escribir_8bits(0x1000, 0x96);
        gb.memoria.escribir_8bits(0x1001, 0x69);
        gb.memoria.escribir_8bits(0x6996, 0x23);
        gb.cpu.registros.PC = 0x1000;
        gb.cpu.ld_r_mii_8b(B);
        return gb.cpu.registros.R[B] == 0x23
    })

    tests.push(function test_ld_r_mff00i_8b(){
        var gb = new Gameboy();
        gb.memoria.escribir_8bits(0x1000, 0x61);
        gb.memoria.escribir_8bits(0xFF61, 0x21);
        gb.cpu.registros.PC = 0x1000;
        gb.cpu.ld_r_mff00i_8b(B);
        return gb.cpu.registros.R[B] == 0x21
    })
    

    tests.push(function test_ld_mii_r_8b(){
        var gb = new Gameboy();
        gb.memoria.escribir_8bits(0x1000, 0x62);//L
        gb.memoria.escribir_8bits(0x1001, 0x61);//H
        gb.cpu.registros.PC = 0x1000;
        gb.cpu.registros.R[B] = 0x25
        gb.cpu.ld_mii_r_8b(B);
        return gb.memoria.leer_8bits(0x6162) == 0x25
    })

    tests.push(function test_ld_mff00i_r_8b(){
        var gb = new Gameboy();
        gb.memoria.escribir_8bits(0x1000, 0x33);
        gb.cpu.registros.PC = 0x1000;
        gb.cpu.registros.R[B] = 0x65
        gb.cpu.ld_mff00i_r_8b(B);
        return gb.memoria.leer_8bits(0xFF33) == 0x65
    })

    tests.push(function test_ld_mff00i_r_8b(){
        var gb = new Gameboy();
        gb.memoria.escribir_8bits(0x1000, 0x33);
        gb.cpu.registros.PC = 0x1000;
        gb.cpu.registros.R[B] = 0x65
        gb.cpu.ld_mff00i_r_8b(B);
        return gb.memoria.leer_8bits(0xFF33) == 0x65
    })

    tests.push(function test_ld_rr_ii_16b(){
        var gb = new Gameboy();
        gb.memoria.escribir_8bits(0x2000, 0x34);
        gb.memoria.escribir_8bits(0x2001, 0x12);
        gb.cpu.registros.PC = 0x2000;
        gb.cpu.ld_rr_ii_16b(H, L);
        return gb.cpu.registros.R[H] == 0x12 && gb.cpu.registros.R[L] == 0x34
    })

    tests.push(function test_ld_rr_rr_16b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[C] = 0x20;
        gb.cpu.registros.R[D] = 0x30;
        gb.cpu.ld_rr_rr_16b(A, B, C, D);

        return gb.cpu.registros.R[A] == 0x20 && gb.cpu.registros.R[B] == 0x30;
    })

    tests.push(function test_ld_mii_sp_16b(){
        var gb = new Gameboy();
        gb.memoria.escribir_8bits(0x1000, 0x21)
        gb.memoria.escribir_8bits(0x1001, 0x43)
        gb.cpu.registros.PC = 0x1000
        gb.cpu.registros.SP = 0x5678
        gb.cpu.ld_mii_sp_16b();
        return gb.memoria.leer_16bits(0x4321) == 0x5678;
    })

    tests.push(function test_ld_mrr_i_8b(){
        var gb = new Gameboy();
        gb.memoria.escribir_8bits(0x1000, 0x43)
        gb.cpu.registros.PC = 0x1000
        gb.cpu.registros.R[H] = 0x15;
        gb.cpu.registros.R[L] = 0x14;
        gb.cpu.ld_mrr_i_8b(H, L);
        return gb.memoria.leer_8bits(0x1514) == 0x43;
    })

    tests.push(function test_push_rr_16b(){
        var gb = new Gameboy();
        gb.cpu.registros.SP = 0x3000;
        gb.cpu.registros.R[H] = 0x23;
        gb.cpu.registros.R[L] = 0x24;
        gb.push_rr_16b(H, L);
        return gb.memoria.leer_16bits(0x3000-2) == 0x2324;
    })

    tests.push(function test_pop_rr_16b(){
        var gb = new Gameboy();
        gb.cpu.registros.SP = 0x3000;
        gb.memoria.escribir_16bits(gb.cpu.registros.SP, 0x6789)
        gb.pop_rr_16b(H, L);
        return gb.cpu.registros.R[H] == 0x67 && gb.cpu.registros.R[L] == 0x89;
    })

    tests.push(function test_pop_rr_16b(){
        var gb = new Gameboy();
        gb.cpu.registros.SP = 0x3000;
        gb.memoria.escribir_16bits(gb.cpu.registros.SP, 0x6789)
        gb.pop_rr_16b(H, L);
        return gb.cpu.registros.R[H] == 0x67 && gb.cpu.registros.R[L] == 0x89;
    })

    tests.push(function test_add_r_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xFF;
        gb.cpu.registros.R[D] = 0x01;

        gb.add_r_r_8b(A, D);
        console.log(gb.H)
        return gb.cpu.registros.R[A] == 0x00 && gb.H == 1 & gb.C == 1 & gb.Z == 1;
    })

    tests.push(function test_add_r_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xFF;
        gb.cpu.registros.R[H] = 0x54;
        gb.cpu.registros.R[L] = 0x32;
        gb.memoria.escribir_8bits(0x5432, 0x01)
        gb.add_r_mrr_8b(A, H, L);
        return gb.cpu.registros.R[A] == 0x00 && gb.H == 1 & gb.C == 1 & gb.Z == 1;
    })

    tests.push(function test_add_r_i_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xFF;
        gb.memoria.escribir_8bits(0x1000, 0x01)
        gb.cpu.registros.PC = 0x1000
        gb.add_r_i_8b(A);
        console.log(gb.printFlags())
        return gb.cpu.registros.R[A] == 0x00 && gb.H == 1 & gb.C == 1 & gb.Z == 1;
    })

    tests.push(function test_adc_r_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xFE;
        gb.cpu.registros.R[D] = 0x01;
        gb.C = 1;

        gb.adc_r_r_8b(A, D);
        console.log(gb.H)
        return gb.cpu.registros.R[A] == 0x00 && gb.H == 1 & gb.C == 1 & gb.Z == 1;
    })

    tests.push(function test_adc_r_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xE1;
        gb.cpu.registros.R[H] = 0x12;
        gb.cpu.registros.R[L] = 0x32;
        gb.memoria.escribir_8bits(0x1232, 0x1E)
        gb.C = 1;
        gb.adc_r_mrr_8b(A, H, L);
        return gb.cpu.registros.R[A] == 0x00 && gb.H == 1 & gb.C == 1 & gb.Z == 1;
    })

    tests.push(function test_adc_r_i_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xE1 ;
        gb.memoria.escribir_8bits(0x1000, 0x3B)
        gb.cpu.registros.PC = 0x1000
        gb.C = 1;
        gb.adc_r_i_8b(A);
        console.log(gb.printFlags())
        return gb.cpu.registros.R[A] == 0x1D && gb.Z == 0 && gb.H == 0 && gb.C == 1;
    })

    tests.push(function test_sub_r_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x3E;
        gb.cpu.registros.R[E] = 0x3E;

        gb.sub_r_r_8b(A, E);
        gb.printFlags()
        console.log(gb.cpu.registros.R[A])
        return gb.cpu.registros.R[A] == 0x00 && gb.Z == 1 & gb.H == 0 & gb.N == 1 & gb.C == 0;
    })

    tests.push(function test_sub_r_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x3E;
        gb.cpu.registros.R[H] = 0x54;
        gb.cpu.registros.R[L] = 0x32;
        gb.memoria.escribir_8bits(0x5432, 0x40)
        gb.sub_r_mrr_8b(A, H, L);
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0xFE && gb.Z == 0 & gb.H == 0 & gb.N == 1 & gb.C == 1;
    })

    tests.push(function test_sub_r_i_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x3E;
        gb.memoria.escribir_8bits(0x1000, 0x0F)
        gb.cpu.registros.PC = 0x1000
        gb.sub_r_i_8b(A);
        console.log(gb.printFlags())
        return gb.cpu.registros.R[A] == 0x2F && gb.Z == 0 & gb.H == 1 & gb.N == 1 & gb.C == 0;
    })

    tests.push(function test_sbc_r_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x3B;
        gb.cpu.registros.R[H] = 0x2A;
        gb.C = 1;
        gb.sbc_r_r_8b(A, H);
        gb.printFlags()
        console.log(gb.cpu.registros.R[A])
        return gb.cpu.registros.R[A] == 0x10 && gb.Z == 0 & gb.H == 0 & gb.N == 1 & gb.C == 0;
    })

    tests.push(function test_sbc_r_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x3B;
        gb.cpu.registros.R[H] = 0x54;
        gb.cpu.registros.R[L] = 0x32;
        gb.C = 1;
        gb.memoria.escribir_8bits(0x5432, 0x4F)
        gb.sbc_r_mrr_8b(A, H, L);
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0xEB && gb.Z == 0 & gb.H == 1 & gb.N == 1 & gb.C == 1;
    })

    tests.push(function test_sbc_r_i_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x3B ;
        gb.memoria.escribir_8bits(0x1000, 0x3A)
        gb.cpu.registros.PC = 0x1000;
        gb.C = 1;
        gb.sbc_r_i_8b(A);
        console.log(gb.printFlags())
        return gb.cpu.registros.R[A] == 0x00 && gb.Z == 1 & gb.H == 0 & gb.N == 1 & gb.C == 0;
    })

    tests.push(function test_and_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x5A;
        gb.cpu.registros.R[L] = 0x3F;
        gb.and_r_8b(L);
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x1A && gb.Z == 0 & gb.H == 1 & gb.N == 0 & gb.C == 0;
    })

    tests.push(function test_and_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x5A;
        gb.cpu.registros.R[H] = 0x54;
        gb.cpu.registros.R[L] = 0x32;
        gb.memoria.escribir_8bits(0x5432, 0x0)
        gb.and_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x00 && gb.Z == 1 & gb.H == 1 & gb.N == 0 & gb.C == 0;
    })

    tests.push(function test_and_i_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x5A;
        gb.memoria.escribir_8bits(0x1000, 0x38)
        gb.cpu.registros.PC = 0x1000
        gb.and_i_8b();
        gb.printFlags();
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x18 && gb.Z == 0 & gb.H == 1 & gb.N == 0 & gb.C == 0;
    })

    tests.push(function test_or_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x5A;
        gb.or_r_8b(A);
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x5A && gb.Z == 0 & gb.H == 0 & gb.N == 0 & gb.C == 0;
    })

    tests.push(function test_or_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x5A;
        gb.cpu.registros.R[H] = 0x54;
        gb.cpu.registros.R[L] = 0x32;
        gb.memoria.escribir_8bits(0x5432, 0x0F)
        gb.or_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x5F && gb.Z == 0 & gb.H == 0 & gb.N == 0 & gb.C == 0;
    })

    tests.push(function test_or_i_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x5A;
        gb.memoria.escribir_8bits(0x1000, 0x03)
        gb.cpu.registros.PC = 0x1000
        gb.or_i_8b();
        gb.printFlags();
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x5B && gb.Z == 0 & gb.H == 0 & gb.N == 0 & gb.C == 0;
    })

    //XOR

    tests.push(function test_xor_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xFF;
        gb.xor_r_8b(A);
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x0 && gb.Z == 1 && gb.N == 1;
    })

    tests.push(function test_xor_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xFF;
        gb.cpu.registros.R[H] = 0x54;
        gb.cpu.registros.R[L] = 0x32;
        gb.memoria.escribir_8bits(0x5432, 0x8A)
        gb.xor_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x75 && gb.Z == 0 && gb.N == 1;
    })

    tests.push(function test_xor_i_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xFF;
        gb.memoria.escribir_8bits(0x1000, 0x0F)
        gb.cpu.registros.PC = 0x1000
        gb.xor_i_8b();
        gb.printFlags();
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0xF0 && gb.Z == 0 && gb.N == 1;
    })

    tests.push(function test_cp_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x3C;
        gb.cpu.registros.R[B] = 0x2F;
        gb.cp_r_8b(B);
        gb.printFlags()
        return gb.Z == 0 && gb.H == 1 && gb.N == 1 && gb.C == 0;
    })

    tests.push(function test_cp_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x3C;
        gb.cpu.registros.R[H] = 0x54;
        gb.cpu.registros.R[L] = 0x32;
        gb.memoria.escribir_8bits(0x5432, 0x40)
        gb.cp_mrr_8b(H, L);
        gb.printFlags()
        return gb.Z == 0 && gb.H == 0 && gb.N == 1 && gb.C == 1;
    })

    tests.push(function test_cp_i_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x3C;
        gb.memoria.escribir_8bits(0x1000, 0x3C)
        gb.cpu.registros.PC = 0x1000
        gb.cp_i_8b();
        gb.printFlags();
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.Z == 1 && gb.H == 0 && gb.N == 1 && gb.C == 0;
    })

    tests.push(function test_inc_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xFF;
        gb.cpu.registros.R[B] = 0x2F;
        gb.inc_r_8b(A);
        gb.printFlags()
        return gb.cpu.registros.R[A] == 0x00 && gb.Z == 1 && gb.H == 1 && gb.N == 0;// && gb.C == 0;
    })

    tests.push(function test_inc_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0xFF;
        gb.cpu.registros.R[B] = 0x2F;
        gb.inc_r_8b(A);
        gb.printFlags()
        return gb.cpu.registros.R[A] == 0x00 && gb.Z == 1 && gb.H == 1 && gb.N == 0;// && gb.C == 0;
    })

    tests.push(function test_inc_mrr_8b_1(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x54;
        gb.cpu.registros.R[L] = 0x32;
        gb.memoria.escribir_8bits(0x5432, 0x50)
        gb.inc_mrr_8b(H, L);
        gb.printFlags()
        return gb.memoria.leer_8bits(0x5432) == 0x51 && gb.Z == 0 && gb.H == 0 && gb.N == 0 //&& gb.C == 1;
    })

    tests.push(function test_inc_mrr_8b_2(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x54;
        gb.cpu.registros.R[L] = 0x32;
        gb.memoria.escribir_8bits(0x5432, 0xFF)
        gb.inc_mrr_8b(H, L);
        gb.printFlags()
        return gb.memoria.leer_8bits(0x5432) == 0x00 && gb.Z == 1 && gb.H == 1 && gb.N == 0;// && gb.C == 0;
    })

    tests.push(function test_dec_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[L] = 0x01;
        gb.cpu.registros.R[B] = 0x2F;
        gb.dec_r_8b(L);
        gb.printFlags()
        return gb.cpu.registros.R[L] == 0x00 && gb.Z == 1 && gb.H == 0 && gb.N == 1;// && gb.C == 0;
    })

    tests.push(function test_dec_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x54;
        gb.cpu.registros.R[L] = 0x32;
        gb.memoria.escribir_8bits(0x5432, 0x00)
        gb.dec_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.memoria.leer_8bits(0x5432).toString(16))
        return gb.memoria.leer_8bits(0x5432) == 0xFF && gb.Z == 0 && gb.H == 1 && gb.N == 1 //&& gb.C == 1;
    })

    tests.push(function test_add_rr_rr_16b(){
        var gb = new Gameboy();
        gb.cpu.registros.escribir_16bits(H, L, 0x8A23);
        gb.cpu.registros.escribir_16bits(B, C, 0x0605);
        gb.add_rr_rr_16b(H, L, B, C);
        gb.printFlags()
        return gb.cpu.registros.leer_16bits(H, L) == 0x9028 && gb.H == 1 && gb.N == 0 && gb.C == 0;
    })

    tests.push(function test_add_rr_sp_16b(){
        var gb = new Gameboy();
        gb.cpu.registros.escribir_16bits(H, L, 0x8A23);
        gb.cpu.registros.SP = 0x0605;
        gb.add_rr_sp_16b(H, L);
        gb.printFlags()
        return gb.cpu.registros.leer_16bits(H, L) == 0x9028 && gb.H == 1 && gb.N == 0 && gb.C == 0;
    })

    tests.push(function test_add_sp_i_16b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1234;
        gb.memoria.escribir_8bits(0x1234, 0x02);
        gb.cpu.registros.SP = 0xFFF8;
        gb.add_sp_i_16b();
        gb.printFlags()
        console.log(gb.cpu.registros.SP.toString(16))
        return gb.cpu.registros.SP == 0xFFFA && gb.H == 0 && gb.N == 0 && gb.C == 0 && gb.Z == 0;
    })

    tests.push(function test_inc_rr_16b(){
        var gb = new Gameboy();
        gb.cpu.registros.escribir_16bits(D, E, 0x235F);
        gb.inc_rr_16b(D, E);
        gb.printFlags()
        return gb.cpu.registros.leer_16bits(D, E) == 0x2360;
    })

    tests.push(function test_dec_rr_16b(){
        var gb = new Gameboy();
        gb.cpu.registros.escribir_16bits(D, E, 0x235F);
        gb.dec_rr_16b(D, E);
        gb.printFlags()
        return gb.cpu.registros.leer_16bits(D, E) == 0x235E;
    })

    tests.push(function test_rlca_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x85
        gb.C = 0;
        gb.rlca_8b();
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x0B && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 0;
    })

    tests.push(function test_rla_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x95
        gb.C = 1;
        gb.rla_8b();
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x2B && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 0;
    })

    tests.push(function test_rrca_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x3B
        gb.C = 0;
        gb.rrca_8b();
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x9D && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 0;
    })

    tests.push(function test_rra_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x81
        gb.C = 0;
        gb.rra_8b();
        gb.printFlags()
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x40 && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 0;
    })

    tests.push(function test_rlc_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[B] = 0x85
        gb.C = 0;
        gb.rlc_r_8b(B);
        gb.printFlags()
        console.log(gb.cpu.registros.R[B].toString(16))
        return gb.cpu.registros.R[B] == 0x0B && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 0;
    })

    tests.push(function test_rlc_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0)
        gb.C = 0;
        gb.rlc_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.cpu.registros.R[B].toString(16))
        return gb.memoria.leer_8bits(0x1223) == 0x00 && gb.H == 0 && gb.N == 0 && gb.C == 0 && gb.Z == 1;
    })

    tests.push(function test_rl_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[L] = 0x80
        gb.C = 0;
        gb.rl_r_8b(L);
        gb.printFlags()
        console.log(gb.cpu.registros.R[L].toString(16))
        return gb.cpu.registros.R[L] == 0x00 && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 1;
    })

    tests.push(function test_rl_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0x11)
        gb.C = 0;
        gb.rl_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.memoria.leer_8bits(0x1223).toString(16))
        return gb.memoria.leer_8bits(0x1223) == 0x22 && gb.H == 0 && gb.N == 0 && gb.C == 0 && gb.Z == 0;
    })

    tests.push(function test_rrc_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[C] = 0x1;
        gb.C = 0;
        gb.rrc_r_8b(C);
        gb.printFlags()
        console.log(gb.cpu.registros.R[C].toString(16))
        return gb.cpu.registros.R[C] == 0x80 && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 0;
    })

    tests.push(function test_rrc_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0x00)
        gb.C = 0;
        gb.rrc_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.memoria.leer_8bits(0x1223).toString(16))
        return gb.memoria.leer_8bits(0x1223) == 0x00 && gb.H == 0 && gb.N == 0 && gb.C == 0 && gb.Z == 1;
    })

    tests.push(function test_rr_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x1;
        gb.C = 0;
        gb.rr_r_8b(A);
        gb.printFlags()
        console.log(gb.cpu.registros.R[C].toString(16))
        return gb.cpu.registros.R[A] == 0x00 && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 1;
    })

    tests.push(function test_rr_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0x8A)
        gb.C = 0;
        gb.rr_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.memoria.leer_8bits(0x1223).toString(16))
        return gb.memoria.leer_8bits(0x1223) == 0x45 && gb.H == 0 && gb.N == 0 && gb.C == 0 && gb.Z == 0;
    })

    tests.push(function test_sla_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[D] = 0x80;
        gb.C = 0;
        gb.sla_r_8b(D);
        gb.printFlags()
        console.log(gb.cpu.registros.R[D].toString(16))
        return gb.cpu.registros.R[D] == 0x00 && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 1;
    })

    tests.push(function test_sla_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0xFF)
        gb.C = 0;
        gb.sla_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.memoria.leer_8bits(0x1223).toString(16))
        return gb.memoria.leer_8bits(0x1223) == 0xFE && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 0;
    })

    tests.push(function test_sra_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[D] = 0x8A;
        gb.C = 0;
        gb.sra_r_8b(D);
        gb.printFlags()
        console.log(gb.cpu.registros.R[D].toString(16))
        return gb.cpu.registros.R[D] == 0xC5 && gb.H == 0 && gb.N == 0 && gb.C == 0 && gb.Z == 0;
    })

    tests.push(function test_sra_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0x01)
        gb.C = 0;
        gb.sra_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.memoria.leer_8bits(0x1223).toString(16))
        return gb.memoria.leer_8bits(0x1223) == 0x00 && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 1;
    })

    tests.push(function test_srl_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x01;
        gb.C = 0;
        gb.srl_r_8b(A);
        gb.printFlags();
        console.log(gb.cpu.registros.R[A].toString(16));
        return gb.cpu.registros.R[A] == 0x00 && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 1;
    })

    tests.push(function test_srl_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0xFF)
        gb.C = 0;
        gb.srl_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.memoria.leer_8bits(0x1223).toString(16))
        return gb.memoria.leer_8bits(0x1223) == 0x7F && gb.H == 0 && gb.N == 0 && gb.C == 1 && gb.Z == 0;
    })

    tests.push(function test_swap_r_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x00;
        gb.C = 0;
        gb.swap_r_8b(A);
        gb.printFlags();
        console.log(gb.cpu.registros.R[A].toString(16));
        return gb.cpu.registros.R[A] == 0x00 && gb.H == 0 && gb.N == 0 && gb.C == 0 && gb.Z == 1;
    })

    tests.push(function test_swap_mrr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0xF0)
        gb.C = 0;
        gb.swap_mrr_8b(H, L);
        gb.printFlags()
        console.log(gb.memoria.leer_8bits(0x1223).toString(16))
        return gb.memoria.leer_8bits(0x1223) == 0x0F && gb.H == 0 && gb.N == 0 && gb.C == 0 && gb.Z == 0;
    })

    tests.push(function test_bit_1(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x80;
        gb.bit(7, A);
        gb.printFlags();
        return gb.H == 1 && gb.N == 0 && gb.Z == 0;
    })

    tests.push(function test_bit_2(){
        var gb = new Gameboy();
        gb.cpu.registros.R[L] = 0xEF;
        gb.bit(4, L);
        gb.printFlags();
        return gb.H == 1 && gb.N == 0 && gb.Z == 1;
    })

    tests.push(function test_bit_nbit_mrr_b8_1(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0xFE)
        gb.C = 0;
        gb.bit_nbit_mrr_b8(0, H, L);
        gb.printFlags()
        return gb.H == 1 && gb.N == 0 && gb.Z == 1;
    })

    tests.push(function test_bit_nbit_mrr_b8_2(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0xFE)
        gb.C = 0;
        gb.bit_nbit_mrr_b8(1, H, L);
        gb.printFlags()
        return gb.H == 1 && gb.N == 0 && gb.Z == 0;
    })

    tests.push(function test_set_nbit_r_b8(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x80;
        gb.set_nbit_r_b8(3, A);
        gb.printFlags();
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x84;
    })

    tests.push(function test_set_nbit_mrr_b8(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0x00);
        gb.set_nbit_mrr_b8(3, H, L);
        gb.printFlags()
        return gb.memoria.leer_8bits(0x1223) == 0x04;
    })


    tests.push(function test_res_nbit_r_b8_1(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x80;
        gb.res_nbit_r_b8(7, A);
        gb.printFlags();
        console.log(gb.cpu.registros.R[A].toString(16))
        return gb.cpu.registros.R[A] == 0x00;
    })

    tests.push(function test_res_nbit_r_b8_2(){
        var gb = new Gameboy();
        gb.cpu.registros.R[L] = 0x3B;
        gb.res_nbit_r_b8(1, L);
        gb.printFlags();
        console.log(gb.cpu.registros.R[L].toString(16))
        return gb.cpu.registros.R[L] == 0x39;
    })

    tests.push(function test_res_nbit_mrr_b8(){
        var gb = new Gameboy();
        gb.cpu.registros.R[H] = 0x12
        gb.cpu.registros.R[L] = 0x23
        gb.memoria.escribir_8bits(0x1223, 0xFF);
        gb.res_nbit_mrr_b8(3, H, L);
        gb.printFlags()
        return gb.memoria.leer_8bits(0x1223) == 0xF7;
    })

    tests.push(function test_jp_ii_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1000
        gb.memoria.escribir_8bits(0x1000, 0x00);
        gb.memoria.escribir_8bits(0x1001, 0x80);
        gb.jp_ii_8b();
        gb.printFlags()
        return gb.cpu.registros.PC == 0x8000;
    })

    tests.push(function test_jpc_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1000
        gb.memoria.escribir_8bits(0x1000, 0x00);
        gb.memoria.escribir_8bits(0x1001, 0x80);
        gb.Z = 1;
        gb.C = 0;
        gb.jpc_8b();
        gb.printFlags()
        console.log(gb.cpu.registros.PC.toString(16))
        return gb.cpu.registros.PC == 0x1002;
    })

    tests.push(function test_jpnc_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1000
        gb.memoria.escribir_8bits(0x1000, 0x00);
        gb.memoria.escribir_8bits(0x1001, 0x80);
        gb.Z = 1;
        gb.C = 0;
        gb.jpnc_8b();
        gb.printFlags()
        console.log(gb.cpu.registros.PC.toString(16))
        return gb.cpu.registros.PC == 0x8000;
    })

    tests.push(function test_jpnz_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1000
        gb.memoria.escribir_8bits(0x1000, 0x00);
        gb.memoria.escribir_8bits(0x1001, 0x80);
        gb.Z = 1;
        gb.C = 0;
        gb.jpnz_8b();
        gb.printFlags()
        console.log(gb.cpu.registros.PC.toString(16))
        return gb.cpu.registros.PC == 0x1002;
    })

    tests.push(function test_jpz_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1000
        gb.memoria.escribir_8bits(0x1000, 0x00);
        gb.memoria.escribir_8bits(0x1001, 0x80);
        gb.Z = 1;
        gb.C = 0;
        gb.jpz_8b();
        gb.printFlags()
        console.log(gb.cpu.registros.PC.toString(16))
        return gb.cpu.registros.PC == 0x8000;
    })

    tests.push(function test_jr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1001
        gb.memoria.escribir_8bits(0x1001, -127);
        console.log(gb.memoria.leer_8bits(0x1001).toString(2))
        gb.Z = 1;
        gb.C = 0;
        gb.jr_8b();
        gb.printFlags()
        console.log("pc es " + gb.cpu.registros.PC.toString(16))
        console.log("deberia ser " + (0x1002 - 127).toString(16))
        return gb.cpu.registros.PC == (0x1002 - 127);
    })

    tests.push(function test_jr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1001
        gb.memoria.escribir_8bits(0x1001, -127);
        console.log(gb.memoria.leer_8bits(0x1001).toString(2))
        gb.Z = 1;
        gb.C = 0;
        gb.jr_8b();
        gb.printFlags()
        console.log("pc es " + gb.cpu.registros.PC.toString(16))
        console.log("deberia ser " + (0x1002 - 127).toString(16))
        return gb.cpu.registros.PC == (0x1002 - 127);
    })

    tests.push(function test_jr_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1001
        gb.memoria.escribir_8bits(0x1001, -127);
        console.log(gb.memoria.leer_8bits(0x1001).toString(2))
        gb.Z = 1;
        gb.C = 0;
        gb.jr_8b();
        gb.printFlags()
        console.log("pc es " + gb.cpu.registros.PC.toString(16))
        console.log("deberia ser " + (0x1002 - 127).toString(16))
        return gb.cpu.registros.PC == (0x1002 - 127);
    })

    tests.push(function test_jrz_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1001
        gb.memoria.escribir_8bits(0x1001, -127);
        console.log(gb.memoria.leer_8bits(0x1001).toString(2))
        gb.Z = 1;
        gb.C = 0;
        gb.jrz_8b();
        gb.printFlags()
        console.log("pc es " + gb.cpu.registros.PC.toString(16))
        console.log("deberia ser " + (0x1002 - 127).toString(16))
        return gb.cpu.registros.PC == (0x1002 - 127);
    })

    tests.push(function test_jrnz_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1001
        gb.memoria.escribir_8bits(0x1001, -127);
        console.log(gb.memoria.leer_8bits(0x1001).toString(2))
        gb.Z = 1;
        gb.C = 0;
        gb.jrnz_8b();
        gb.printFlags()
        console.log("pc es " + gb.cpu.registros.PC.toString(16))
        console.log("deberia ser " + (0x1002).toString(16))
        return gb.cpu.registros.PC == (0x1002);
    })
    
    tests.push(function test_jrnc_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1001
        gb.memoria.escribir_8bits(0x1001, -127);
        console.log(gb.memoria.leer_8bits(0x1001).toString(2))
        gb.Z = 1;
        gb.C = 0;
        gb.jrnc_8b();
        gb.printFlags()
        console.log("pc es " + gb.cpu.registros.PC.toString(16))
        console.log("deberia ser " + (0x1002 - 127).toString(16))
        return gb.cpu.registros.PC == (0x1002 - 127);
    })

    tests.push(function test_jrc_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x1001
        gb.memoria.escribir_8bits(0x1001, -127);
        console.log(gb.memoria.leer_8bits(0x1001).toString(2))
        gb.Z = 1;
        gb.C = 0;
        gb.jrc_8b();
        gb.printFlags()
        console.log("pc es " + gb.cpu.registros.PC.toString(16))
        console.log("deberia ser " + (0x1002).toString(16))
        return gb.cpu.registros.PC == (0x1002);
    })

    tests.push(function test_call(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x8001
        gb.cpu.registros.SP = 0xFFFE
        gb.memoria.escribir_8bits(0x8001, 0x34);
        gb.memoria.escribir_8bits(0x8002, 0x12);
        gb.call();
        console.log("PC " + gb.cpu.registros.PC.toString(16))
        console.log("PC s " + ((gb.cpu.registros.PC & 0xFF00) >> 8).toString(16))
        console.log("FFFDH " + gb.memoria.leer_8bits(0xFFFD).toString(16))
        console.log("FFFCH " + gb.memoria.leer_8bits(0xFFFC).toString(16))
        console.log("SP " + gb.cpu.registros.SP.toString(16))

        return gb.cpu.registros.PC == (0x1234) && 
            gb.memoria.leer_8bits(0xFFFD) == 0x80 &&
            gb.memoria.leer_8bits(0xFFFC) == 0x03 &&
            gb.cpu.registros.SP == 0xFFFC;
    })

    tests.push(function test_ret(){
        var gb = new Gameboy();
        gb.cpu.registros.PC = 0x8001
        gb.cpu.registros.SP = 0xFFFE
        gb.memoria.escribir_8bits(0x8001, 0x00);
        gb.memoria.escribir_8bits(0x8002, 0x90);
        // 8000H CALL 9000H
        gb.call();
        gb.cpu.registros.PC++;
        // 9000H RET
        gb.ret();
        console.log("PC " + gb.cpu.registros.PC.toString(16))
        console.log("PC s " + ((gb.cpu.registros.PC & 0xFF00) >> 8).toString(16))
        console.log("FFFDH " + gb.memoria.leer_8bits(0xFFFD).toString(16))
        console.log("FFFCH " + gb.memoria.leer_8bits(0xFFFC).toString(16))
        console.log("SP " + gb.cpu.registros.SP.toString(16))

        return gb.cpu.registros.PC == (0x8003)
    })

    tests.push(function test_XDDDDD(){
        var gb = new Gameboy();
        gb.cpu.registros.R[B] = 0x20;
        gb.cpu.registros.R[C] = 0x20;
        gb.memoria.escribir_8bits(gb.cpu.registros.PC, -1250);
        gb.cpu.ld_mrr_i_8b(B, C);
        console.log(gb.cpu.registros.leer_16bits(B, C).toString(16))
        console.log(gb.memoria.leer_8bits(0x2020).toString(16))
        gb.inc_mrr_8b(B, C);
        console.log(gb.cpu.registros.leer_16bits(B, C).toString(16))
        console.log(gb.memoria.leer_8bits(0x2020).toString(16))
        return gb.cpu.registros.leer_16bits(B, C) == 1250
    })


    tests.push(function test_cpl_8b(){
        var gb = new Gameboy();
        gb.cpu.registros.R[A] = 0x35
        gb.cpl_8b(A)
        return gb.cpu.registros.R[A] == 0xCA
    })

    tests.push(function test_cpl_8b(){
        var gb = new Gameboy();
        gb.C = 1;
        gb.ccf_8b()
        return gb.C == 0;
    })

    tests.push(function test_windowX_8b(){
        var gb = new Gameboy();
        gb.memoria.escribir_8bits(GB_PANTALLA_REG_WX, 0x02);
        console.log(gb.pantalla.windowX)
        return true;
    })



    /**asdada */
    console.log("Comienzo de tests:")
    for(var i = 0; i < tests.length; i ++){
        gb_assert(tests[i], tests[i]());
    }

    
    
}

function gb_assert(funcion, resultado){
    if(resultado == true){
        console.log("%cFuncion " + funcion.name + " OK", 'background: #222; color: #bada55');
    } else {
        console.error("Funcion " + funcion + " NO OK");
    }
}

gb_test();