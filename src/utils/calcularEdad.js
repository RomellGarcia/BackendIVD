// src/utils/calcularEdad.js
function calcularEdad(fechaNacimiento) {
    var hoy     = new Date();
    var fechaNac = new Date(fechaNacimiento);
    var edad    = hoy.getFullYear() - fechaNac.getFullYear();
    var mes     = hoy.getMonth() - fechaNac.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
        edad--;
    }
    return edad;
}

module.exports = calcularEdad;