
function gb_memoria_test(){


    console.log("%c************ TESTS MEMORIA ************", 'background: #222; color: #bada55')
    var tests = new Array();

    // Test leer 8 bits de la memoria rom
    tests.push(function test_leer_8bits_rom(){
        // Inicializar Memoria
        var cartucho = new Uint8Array(0x8000);
        // Leer 8 bits de la memoria rom introducidos a mano 
        cartucho[0x0000] = 0x22;
        var regLCD = new RegistrosLCD();
        var regInterr = new RegistrosInterrupciones();
        var memoria = new Memoria(cartucho, regLCD, regInterr);

        var dato = memoria.leer_8bits(0x0000);
        return dato == 0x22
    })

    // Test leer 8 bits de la memoria rom
    tests.push(function test_leer_8bits_rom2(){
        // Inicializar Memoria
        var cartucho = new Uint8Array(0x8000);
        // Leer 8 bits de la memoria rom introducidos a mano 
        cartucho[0x1000] = 0x22;
        var regLCD = new RegistrosLCD();
        var regInterr = new RegistrosInterrupciones();
        var memoria = new Memoria(cartucho, regLCD, regInterr);

        var dato = memoria.leer_8bits(0x1000);
        return dato == 0x22
    })

    // Test leer 8 bits de la memoria ram externa
    tests.push(function test_romram_leer_8bits_de_sram(){
        // Inicializar Memoria
        var cartucho = new Uint8Array(0x8000);
        cartucho[0x0147] = GB_TIPO_CARTUCHO_ROM_RAM;
        var regLCD = new RegistrosLCD();
        var regInterr = new RegistrosInterrupciones();
        var memoria = new Memoria(cartucho, regLCD, regInterr);

        // Leer 8 bits de la memoria rom introducidos a mano 
        memoria.sRAM[0x0000] = 0x22;
        var dato = memoria.leer_8bits(0xA000);
        return dato == 0x22
    })

    // Test leer 8 bits de la memoria vram
    tests.push(function test_leer_8bits_vram(){
        // Inicializar Memoria
        var cartucho = new Uint8Array(0x8000);
        var regLCD = new RegistrosLCD();
        var regInterr = new RegistrosInterrupciones();
        var memoria = new Memoria(cartucho, regLCD, regInterr);

        // Leer 8 bits de la memoria ram introducidos a mano 
        memoria.vRAM[0x0000] = 0x12;
        var dato = memoria.leer_8bits(0x8000);
        return dato == 0x12
    })

    // Test leer 8 bits de la memoria ram externa
    tests.push(function test_mbc1_leer_8bits_de_sram(){
        // Inicializar Memoria
        var cartucho = new Uint8Array(0x8000);
        cartucho[0x0147] = GB_TIPO_CARTUCHO_MBC1_RAM; // MBC1
        cartucho[0x0148] = 0x8000; // 32Kib SRAM
        // Leer 8 bits de la memoria sram introducidos a mano 
        var regLCD = new RegistrosLCD();
        var regInterr = new RegistrosInterrupciones();
        var memoria = new Memoria(cartucho, regLCD, regInterr);

        memoria.sRAM[0x0000] = 0x11;
        // Activar acceso a RAM
        memoria.escribir_8bits(0x1FFF, 0x0A)
        var dato = memoria.leer_8bits(0xA000);
        return dato == 0x11
    })

    // Test leer 8 bits de la memoria ram externa
    tests.push(function test_leer_8bits_ram_ext(){
        // Inicializar Memoria
        var cartucho = new Uint8Array(0x8000);
        var regLCD = new RegistrosLCD();
        var regInterr = new RegistrosInterrupciones();
        var memoria = new Memoria(cartucho, regLCD, regInterr);

        // Leer 8 bits de la memoria ram introducidos a mano 
        memoria.vRAM[0x0000] = 0x12;
        var dato = memoria.leer_8bits(0x8000);
        return dato == 0x12
    })


    console.log("Comienzo de tests:")
    for(var i = 0; i < tests.length; i ++){
        console.log("---- INICIO TEST " + tests[i].name)
        gb_memoria_assert(tests[i], tests[i]());
    }



    
    
}

function gb_memoria_assert(funcion, resultado){
    if(resultado == true){
        console.log("%cFuncion " + funcion.name + " OK", 'background: #222; color: #bada55');
    } else {
        console.error("Funcion " + funcion + " NO OK");
    }
}

gb_memoria_test();