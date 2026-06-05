// Calcula la edad en años a partir de una fecha de nacimiento
export const calcularEdad = (fechaNacimiento) => {
  const hoy   = new Date()
  const nac   = new Date(fechaNacimiento)
  let edad    = hoy.getFullYear() - nac.getFullYear()
  const mes   = hoy.getMonth() - nac.getMonth()

  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) {
    edad--
  }
  return edad
}