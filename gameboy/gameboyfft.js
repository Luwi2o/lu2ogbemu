/** Basado en:
 * https://gist.github.com/corbanbrook/4ef7ce98fe4453d754cd7e4a341d6e5b
 */
class FFT{
    constructor(bufferSize){
        this.bufferSize = bufferSize;
        this.reverseTable = new Uint32Array(bufferSize);
        var limit = 1;
        var bit = bufferSize >> 1;
      
        var i;
      
        while (limit < bufferSize) {
          for (i = 0; i < limit; i++) {
            this.reverseTable[i + limit] = this.reverseTable[i] + bit;
          }
      
          limit = limit << 1;
          bit = bit >> 1;
        }
      
        this.sinTable = new Float32Array(bufferSize);
        this.cosTable = new Float32Array(bufferSize);
      
        for (i = 0; i < bufferSize; i++) {
          this.sinTable[i] = Math.sin(-Math.PI/i);
          this.cosTable[i] = Math.cos(-Math.PI/i);
        }
    }

    /** Hace la transformada de fourier FFT
     * 
     * @param {*} buffer Buffer del que se saca la onda
     * @param {*} real Buffer en el que se introducira el componente real
     * @param {*} imag Buffer en el que se introducira el componente imaginario
     */
    transformar(buffer, real, imag){
      
        var bufferSize = this.bufferSize

        var k = Math.floor(Math.log(bufferSize) / Math.LN2);

        if (Math.pow(2, k) !== bufferSize) { throw "Invalid buffer size, must be a power of 2."; }
        if (bufferSize !== buffer.length)  { throw "Supplied buffer is not the same size as defined FFT. FFT Size: " + bufferSize + " Buffer Size: " + buffer.length; }

        var halfSize = 1,
            phaseShiftStepReal,
            phaseShiftStepImag,
            currentPhaseShiftReal,
            currentPhaseShiftImag,
            off,
            tr,
            ti,
            tmpReal,
            i;

        for (i = 0; i < bufferSize; i++) {
            real[i] = buffer[this.reverseTable[i]] / 4096;
            imag[i] = 0;
        }

        while (halfSize < bufferSize) {
            //phaseShiftStepReal = Math.cos(-PI/halfSize);
            //phaseShiftStepImag = Math.sin(-PI/halfSize);
            //phaseShiftStepReal = Math.cos(-3.141592653589793/halfSize);
            //phaseShiftStepImag = Math.sin(-3.141592653589793/halfSize);
            phaseShiftStepReal = this.cosTable[halfSize];
            phaseShiftStepImag = this.sinTable[halfSize];

            currentPhaseShiftReal = 1.0;
            currentPhaseShiftImag = 0.0;

            for (var fftStep = 0; fftStep < halfSize; fftStep++) {
              i = fftStep;

              while (i < bufferSize) {
                  off = i + halfSize;
                  tr = (currentPhaseShiftReal * real[off]) - (currentPhaseShiftImag * imag[off]);
                  ti = (currentPhaseShiftReal * imag[off]) + (currentPhaseShiftImag * real[off]);

                  real[off] = real[i] - tr;
                  imag[off] = imag[i] - ti;
                  real[i] += tr;
                  imag[i] += ti;

                  i += halfSize << 1;
              }

              tmpReal = currentPhaseShiftReal;
              currentPhaseShiftReal = (tmpReal * phaseShiftStepReal) - (currentPhaseShiftImag * phaseShiftStepImag);
              currentPhaseShiftImag = (tmpReal * phaseShiftStepImag) + (currentPhaseShiftImag * phaseShiftStepReal);
            }

            halfSize = halfSize << 1;
        }
  //return this.calculateSpectrum();
    }
}