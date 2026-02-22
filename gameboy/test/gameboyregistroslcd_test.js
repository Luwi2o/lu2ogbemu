
function gb_registroslcd_assert(funcion, resultado){
    if(resultado == true){
        console.log("%cFuncion " + funcion.name + " OK", 'background: #222; color: #bada55');
    } else {
        console.error("Funcion " + funcion + " NO OK");
    }
}

function gb_registroslcd_test(){

    console.log("%c************ INICIO TESTS REGISTROS ************", 'background: #222; color: #bada55')
    var tests = new Array();

    // Comprobar que los registros del LCD esten inicializados a 0 al principio
    tests.push(function test_registros_ini_lcd_control(){
        var regInterr = new RegistrosLCD();
        return regInterr.getLCDControl() == 0x00;
    });

    // Poner todos los registros del control del LCD a set
    tests.push(function test_registros_lcd_control_set(){
        var regInterr = new RegistrosLCD();
        regInterr.setLCDControl(0xFF);
        console.log("LCDEnable: ", regInterr.LCDEnable);
        console.log("windowTileMapArea: ", regInterr.windowTileMapArea);
        console.log("windowEnable: ", regInterr.windowEnable);
        console.log("BGWindowTileDataArea: ", regInterr.BGWindowTileDataArea);
        console.log("BGTileMapArea: ", regInterr.BGTileMapArea);
        console.log("objSize: ", regInterr.objSize);
        console.log("objEnable: ", regInterr.objEnable);
        console.log("BGWindowPriority: ", regInterr.BGWindowPriority);
        return(
            regInterr.LCDEnable &&
            regInterr.windowTileMapArea &&
            regInterr.windowEnable &&
            regInterr.BGWindowTileDataArea &&
            regInterr.BGTileMapArea &&
            regInterr.objSize &&
            regInterr.objEnable &&
            regInterr.BGWindowPriority
        )
    });

    // Poner todos los registros del control del LCD a set
    tests.push(function test_registros_lcd_control_set99(){
        var regInterr = new RegistrosLCD();
        regInterr.setLCDControl(0x99);
        console.log("LCDEnable: ", regInterr.LCDEnable);
        console.log("windowTileMapArea: ", regInterr.windowTileMapArea);
        console.log("windowEnable: ", regInterr.windowEnable);
        console.log("BGWindowTileDataArea: ", regInterr.BGWindowTileDataArea);
        console.log("BGTileMapArea: ", regInterr.BGTileMapArea);
        console.log("objSize: ", regInterr.objSize);
        console.log("objEnable: ", regInterr.objEnable);
        console.log("BGWindowPriority: ", regInterr.BGWindowPriority);
        return(
            regInterr.LCDEnable &&
            !regInterr.windowTileMapArea &&
            !regInterr.windowEnable &&
            regInterr.BGWindowTileDataArea &&
            regInterr.BGTileMapArea &&
            !regInterr.objSize &&
            !regInterr.objEnable &&
            regInterr.BGWindowPriority
        )
    });

    // Get de los registros del control del LCD
    tests.push(function test_registros_lcd_control_get(){
        var regInterr = new RegistrosLCD();
        regInterr.LCDEnable = true;
        regInterr.windowTileMapArea = true;
        regInterr.windowEnable = true;
        regInterr.BGWindowTileDataArea = true;
        regInterr.BGTileMapArea = true;
        regInterr.objSize = true;
        regInterr.objEnable = true;
        regInterr.BGWindowPriority = true;
        return regInterr.getLCDControl() == 0xFF;
    });

    // Get y Set despues de registros de control
    tests.push(function test_registros_lcd_control_g_set(){
        var regInterr = new RegistrosLCD();
        regInterr.setLCDControl(0xFF);
        return regInterr.getLCDControl() == 0xFF;
    });

    console.log("Comienzo de tests:")
    for(var i = 0; i < tests.length; i ++){
        console.log("---- INICIO TEST " + tests[i].name)
        gb_registroslcd_assert(tests[i], tests[i]());
    }
    
}

gb_registroslcd_test();