// @ts-check

////////// Memoria //////////
export const GB_MEMORIA_TAMANO = 0x10000; //(8KB) 
export const GB_TIPO_CARTUCHO_ROM_SOLO = 0x00;
export const GB_TIPO_CARTUCHO_MBC1 = 0x01;
export const GB_TIPO_CARTUCHO_MBC1_RAM = 0x02;
export const GB_TIPO_CARTUCHO_MBC1_RAM_BATERIA = 0x03;
export const GB_TIPO_CARTUCHO_MBC2 = 0x05;
export const GB_TIPO_CARTUCHO_MBC2_BATERIA = 0x06;
export const GB_TIPO_CARTUCHO_ROM_RAM = 0x08;
export const GB_TIPO_CARTUCHO_ROM_RAM_BATERIA = 0x09;
export const GB_TIPO_CARTUCHO_MMM01 = 0x0B;
export const GB_TIPO_CARTUCHO_MMM01_RAM = 0x0C;
export const GB_TIPO_CARTUCHO_MMM01_RAM_BATERIA = 0x0D;
export const GB_TIPO_CARTUCHO_MBC3_TIMER_BATERIA = 0x0F;
export const GB_TIPO_CARTUCHO_MBC3_TIMER_RAM_BATERIA = 0x10;
export const GB_TIPO_CARTUCHO_MBC3 = 0x11;
export const GB_TIPO_CARTUCHO_MBC3_RAM = 0x12;
export const GB_TIPO_CARTUCHO_MBC3_RAM_BATERIA = 0x13;
export const GB_TIPO_CARTUCHO_MBC5 = 0x19;
export const GB_TIPO_CARTUCHO_MBC5_RAM = 0x1A;
export const GB_TIPO_CARTUCHO_MBC5_RAM_BATERIA = 0x1B;
export const GB_TIPO_CARTUCHO_MBC5_VIBRACION = 0x1C;
export const GB_TIPO_CARTUCHO_MBC5_VIBRACION_RAM = 0x1D;
export const GB_TIPO_CARTUCHO_MBC5_VIBRACION_RAM_BATERIA = 0x1E;
export const GB_TIPO_CARTUCHO_MBC6 = 0x1A;
export const GB_TIPO_CARTUCHO_MBC7_SENSOR_VIBRACION_RAM_BATERIA = 0x22;
export const GB_TIPO_CARTUCHO_POCKET_CAMERA = 0xFC;
export const GB_TIPO_CARTUCHO_BANDAI_TAMA5 = 0xFD;
export const GB_TIPO_CARTUCHO_HuC3 = 0xFD;
export const GB_TIPO_CARTUCHO_HuC3_RAM_BATERIA = 0xFD;

 

////////// Memoria Video //////////
export const GB_TAMANO_MEMORIA_VIDEO = 0x10000; //(8KB)

////////// Pantalla //////////
// Ancho de la pantalla
export const GB_PANTALLA_ANCHO = 160;
export const GB_PANTALLA_ALTO = 144;
export const GB_TOTAL_PIXELES = GB_PANTALLA_ANCHO * GB_PANTALLA_ALTO;
export const GB_PANTALLA_ESCALADO = 4;

export const GB_BOTONES_REG = 0xFF00;

/** https://gbdev.io/pandocs/LCDC.html */
export const GB_PANTALLA_REG_CONTROL = 0xFF40;
/** https://gbdev.io/pandocs/STAT.html */
export const GB_PANTALLA_REG_ESTADO = 0xFF41;
/** https://gbdev.io/pandocs/Scrolling.html */
// Especifican las coordenadas desde arriba izquierda del mapa de bg 256*256
export const GB_PANTALLA_REG_SCROLLY = 0xFF42;
export const GB_PANTALLA_REG_SCROLLX = 0xFF43;

// https://gbdev.io/pandocs/Scrolling.html 
// Linea vertical al que se le presentan los datos al LCD
// Valor entre 0-153. Valores entre 144 y 153 indican periodo V-Blank
export const GB_PANTALLA_REG_LY_COORD = 0xFF44;

// https://gbdev.io/pandocs/Scrolling.html
// Se comparan permanentemente los valores de los registros LYC y LY.
// Cuando ambos son identicos el bit coincidente en el registro STAT
// se pone a 1 y se pide la interrupcion STAT.
export const GB_PANTALLA_REG_LYC_COMP = 0xFF45;

// https://gbdev.io/pandocs/OAM_DMA_Transfer.html#ff46--dma-oam-dma-source-address--start
export const GB_PANTALLA_OAM_DMA_TRANSFER = 0xFF46;

// https://gbdev.io/pandocs/Scrolling.html
// Especifican las coordenadas desde arriba izquierda de la ventana
// La ventana es visible si se encuentra en rango WX=0..166 WY=0..143
export const GB_PANTALLA_REG_WY = 0xFF4A
export const GB_PANTALLA_REG_WX = 0xFF4B

/** https://gbdev.io/pandocs/Palettes.html 
Bit 7-6 - Color for index 3
Bit 5-4 - Color for index 2
Bit 3-2 - Color for index 1
Bit 1-0 - Color for index 0
*/
// Paleta de BG 
export const GB_PALETA_REG_BG = 0xFF47;
// Paleta de OBJ
export const GB_PALETA_REG_OBP0 = 0xFF48;
export const GB_PALETA_REG_OBP1 = 0xFF49;

//////////Sprites//////////
export const GB_SPRITES_MAXIMOS = 40;
export const GB_SPRITES_MAXIMOS_LINEA = 10;
export const GB_SPRITES_ANCHO = 8;
export const GB_SPRITES_ALTO1 = 8;
export const GB_SPRITES_ALTO2 = 16;

////////// Colores //////////
export const GB_COLORES = 4;

////////// CPU //////////
export const GB_CPU_FRECUENCIA = 4.194304 * 1000000 //HZ

////////// Sonido ///////////

// Canal 1
/** https://gbdev.io/pandocs/Sound_Controller.html 
Bit 6-4 - Sweep Time
Bit 3   - Sweep Increase/Decrease
            0: Addition    (frequency increases)
            1: Subtraction (frequency decreases)
Bit 2-0 - Number of sweep shift (n: 0-7)
*/
export const GB_SONIDO_REG_NR10 = 0xFF10;
/** https://gbdev.io/pandocs/Sound_Controller.html 
Bit 7-6 - Wave Pattern Duty (Read/Write)
Bit 5-0 - Sound length data (Write Only) (t1: 0-63)
*/
export const GB_SONIDO_REG_NR11 = 0xFF11;
export const GB_SONIDO_REG_NR12 = 0xFF12;
export const GB_SONIDO_REG_NR13 = 0xFF13;
export const GB_SONIDO_REG_NR14 = 0xFF14;

// Canal 2
// https://gbdev.io/pandocs/Sound_Controller.html
export const GB_SONIDO_REG_NR21 = 0xFF16;
export const GB_SONIDO_REG_NR22 = 0xFF17;
export const GB_SONIDO_REG_NR23 = 0xFF18;
export const GB_SONIDO_REG_NR24 = 0xFF19;

// Canal 3
// https://gbdev.io/pandocs/Sound_Controller.html
export const GB_SONIDO_REG_NR30 = 0xFF1A;
export const GB_SONIDO_REG_NR31 = 0xFF1B;
export const GB_SONIDO_REG_NR32 = 0xFF1C;
export const GB_SONIDO_REG_NR33 = 0xFF1D;
export const GB_SONIDO_REG_NR34 = 0xFF1E;

// Memoria Patrones de Ondas
// FF30-FF3F
export const GB_SONIDO_MEM_PATRONES_ONDAS = 0xFF30;

// Canal 5 - Ruido
// https://gbdev.io/pandocs/Sound_Controller.html
export const GB_SONIDO_REG_NR41 = 0xFF20;
export const GB_SONIDO_REG_NR42 = 0xFF21;
export const GB_SONIDO_REG_NR43 = 0xFF22;
export const GB_SONIDO_REG_NR44 = 0xFF23;

// Registros de control de sonido
export const GB_SONIDO_REG_NR50 = 0xFF24;
export const GB_SONIDO_REG_NR51 = 0xFF25;
export const GB_SONIDO_REG_NR52 = 0xFF26;

////////// Botones //////////

/** https://gbdev.io/pandocs/Joypad_Input.html 
Bit 7 - Not used
Bit 6 - Not used
Bit 5 - P15 Select Action buttons    (0=Select)
Bit 4 - P14 Select Direction buttons (0=Select)
Bit 3 - P13 Input: Down  or Start    (0=Pressed) (Read Only)
Bit 2 - P12 Input: Up    or Select   (0=Pressed) (Read Only)
Bit 1 - P11 Input: Left  or B        (0=Pressed) (Read Only)
Bit 0 - P10 Input: Right or A        (0=Pressed) (Read Only)
*/
export const GB_BOTONES_REG_NR52 = 0xFF26;

////////// Temporizadores //////////
// https://gbdev.io/pandocs/Timer_and_Divider_Registers.html
export const GB_TEMPORIZADOR_REG_DIV = 0xFF04;
export const GB_TEMPORIZADOR_REG_TIMA = 0xFF05;
export const GB_TEMPORIZADOR_REG_TMA = 0xFF06;
/** Explicacion bits: 
Bit  2   - Timer Enable
Bits 1-0 - Input Clock Select
    00: CPU Clock / 1024 (DMG, SGB2, CGB Single Speed Mode:   4096 Hz, SGB1:   ~4194 Hz, CGB Double Speed Mode:   8192 Hz)
    01: CPU Clock / 16   (DMG, SGB2, CGB Single Speed Mode: 262144 Hz, SGB1: ~268400 Hz, CGB Double Speed Mode: 524288 Hz)
    10: CPU Clock / 64   (DMG, SGB2, CGB Single Speed Mode:  65536 Hz, SGB1:  ~67110 Hz, CGB Double Speed Mode: 131072 Hz)
    11: CPU Clock / 256  (DMG, SGB2, CGB Single Speed Mode:  16384 Hz, SGB1:  ~16780 Hz, CGB Double Speed Mode:  32768 Hz)
*/
export const GB_TEMPORIZADOR_REG_TAC = 0xFF07;

////////// Interrupciones //////////
// https://gbdev.io/pandocs/Interrupts.html
/**
Bit 0: VBlank   Interrupt Enable  (INT $40)  (1=Enable)
Bit 1: LCD STAT Interrupt Enable  (INT $48)  (1=Enable)
Bit 2: Timer    Interrupt Enable  (INT $50)  (1=Enable)
Bit 3: Serial   Interrupt Enable  (INT $58)  (1=Enable)
Bit 4: Joypad   Interrupt Enable  (INT $60)  (1=Enable)
*/
export const GB_INTERRUPCIONES_REG_IE = 0xFFFF;
/**
Bit 0: VBlank   Interrupt Request (INT $40)  (1=Request)
Bit 1: LCD STAT Interrupt Request (INT $48)  (1=Request)
Bit 2: Timer    Interrupt Request (INT $50)  (1=Request)
Bit 3: Serial   Interrupt Request (INT $58)  (1=Request)
Bit 4: Joypad   Interrupt Request (INT $60)  (1=Request)
*/
export const GB_INTERRUPCIONES_REG_IF = 0xFF0F;

// https://gbdev.io/pandocs/Memory_Map.html
export const GB_TAMANO_MEMORIA = 0x10000

// Sonido
// Canal Audio
export const AUDIO_NO = 0;
export const AUDIO_DER = 1;
export const AUDIO_IZQ = 2
export const AUDIO_CENTRO = 3
// Direccion Barrido
export const DIR_RESTAR = -1;
export const DIR_SUMAR = +1;

// Tipos de consola
export const DMG0 = 0;
export const BGB = 1;
export const BGB_DMG0 = 2;

// Constantes de los botones
export const BIT_SELECCION_BOTONES = 5;
export const BIT_SELECCION_DIRECCIONAL = 4;

export const BIT_BOTON_START = 3;
export const BIT_BOTON_SELECT = 2;
export const BIT_BOTON_B = 1;
export const BIT_BOTON_A = 0;

export const BIT_DIR_ABAJO = 3;
export const BIT_DIR_ARRIBA = 2;
export const BIT_DIR_IZQUIERDA = 1;
export const BIT_DIR_DERECHA = 0;

export const SELECCIONADO_BOTONES = 0x2;
export const SELECCIONADO_DIRECCION = 0x1;
export const SELECCIONADO_AMBOS = 0x3;

export const BOTON_A = 0;
export const BOTON_B = 1;
export const BOTON_SELECT = 2;
export const BOTON_START = 3;
export const BOTON_ARRIBA = 4;
export const BOTON_IZQUIERDA = 5;
export const BOTON_DERECHA = 6;
export const BOTON_ABAJO = 7;

export const ES_ACCION = 0;
export const ES_DIRECCION = 1;

export const VBLANK_INT = 0;
export const LCDSTAT_INT = 1;
export const TIMER_INT = 2;
export const SERIAL_INT = 3;
export const JOYPAD_INT = 4;
export const NUMERO_DE_INTS = 5;

// Registros CPU
export const B = 0; 
export const C = 1; 
export const D = 2; 
export const E = 3; 
export const H = 4; 
export const L = 5; 
export const F = 6; 
export const A = 7;