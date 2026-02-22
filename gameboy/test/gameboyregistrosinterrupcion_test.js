function gb_registrosinterrupcion_assert(funcion, resultado){
    if(resultado == true){
        console.log("%cFuncion " + funcion.name + " OK", 'background: #222; color: #bada55');
    } else {
        console.error("Funcion " + funcion + " NO OK");
    }
}

function gb_registrosinterrupcion_test(){

    console.log("%c************ INICIO TESTS REGISTROS INTERRUPCION ************", 'background: #222; color: #bada55')
    var tests = new Array();

    // Comprobar que los registros del LCD esten inicializados a 0 al principio
    tests.push(function test_registro_ini_if(){
        var regInt = new RegistrosInterrupciones();
        return regInt.getIF() == 0x00;
    });

    // Poner todos los registros del control del LCD a set
    tests.push(function test_registro_if_set(){
        var regInt = new RegistrosInterrupciones();
        regInt.setIF(0xFF);
        return (
            regInt.flagsInterrupcion[0] &&
            regInt.flagsInterrupcion[1] &&
            regInt.flagsInterrupcion[2] &&
            regInt.flagsInterrupcion[3] &&
            regInt.flagsInterrupcion[4] &&
            regInt.bitsInutilesIF[0] &&
            regInt.bitsInutilesIF[1] &&
            regInt.bitsInutilesIF[2]
        );
    });

    // Poner todos los registros del control del LCD a set
    tests.push(function test_registro_if_set99(){
        var regInt = new RegistrosInterrupciones();
        regInt.setIF(0x99);
        return (
            regInt.flagsInterrupcion[0] &&
            !regInt.flagsInterrupcion[1] &&
            !regInt.flagsInterrupcion[2] &&
            regInt.flagsInterrupcion[3] &&
            regInt.flagsInterrupcion[4] &&
            !regInt.bitsInutilesIF[0] &&
            !regInt.bitsInutilesIF[1] &&
            regInt.bitsInutilesIF[2]
        );
    });

    // Get de los registros del control del LCD
    tests.push(function test_registro_if_get(){
        var regInt = new RegistrosInterrupciones();
        regInt.flagsInterrupcion[0] = true;
        regInt.flagsInterrupcion[1] = true;
        regInt.flagsInterrupcion[2] = true;
        regInt.flagsInterrupcion[3] = true;
        regInt.flagsInterrupcion[4] = true;
        regInt.bitsInutilesIF[0] = true; 
        regInt.bitsInutilesIF[1] = true;
        regInt.bitsInutilesIF[2] = true;
        return regInt.getIF() == 0xFF;
    });

    // Get y Set despues de registros de control
    tests.push(function test_registro_if_get_set(){
        regInt = new RegistrosInterrupciones();
        regInt.setIF(0xFF);
        return regInt.getIF() == 0xFF;
    });

    // Get y Set despues de registros de control
    tests.push(function test_registro_if_get_set_nottrue(){
        regInt = new RegistrosInterrupciones();
        regInt.setIF(0xF0);
        console.log(regInt.getIF().toString(16))
        return !(regInt.getIF() == 0xFF);
    });

    console.log("Comienzo de tests:")
    for(var i = 0; i < tests.length; i ++){
        console.log(">>> INICIO TEST " + tests[i].name)
        gb_registrosinterrupcion_assert(tests[i], tests[i]());
    }
    
}

gb_registrosinterrupcion_test();