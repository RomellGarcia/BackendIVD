import cloudinary from 'cloudinary'

// Cloudinary necesita saber si el archivo es 'image' o 'raw' para poder borrarlo
export const borrarDeCloudinary = async (publicId) => {
  if (!publicId) return
  for (const resourceType of ['image', 'raw']) {
    try {
      const result = await cloudinary.v2.uploader.destroy(publicId, { resource_type: resourceType })
      if (result.result === 'ok') return
    } catch (err) {
      // probar el siguiente tipo
    }
  }
}